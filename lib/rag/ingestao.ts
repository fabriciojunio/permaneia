// Ingestão de documentos institucionais no índice vetorial.

import { gerarEmbeddingsComFallback, origemAtual, type OrigemResposta } from "@/lib/ia";
import { criarDocumentoComTrechos } from "@/lib/repositorios/documento";
import { logger } from "@/lib/logger";
import { dividirEmTrechos, dividirPorUnidade, TAMANHO_ALVO, SOBREPOSICAO } from "./chunk";

export type ResultadoIngestao = {
  documentoId: string;
  titulo: string;
  trechos: number;
  origemEmbedding: string;
  motivoFallback?: string;
};

export type EntradaIngestao = {
  disciplinaId: string;
  titulo: string;
  referencia?: string;
  conteudo: string;
  origem: "upload" | "seed" | "texto";
  tamanhoAlvo?: number;
  sobreposicao?: number;
  /**
   * "corrido" divide por tamanho, com sobreposição, e serve a texto contínuo.
   * "unidade" faz um trecho por parágrafo, sem sobreposição, e serve a documento
   * que é lista de fatos independentes: cronograma, contrato, lista de materiais.
   * A escolha é sobre o FORMATO do documento, não sobre gosto de configuração.
   */
  modo?: "corrido" | "unidade";
};

/**
 * Divide o conteúdo, gera os vetores e grava tudo.
 *
 * A `referencia` é opcional no tipo, mas na prática é o campo mais importante
 * do documento: é a data ou a versão que a resposta vai citar. O maior risco
 * deste sistema não é inventar uma data, é repetir com confiança a data certa
 * de uma ementa do semestre passado. Citar a referência transfere ao leitor a
 * chance de perceber isso.
 */
/** Espera entre as tentativas de ingestão, em milissegundos. */
const ESPERAS_MS = [2_000, 6_000];

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Insiste com o provedor externo antes de aceitar o vetor local.
 *
 * O motivo é um defeito que aconteceu: numa carga de oito documentos seguidos,
 * o provedor recusou duas chamadas por excesso de requisições, o fallback
 * assumiu sem reclamar, e dois documentos foram para o índice com vetores de um
 * espaço diferente do resto. Como a busca filtra por origem do embedding, esses
 * dois documentos ficaram invisíveis para a busca vetorial: estavam gravados,
 * apareciam na lista de documentos da disciplina e não respondiam nada.
 *
 * Numa consulta de aluno, cair para o modo local é a decisão certa, porque ele
 * está esperando resposta. Numa ingestão não é: o resultado fica gravado, e o
 * custo de esperar alguns segundos é muito menor que o de um índice partido.
 */
async function gerarEmbeddingsComInsistencia(textos: string[]) {
  const desejada: OrigemResposta = origemAtual();
  let resultado = await gerarEmbeddingsComFallback(textos);

  for (const espera of ESPERAS_MS) {
    if (resultado.origem === desejada) return resultado;
    logger.warn("Embeddings caíram para o modo local durante a ingestão; tentando de novo", {
      motivo: resultado.motivoFallback,
      esperaMs: espera,
    });
    await esperar(espera);
    resultado = await gerarEmbeddingsComFallback(textos);
  }

  if (resultado.origem !== desejada) {
    logger.error("Ingestão concluída com origem de embedding diferente da esperada", {
      esperada: desejada,
      obtida: resultado.origem,
      motivo: resultado.motivoFallback,
    });
  }
  return resultado;
}

export async function ingerir(entrada: EntradaIngestao): Promise<ResultadoIngestao> {
  const trechos =
    entrada.modo === "unidade"
      ? dividirPorUnidade(entrada.conteudo, entrada.tamanhoAlvo ?? 1200)
      : dividirEmTrechos(
          entrada.conteudo,
          entrada.tamanhoAlvo ?? TAMANHO_ALVO,
          entrada.sobreposicao ?? SOBREPOSICAO
        );

  if (trechos.length === 0) {
    throw new Error("O documento não produziu nenhum trecho indexável. Confira se o arquivo tem texto extraível.");
  }

  const embeddings = await gerarEmbeddingsComInsistencia(trechos.map((t) => t.texto));
  if (embeddings.valor.length !== trechos.length) {
    throw new Error(
      `Foram gerados ${embeddings.valor.length} vetores para ${trechos.length} trechos. Ingestão cancelada.`
    );
  }

  const { documentoId } = await criarDocumentoComTrechos({
    disciplinaId: entrada.disciplinaId,
    titulo: entrada.titulo,
    referencia: entrada.referencia,
    origem: entrada.origem,
    origemEmbedding: embeddings.origem,
    trechos: trechos.map((t, i) => ({
      indice: t.indice,
      texto: t.texto,
      embedding: embeddings.valor[i]!,
    })),
  });

  logger.info("Documento ingerido", {
    documentoId,
    disciplinaId: entrada.disciplinaId,
    titulo: entrada.titulo,
    trechos: trechos.length,
    origemEmbedding: embeddings.origem,
  });

  return {
    documentoId,
    titulo: entrada.titulo,
    trechos: trechos.length,
    origemEmbedding: embeddings.origem,
    ...(embeddings.motivoFallback ? { motivoFallback: embeddings.motivoFallback } : {}),
  };
}
