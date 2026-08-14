// Contrato único de acesso a IA generativa.
//
// A aplicação inteira fala com esta interface e nunca com um SDK de fornecedor.
// Existe um único provedor externo no MVP (Gemini), então a abstração não paga
// por si mesma em termos de flexibilidade imediata; ela paga por dois outros
// motivos, ambos concretos neste projeto:
//
//   1. o provedor local determinístico implementa a mesma interface, o que
//      mantém a aplicação funcionando em demonstração sem rede e sem chave;
//   2. os testes injetam um provedor falso e verificam o RAG inteiro sem
//      depender de cota, de latência ou de resposta não determinística.
//
// Ver ADR 003.

/** Dimensão dos vetores. Fixada pelo text-embedding-004 do Gemini; o provedor local produz o mesmo tamanho para que a coluna do banco não mude. */
export const DIMENSAO_EMBEDDING = 768;

export type OrigemResposta = "gemini" | "local";

export type RespostaGeracao = {
  texto: string;
  origem: OrigemResposta;
};

export type OpcoesGeracao = {
  /** Instrução de sistema. Separada do prompt para que o provedor a envie no campo próprio quando existir. */
  sistema?: string;
  /** Teto de tokens da resposta. Existe para conter custo e latência, não para truncar conteúdo útil. */
  maxTokens?: number;
  temperatura?: number;
};

export interface ProvedorIA {
  readonly nome: OrigemResposta;
  /** Indica se o provedor pode ser usado agora (chave presente, integração ligada). */
  disponivel(): boolean;
  /** Gera texto livre a partir do prompt. Deve lançar em falha, para o chamador decidir o fallback. */
  gerarTexto(prompt: string, opcoes?: OpcoesGeracao): Promise<RespostaGeracao>;
  /** Gera o vetor de um texto, sempre com `DIMENSAO_EMBEDDING` posições. */
  gerarEmbedding(texto: string): Promise<number[]>;
  /** Gera vetores em lote. A implementação padrão serializa, mas o provedor pode otimizar. */
  gerarEmbeddings(textos: string[]): Promise<number[][]>;
}

/** Erro de provedor, para o chamador distinguir falha de integração de erro de programação. */
export class ErroProvedorIA extends Error {
  readonly provedor: OrigemResposta;
  readonly recuperavel: boolean;

  constructor(provedor: OrigemResposta, mensagem: string, recuperavel = true) {
    super(mensagem);
    this.name = "ErroProvedorIA";
    this.provedor = provedor;
    this.recuperavel = recuperavel;
  }
}

/** Normaliza o vetor para norma 1, o que torna o produto escalar igual ao cosseno. */
export function normalizarVetor(vetor: number[]): number[] {
  let soma = 0;
  for (const v of vetor) soma += v * v;
  const norma = Math.sqrt(soma);
  if (norma === 0) return vetor.slice();
  return vetor.map((v) => v / norma);
}

/** Valida o formato do vetor antes de gravá-lo. Vetor com dimensão errada corrompe silenciosamente a busca. */
export function validarEmbedding(vetor: number[], provedor: OrigemResposta): number[] {
  if (vetor.length !== DIMENSAO_EMBEDDING) {
    throw new ErroProvedorIA(
      provedor,
      `Embedding com ${vetor.length} dimensões; o esperado é ${DIMENSAO_EMBEDDING}.`,
      false
    );
  }
  for (const v of vetor) {
    if (!Number.isFinite(v)) {
      throw new ErroProvedorIA(provedor, "Embedding contém valor não numérico.", false);
    }
  }
  return vetor;
}
