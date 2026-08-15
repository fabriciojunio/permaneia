// Similaridade entre vetores e o limiar de recuperação.
//
// Em produção a busca roda no pgvector, dentro do Postgres, com o operador de
// distância de cosseno. As funções aqui servem a três coisas: aos testes, ao
// provedor local em execução sem banco, e à checagem do limiar, que é decisão
// de domínio e não de infraestrutura.

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

/**
 * Similaridade de cosseno, de -1 a 1. Vetor nulo devolve 0: sem direção, não há
 * ângulo, e 0 é a leitura correta de "nenhuma relação" para quem consome.
 */
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

/**
 * Converte a distância de cosseno do pgvector (operador `<=>`, de 0 a 2) na
 * similaridade de 0 a 1 usada no resto do sistema.
 */
export function distanciaParaSimilaridade(distancia: number): number {
  return Math.min(1, Math.max(-1, 1 - distancia));
}

/**
 * Similaridade mínima para um trecho ser considerado relevante.
 *
 * É o parâmetro que decide entre responder e admitir que não sabe, e por isso é
 * o mais importante do sistema inteiro para o objetivo do projeto. Baixo
 * demais, o modelo recebe contexto irrelevante e passa a inventar em cima dele,
 * que é exatamente o que o RAG deveria evitar. Alto demais, o sistema diz "não
 * sei" para pergunta que o documento responde, e o aluno para de usar.
 *
 * O limiar é POR PROVEDOR, e isso não é um detalhe de implementação.
 *
 * Os dois espaços de embedding têm geometrias diferentes. O text-embedding-004
 * é treinado com objetivo de recuperação: a pergunta e o trecho que a responde
 * são deliberadamente aproximados, e a similaridade de um par relevante fica
 * na casa de 0,6 a 0,8. O provedor local é um saco de palavras projetado por
 * hashing, sem treino nenhum: ali a similaridade entre uma pergunta de cinco
 * palavras e um trecho de duzentas é limitada pela própria aritmética do
 * cosseno, e um par plenamente relevante raramente passa de 0,35.
 *
 * Usar um número só para os dois significaria, na prática, desligar o
 * assistente em um dos modos. Os valores abaixo saíram da execução de
 * `scripts/avaliar-rag.ts`, que separa perguntas que o material responde das
 * que ele não responde e mede cobertura e recusa em cada limiar.
 */
export const LIMIARES: Record<"gemini" | "local", number> = {
  gemini: 0.62,
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
 * Aplica o limiar sobre os trechos já ordenados por similaridade.
 *
 * Quando nada passa do limiar, devolve lista vazia, e é isso que faz o sistema
 * responder "não encontrei no material". A decisão de admitir ignorância mora
 * aqui, e não no prompt: depender só da instrução ao modelo seria confiar a
 * garantia mais importante do sistema a algo que o modelo pode desobedecer.
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
 * Remove trechos praticamente idênticos, que aparecem quando a sobreposição do
 * chunking faz o mesmo parágrafo cair em dois vetores vizinhos. Sem isso, o
 * contexto enviado ao modelo gasta metade do espaço repetindo a mesma frase.
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
