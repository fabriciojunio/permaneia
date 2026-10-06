// Rastro da consulta ao assistente, no padrao de observabilidade de LLM.
//
// O projeto ja grava telemetria no proprio banco: modelo, tokens, custo e
// latencia por consulta, agregados em /api/observabilidade. Isso responde "como
// esta o sistema". O que ele nao responde e "por que ESTA resposta saiu assim",
// porque a linha do banco guarda o resultado e nao o caminho.
//
// O rastro guarda o caminho: quanto tempo a recuperacao levou, quais trechos
// chegaram ao modelo com que similaridade, o que o modelo devolveu antes da
// verificacao, e se a resposta foi substituida. Sao as perguntas que aparecem
// quando alguem reclama de uma resposta especifica.
//
// Nenhuma credencial passa por aqui: o SDK le as proprias variaveis de
// ambiente, e este modulo so verifica se elas existem.

import { logger } from "./logger";

export type EtapaDoRastro = {
  nome: string;
  entrada?: unknown;
  saida?: unknown;
  duracaoMs?: number;
};

export type GeracaoRastreada = {
  modelo: string | null;
  prompt: string;
  saida: string;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  custoUsd: number | null;
};

export function ligado(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

/**
 * Registra uma consulta inteira.
 *
 * Recebe tudo pronto, depois do fato, em vez de embrulhar a execucao. É uma
 * escolha: embrulhar obrigaria o modulo do RAG a conhecer o rastro em cada
 * ponto, e o rastro deixaria de ser opcional de verdade. Assim, se este arquivo
 * sumir, o assistente continua funcionando sem alteracao nenhuma.
 */
export async function registrarConsulta(entrada: {
  pergunta: string;
  etapas: EtapaDoRastro[];
  geracao?: GeracaoRastreada;
  veredicto: string;
  resposta: string;
}): Promise<void> {
  if (!ligado()) return;

  try {
    const { startObservation } = await import("@langfuse/tracing");

    const raiz = startObservation(
      "permaneia.perguntar",
      { input: { pergunta: entrada.pergunta } },
      { asType: "agent" }
    );

    for (const etapa of entrada.etapas) {
      const filho = raiz.startObservation(etapa.nome, {
        input: etapa.entrada,
        output: etapa.saida,
      });
      filho.end();
    }

    if (entrada.geracao) {
      // Tipo `generation` e nao `span`: e o que faz o painel somar token e
      // custo. Span comum guardaria o texto e perderia a conta.
      const g = raiz.startObservation(
        "gerar",
        {
          model: entrada.geracao.modelo ?? undefined,
          input: entrada.geracao.prompt,
          output: entrada.geracao.saida,
          usageDetails: {
            input: entrada.geracao.tokensEntrada ?? 0,
            output: entrada.geracao.tokensSaida ?? 0,
          },
          ...(entrada.geracao.custoUsd !== null
            ? { costDetails: { total: entrada.geracao.custoUsd } }
            : {}),
        },
        { asType: "generation" }
      );
      g.end();
    }

    raiz.update({ output: { veredicto: entrada.veredicto, resposta: entrada.resposta } });
    raiz.end();

    // Envio explícito, e não em segundo plano: em função sem servidor o
    // processo congela assim que a resposta sai, e o que estiver na fila morre
    // com ele. Sem esta linha, nada falha e o painel fica vazio, que é o modo
    // de falha mais caro de observabilidade.
    const { enviarPendentes } = await import("./otel");
    await enviarPendentes();
  } catch (e) {
    // Telemetria nunca derruba a resposta de quem perguntou. Mas o erro VAI
    // para o log: foi exatamente um erro engolido em silencio que fez o rastro
    // de outro projeto desta familia nao registrar nada por horas sem ninguem
    // perceber.
    logger.warn("Falha ao registrar o rastro do RAG", { detalhe: (e as Error).message });
  }
}
