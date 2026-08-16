// A busca roda no pgvector; estas funções servem aos testes, ao provedor local
// e à checagem do limiar, que é decisão de domínio e não de infraestrutura.

/** Produto escalar. Para vetores normalizados, é o próprio cosseno. */
export function produtoEscalar(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vetores de dimensões diferentes: ${a.length} e ${b.length}.`);
  }
  let soma = 0;
  for (let i = 0; i < a.length; i += 1) soma += a[i]! * b[i]!;
  return soma;
}

export function norma(v: number[]): number {
  let soma = 0;
  for (const x of v) soma += x * x;
  return Math.sqrt(soma);
}

/** Vetor nulo devolve 0: sem direção não há ângulo. */
export function cosseno(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vetores de dimensões diferentes: ${a.length} e ${b.length}.`);
  }
  const na = norma(a);
  const nb = norma(b);
  if (na === 0 || nb === 0) return 0;
  const bruto = produtoEscalar(a, b) / (na * nb);
  // Prende em [-1, 1]: acumulação de ponto flutuante às vezes devolve 1.0000000000000002.
  return Math.min(1, Math.max(-1, bruto));
}

/** Converte a distância do operador `<=>` do pgvector (0 a 2) em similaridade. */
export function distanciaParaSimilaridade(distancia: number): number {
  return Math.min(1, Math.max(-1, 1 - distancia));
}

/**
 * O parâmetro que decide entre responder e admitir que não sabe.
 *
 * É POR PROVEDOR porque os dois espaços de embedding têm geometrias diferentes:
 * o do Gemini é treinado para recuperação e aproxima o par relevante, enquanto o
 * local é um saco de palavras cuja similaridade é limitada pela aritmética do
 * cosseno. Um número só desligaria o assistente em um dos modos.
 *
 * Valores medidos por scripts/avaliar-rag.ts. Ver docs/AVALIACAO-RAG.md.
 */
export const LIMIARES: Record<"gemini" | "local", number> = {
  gemini: 0.65,
  local: 0.15,
};

/** Limiar padrão, usado quando o provedor não é informado. */
export const LIMIAR_RELEVANCIA = LIMIARES.local;

export function limiarDoProvedor(provedor: "gemini" | "local"): number {
  return LIMIARES[provedor];
}

/** Diferença mínima para tratar um trecho como claramente melhor que o seguinte. */
export const MARGEM_DOMINANCIA = 0.08;

export type TrechoRecuperado = {
  chunkId: string;
  documentoId: string;
  titulo: string;
  referencia: string | null;
  indice: number;
  texto: string;
  similaridade: number;
};

/**
 * Lista vazia é o que faz o sistema responder "não encontrei no material". A
 * decisão de admitir ignorância mora aqui, e não no prompt: depender só da
 * instrução seria confiá-la a algo que o modelo pode desobedecer.
 */
export function filtrarRelevantes(
  trechos: TrechoRecuperado[],
  limiar = LIMIAR_RELEVANCIA
): TrechoRecuperado[] {
  return trechos.filter((t) => t.similaridade >= limiar);
}

/** Maior similaridade da lista, ou 0 se ela estiver vazia. */
export function similaridadeMaxima(trechos: TrechoRecuperado[]): number {
  let maior = 0;
  for (const t of trechos) if (t.similaridade > maior) maior = t.similaridade;
  return maior;
}

/**
 * A sobreposição do chunking faz o mesmo parágrafo cair em dois vetores vizinhos;
 * sem isso o contexto gasta metade do espaço repetindo a mesma frase.
 */
export function removerRedundantes(
  trechos: TrechoRecuperado[],
  limiarRedundancia = 0.9
): TrechoRecuperado[] {
  const mantidos: TrechoRecuperado[] = [];
  for (const candidato of trechos) {
    const repetido = mantidos.some(
      (m) => m.documentoId === candidato.documentoId && sobreposicaoTextual(m.texto, candidato.texto) >= limiarRedundancia
    );
    if (!repetido) mantidos.push(candidato);
  }
  return mantidos;
}

/** Fração de palavras do texto menor que também aparecem no maior, de 0 a 1. */
export function sobreposicaoTextual(a: string, b: string): number {
  const pa = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const pb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (pa.size === 0 || pb.size === 0) return 0;
  const [menor, maior] = pa.size <= pb.size ? [pa, pb] : [pb, pa];
  let comuns = 0;
  for (const p of menor) if (maior.has(p)) comuns += 1;
  return comuns / menor.size;
}
