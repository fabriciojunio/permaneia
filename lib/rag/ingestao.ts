// Ingestão de documentos institucionais no índice vetorial.

import { gerarEmbeddingsComFallback } from "@/lib/ia";
import { criarDocumentoComTrechos } from "@/lib/repositorios/documento";
import { logger } from "@/lib/logger";
import { dividirEmTrechos, TAMANHO_ALVO, SOBREPOSICAO } from "./chunk";

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
export async function ingerir(entrada: EntradaIngestao): Promise<ResultadoIngestao> {
  const trechos = dividirEmTrechos(
    entrada.conteudo,
    entrada.tamanhoAlvo ?? TAMANHO_ALVO,
    entrada.sobreposicao ?? SOBREPOSICAO
  );

  if (trechos.length === 0) {
    throw new Error("O documento não produziu nenhum trecho indexável. Confira se o arquivo tem texto extraível.");
  }

  const embeddings = await gerarEmbeddingsComFallback(trechos.map((t) => t.texto));
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
