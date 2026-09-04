// Correlação de requisições e resposta de erro padronizada.
//
// O middleware abre um rastro por requisição e o repassa em `traceparent`, no
// formato do W3C, com o mesmo identificador copiado em x-request-id. Devolvê-lo
// ao cliente no corpo do erro é o que torna um problema relatado pelo usuário
// localizável no log, sem pedir a ele que descreva o que apareceu na tela.
//
// É aqui, e não em cada rota, que o rastro passa a valer para tudo que roda
// abaixo, incluindo as consultas ao banco (ver lib/rastro-do-banco.ts).

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "./logger";
import { statusHttp, type ErroApp } from "./resultado";
import { CAMPO_RASTRO } from "./rastro";
import { camposDeRastro, comRastro, emitirTrecho } from "./rastro-ativo";

export async function idDaRequisicao(): Promise<string> {
  try {
    return (await headers()).get("x-request-id") ?? "-";
  } catch {
    // Fora de contexto de requisição, como nos testes.
    return "-";
  }
}

/** O `traceparent` que o middleware deixou, para o handler continuar o mesmo rastro. */
async function rastroRecebido(): Promise<string | null> {
  try {
    return (await headers()).get(CAMPO_RASTRO);
  } catch {
    return null;
  }
}

/**
 * Resposta de erro no envelope { erro: { codigo, mensagem, campos, idRequisicao } }.
 * O detalhe técnico fica só no log: mensagem de exceção em corpo de resposta é
 * como estrutura interna e caminho de arquivo vazam para fora.
 */
export async function respostaDeErro(erroApp: ErroApp, detalhe?: unknown): Promise<NextResponse> {
  const idRequisicao = await idDaRequisicao();
  const status = statusHttp(erroApp.codigo);

  const registrar = status >= 500 ? logger.error : logger.warn;
  registrar(erroApp.mensagem, {
    codigo: erroApp.codigo,
    status,
    idRequisicao,
    ...camposDeRastro(),
    detalhe: detalhe instanceof Error ? detalhe.message : detalhe,
  });

  return NextResponse.json(
    {
      erro: {
        codigo: erroApp.codigo,
        mensagem: erroApp.mensagem,
        ...(erroApp.campos ? { campos: erroApp.campos } : {}),
        idRequisicao,
      },
    },
    { status }
  );
}

/** Resposta de sucesso, com o mesmo identificador de correlação no cabeçalho. */
export async function respostaOk<T>(dados: T, status = 200): Promise<NextResponse> {
  return NextResponse.json(dados, {
    status,
    headers: { "X-Request-ID": await idDaRequisicao() },
  });
}

/**
 * Envolve o handler para que exceção não tratada vire 500 padronizado e
 * registrado, em vez da página de erro genérica da plataforma.
 */
export function comTratamentoDeErro<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    // O rastro é estabelecido aqui, e não em cada handler, porque é este ponto
    // que todas as rotas atravessam. Estabelecido uma vez, ele fica visível
    // para tudo que roda abaixo, incluindo a instrumentação das consultas ao
    // banco, sem que nenhum repositório precise receber o rastro por parâmetro.
    const pai = await rastroRecebido();
    return comRastro(pai, async () => {
      try {
        return await handler(...args);
      } catch (e) {
        return respostaDeErro(
          { codigo: "INTERNO", mensagem: "Erro interno. Tente novamente em instantes." },
          e
        );
      }
    });
  };
}

/** Mede a duração de uma operação, para o log e para a métrica de latência do RAG. */
export async function medir<T>(rotulo: string, operacao: () => Promise<T>): Promise<{ valor: T; duracaoMs: number }> {
  const inicio = Date.now();
  const valor = await operacao();
  const duracaoMs = Date.now() - inicio;
  // Sai como trecho de rastro, e não como linha solta: assim a medição de uma
  // etapa cara, como a chamada ao provedor de IA, aparece pendurada no mesmo
  // pedido que disparou as consultas ao banco logo acima dela.
  emitirTrecho(rotulo, duracaoMs);
  return { valor, duracaoMs };
}
