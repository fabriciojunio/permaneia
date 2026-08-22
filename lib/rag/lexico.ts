// Busca léxica, o segundo braço da recuperação.
//
// A busca vetorial sozinha tem duas falhas que apareceram em uso real:
//
//   1. Pergunta curta e genérica ("quando vai ser a prova") produz um vetor
//      pouco discriminante, e o trecho que traz a resposta fica atrás de
//      trechos genéricos sobre aulas. O termo "prova", que decide a questão,
//      pesa pouco num vetor de 768 dimensões e não pesa nada num limiar.
//   2. Quando o provedor externo cai, os vetores da pergunta passam a vir do
//      modo local e não conversam com os vetores do índice, que foram gerados
//      pelo Gemini. A busca devolve zero linhas e o assistente vira uma parede.
//
// O casamento exato de termos cobre os dois casos, e cobre sem depender de rede
// nem de cota. A pontuação é BM25, com a mesma tokenização do provedor local:
// acento normalizado, palavra vazia removida e radical aproximado, para que
// "avaliações" e "avaliação" caiam no mesmo termo.

import { radical, tokenizar } from "@/lib/ia/local";

/** Saturação de frequência do BM25. Valor usual da literatura. */
const K1 = 1.5;
/** Peso da normalização por tamanho do documento. Valor usual da literatura. */
const B = 0.75;

export type DocumentoLexico = {
  chunkId: string;
  texto: string;
};

export type AcertoLexico = {
  chunkId: string;
  /** Pontuação BM25, comparável apenas dentro da mesma consulta. */
  pontuacao: number;
  /** Fração dos termos de conteúdo da pergunta que o trecho contém, de 0 a 1. */
  cobertura: number;
  termosCasados: string[];
};

/** Termos de conteúdo da pergunta, já radicalizados e sem repetição. */
export function termosDaPergunta(pergunta: string): string[] {
  const vistos = new Set<string>();
  for (const token of tokenizar(pergunta)) vistos.add(radical(token));
  return [...vistos];
}

function termosDoTexto(texto: string): string[] {
  return tokenizar(texto).map(radical);
}

/**
 * Pontua os trechos contra a pergunta e devolve, ordenado, só o que casou.
 *
 * Trecho sem nenhum termo em comum não entra: a lista vazia é o que preserva a
 * recusa honesta quando a pergunta é sobre algo que o material não cobre.
 */
export function buscarPorTermos(pergunta: string, documentos: DocumentoLexico[]): AcertoLexico[] {
  const termos = termosDaPergunta(pergunta);
  if (termos.length === 0 || documentos.length === 0) return [];

  const tokenizados = documentos.map((d) => ({ chunkId: d.chunkId, termos: termosDoTexto(d.texto) }));
  const tamanhoMedio =
    tokenizados.reduce((soma, d) => soma + d.termos.length, 0) / Math.max(1, tokenizados.length);

  // Frequência documental de cada termo da pergunta, para o IDF.
  const emQuantos = new Map<string, number>();
  for (const termo of termos) {
    let n = 0;
    for (const doc of tokenizados) if (doc.termos.includes(termo)) n += 1;
    emQuantos.set(termo, n);
  }

  const total = tokenizados.length;
  const acertos: AcertoLexico[] = [];

  for (const doc of tokenizados) {
    const frequencia = new Map<string, number>();
    for (const t of doc.termos) frequencia.set(t, (frequencia.get(t) ?? 0) + 1);

    let pontuacao = 0;
    const casados: string[] = [];

    for (const termo of termos) {
      const tf = frequencia.get(termo) ?? 0;
      if (tf === 0) continue;
      casados.push(termo);

      const n = emQuantos.get(termo) ?? 0;
      // IDF do BM25 com a correção de meio ponto, que evita valor negativo
      // quando o termo aparece em mais da metade dos trechos.
      const idf = Math.log(1 + (total - n + 0.5) / (n + 0.5));
      const norma = 1 - B + (B * doc.termos.length) / Math.max(1, tamanhoMedio);
      pontuacao += idf * ((tf * (K1 + 1)) / (tf + K1 * norma));
    }

    if (casados.length === 0) continue;
    acertos.push({
      chunkId: doc.chunkId,
      pontuacao: Number(pontuacao.toFixed(4)),
      cobertura: Number((casados.length / termos.length).toFixed(4)),
      termosCasados: casados,
    });
  }

  return acertos.sort((a, b) => b.pontuacao - a.pontuacao || a.chunkId.localeCompare(b.chunkId));
}

/**
 * Cobertura mínima para um acerto puramente léxico entrar no contexto.
 *
 * Sem esse piso, a pergunta "qual é o valor da mensalidade do curso" casaria
 * "curso" com meia dúzia de trechos e o assistente responderia qualquer coisa
 * em vez de dizer que não tem a informação. Um único termo em comum não é
 * evidência de que o trecho responde à pergunta; metade dos termos é.
 */
export const COBERTURA_MINIMA = 0.5;

/** Acertos fortes o bastante para serem tratados como relevantes por si sós. */
export function acertosConfiaveis(acertos: AcertoLexico[], cobertura = COBERTURA_MINIMA): AcertoLexico[] {
  return acertos.filter((a) => a.pontuacao > 0 && a.cobertura >= cobertura && a.termosCasados.length >= 1);
}
