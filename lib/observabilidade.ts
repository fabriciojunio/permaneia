// Correlação de requisições e resposta de erro padronizada.
//
// O middleware gera um identificador por requisição e o repassa em
// x-request-id. Devolvê-lo ao cliente no corpo do erro é o que torna um
// problema relatado pelo usuário localizável no log, sem pedir a ele que
// descreva o que apareceu na tela.

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "./logger";
import { statusHttp, type ErroApp } from "./resultado";

export async function idDaRequisicao(): Promise<string> {
  try {
    return (await headers()).get("x-request-id") ?? "-";
  } catch {
    // Fora de contexto de requisição, como nos testes.
    return "-";
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
    try {
      return await handler(...args);
    } catch (e) {
      return respostaDeErro(
        { codigo: "INTERNO", mensagem: "Erro interno. Tente novamente em instantes." },
        e
      );
    }
  };
}

/** Mede a duração de uma operação, para o log e para a métrica de latência do RAG. */
export async function medir<T>(rotulo: string, operacao: () => Promise<T>): Promise<{ valor: T; duracaoMs: number }> {
  const inicio = Date.now();
  const valor = await operacao();
  const duracaoMs = Date.now() - inicio;
  logger.debug(`${rotulo} concluído`, { duracaoMs });
  return { valor, duracaoMs };
}
