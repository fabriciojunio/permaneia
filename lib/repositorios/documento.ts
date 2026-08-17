// Acesso aos documentos e à busca vetorial.
//
// A coluna `embedding` é do tipo `vector(768)` do pgvector, que o Prisma
// declara como `Unsupported`: ele cria e migra a coluna, mas não a lê nem a
// escreve pelo cliente tipado. Por isso as operações que tocam o vetor passam
// por SQL parametrizado. Parametrizado, e não interpolado: o vetor vira uma
// string e concatená-la na consulta seria injeção de SQL esperando acontecer.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TrechoRecuperado } from "@/lib/rag/similaridade";
import { distanciaParaSimilaridade } from "@/lib/rag/similaridade";
import type { OrigemResposta } from "@/lib/ia/provedor";

/** Serializa o vetor no literal que o pgvector aceita: "[0.1,0.2,...]". */
export function literalVetor(vetor: number[]): string {
  return `[${vetor.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
}

export type NovoDocumento = {
  disciplinaId: string;
  titulo: string;
  referencia?: string;
  origem: "upload" | "seed" | "texto";
  trechos: Array<{ indice: number; texto: string; embedding: number[] }>;
  origemEmbedding: OrigemResposta;
};

/**
 * Grava o documento e seus trechos numa transação.
 *
 * Transação porque um documento com metade dos trechos indexados é pior do que
 * documento nenhum: a busca passa a responder com base parcial e ninguém
 * percebe que falta conteúdo.
 */
export async function criarDocumentoComTrechos(dados: NovoDocumento): Promise<{ documentoId: string; trechos: number }> {
  return prisma.$transaction(async (tx) => {
    const documento = await tx.documento.create({
      data: {
        disciplinaId: dados.disciplinaId,
        titulo: dados.titulo,
        referencia: dados.referencia ?? null,
        origem: dados.origem,
        totalChunks: dados.trechos.length,
      },
    });

    for (const trecho of dados.trechos) {
      await tx.$executeRaw`
        INSERT INTO documento_chunks (id, documento_id, disciplina_id, indice, texto, embedding, origem_embedding, criado_em)
        VALUES (
          gen_random_uuid(),
          ${documento.id}::uuid,
          ${dados.disciplinaId}::uuid,
          ${trecho.indice},
          ${trecho.texto},
          ${literalVetor(trecho.embedding)}::vector,
          ${dados.origemEmbedding},
          now()
        )
      `;
    }

    return { documentoId: documento.id, trechos: dados.trechos.length };
  });
}

type LinhaBusca = {
  chunk_id: string;
  documento_id: string;
  titulo: string;
  referencia: string | null;
  indice: number;
  texto: string;
  distancia: number;
};

/**
 * Busca os trechos mais próximos da pergunta, dentro de uma disciplina.
 *
 * Dois filtros são obrigatórios e não opcionais:
 *
 *   disciplina_id     porque a promessa do produto é responder com o material
 *                     daquela disciplina. Sem ele, a pergunta sobre a P1 de
 *                     Inteligência Artificial recuperaria o cronograma de Teoria
 *                     dos Grafos e a resposta viria com a data errada.
 *   origem_embedding  porque vetores do Gemini e do provedor local vivem em
 *                     espaços diferentes. Comparar um com o outro produz um
 *                     número que parece uma similaridade e não significa nada.
 *
 * O operador `<=>` é a distância de cosseno do pgvector, de 0 (idêntico) a 2.
 */
export async function buscarTrechosSimilares(
  disciplinaId: string,
  embedding: number[],
  origemEmbedding: OrigemResposta,
  limite = 5
): Promise<TrechoRecuperado[]> {
  // O limite entra parametrizado e é preso a uma faixa sã: um k enorme não
  // melhora a resposta e infla o prompt enviado ao modelo.
  const k = Math.min(20, Math.max(1, Math.trunc(limite)));

  const linhas = await prisma.$queryRaw<LinhaBusca[]>`
    SELECT
      c.id            AS chunk_id,
      c.documento_id  AS documento_id,
      d.titulo        AS titulo,
      d.referencia    AS referencia,
      c.indice        AS indice,
      c.texto         AS texto,
      (c.embedding <=> ${literalVetor(embedding)}::vector) AS distancia
    FROM documento_chunks c
    JOIN documentos d ON d.id = c.documento_id
    WHERE c.disciplina_id = ${disciplinaId}::uuid
      AND c.origem_embedding = ${origemEmbedding}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${literalVetor(embedding)}::vector
    LIMIT ${k}
  `;

  return linhas.map((l) => ({
    chunkId: l.chunk_id,
    documentoId: l.documento_id,
    titulo: l.titulo,
    referencia: l.referencia,
    indice: l.indice,
    texto: l.texto,
    similaridade: Number(distanciaParaSimilaridade(Number(l.distancia)).toFixed(4)),
  }));
}

type LinhaTrecho = Omit<LinhaBusca, "distancia">;

/**
 * Todos os trechos de um documento, na ordem original.
 *
 * Existe para a pergunta abrangente: "qual é o conteúdo das aulas" não se
 * responde com os quatro trechos mais parecidos, porque cada trecho do
 * cronograma é uma aula e a resposta sairia falando de uma só. Aqui o
 * documento inteiro volta em ordem, e a numeração das aulas continua fazendo
 * sentido no contexto entregue ao modelo.
 */
export async function buscarTrechosDoDocumento(
  documentoId: string,
  limite = 40
): Promise<TrechoRecuperado[]> {
  const k = Math.min(60, Math.max(1, Math.trunc(limite)));

  const linhas = await prisma.$queryRaw<LinhaTrecho[]>`
    SELECT
      c.id            AS chunk_id,
      c.documento_id  AS documento_id,
      d.titulo        AS titulo,
      d.referencia    AS referencia,
      c.indice        AS indice,
      c.texto         AS texto
    FROM documento_chunks c
    JOIN documentos d ON d.id = c.documento_id
    WHERE c.documento_id = ${documentoId}::uuid
    ORDER BY c.indice ASC
    LIMIT ${k}
  `;

  return linhas.map((l) => ({
    chunkId: l.chunk_id,
    documentoId: l.documento_id,
    titulo: l.titulo,
    referencia: l.referencia,
    indice: l.indice,
    texto: l.texto,
    // Sem similaridade própria: estes trechos não vieram de uma comparação
    // vetorial, vieram por pertencerem ao documento que a comparação escolheu.
    similaridade: 0,
  }));
}

export async function listarDocumentosDaDisciplina(disciplinaId: string) {
  return prisma.documento.findMany({
    where: { disciplinaId },
    select: {
      id: true,
      titulo: true,
      referencia: true,
      origem: true,
      totalChunks: true,
      criadoEm: true,
    },
    orderBy: { criadoEm: "desc" },
  });
}

export async function removerDocumento(documentoId: string): Promise<boolean> {
  try {
    // Os trechos caem por cascata declarada no schema.
    await prisma.documento.delete({ where: { id: documentoId } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return false;
    throw e;
  }
}

/** Quantos trechos existem por origem de embedding. Alimenta o /api/health e a tela de status. */
export async function contarTrechosPorOrigem(): Promise<Record<string, number>> {
  const linhas = await prisma.$queryRaw<Array<{ origem_embedding: string; total: bigint }>>`
    SELECT origem_embedding, COUNT(*) AS total
    FROM documento_chunks
    GROUP BY origem_embedding
  `;
  const saida: Record<string, number> = {};
  for (const l of linhas) saida[l.origem_embedding] = Number(l.total);
  return saida;
}
