// Fusão das duas recuperações: vetorial e léxica.
//
// O método é o Reciprocal Rank Fusion. Ele combina POSIÇÕES, e não pontuações:
// a similaridade de cosseno e o BM25 não vivem na mesma escala e somá-los
// exigiria uma normalização arbitrária que muda de sentido a cada corpus. A
// posição, ao contrário, significa a mesma coisa nas duas listas.

import type { TrechoRecuperado } from "./similaridade";

/**
 * Constante de amortecimento do RRF. Com 60, a diferença entre o 1º e o 2º
 * colocado pesa pouco mais que a diferença entre o 9º e o 10º, que é o
 * comportamento desejado: nenhuma das duas buscas é confiável o bastante para
 * que o topo dela decida sozinho.
 */
export const AMORTECIMENTO = 60;

export type OrigemRecuperacao = "vetorial" | "termos" | "ambos";

export type TrechoFundido = TrechoRecuperado & {
  origemRecuperacao: OrigemRecuperacao;
  /** Pontuação da fusão. Serve para ordenar e para depurar, não para o aluno. */
  pontuacaoFusao: number;
};

export type EntradaFusao = {
  /** Trechos que passaram do limiar de similaridade, na ordem da busca vetorial. */
  vetoriais: TrechoRecuperado[];
  /** Trechos com casamento de termos confiável, na ordem do BM25. */
  lexicos: TrechoRecuperado[];
  maximo?: number;
};

/**
 * Uma lista única, ordenada, sem repetição.
 *
 * O trecho que aparece nas duas listas sobe, e é isso que se quer: concordância
 * entre dois métodos independentes é o sinal mais forte que a recuperação tem.
 */
export function fundir({ vetoriais, lexicos, maximo = 8 }: EntradaFusao): TrechoFundido[] {
  const pontos = new Map<string, number>();
  const origens = new Map<string, Set<"vetorial" | "termos">>();
  const porId = new Map<string, TrechoRecuperado>();

  const acumular = (lista: TrechoRecuperado[], origem: "vetorial" | "termos"): void => {
    lista.forEach((trecho, posicao) => {
      const id = trecho.chunkId;
      pontos.set(id, (pontos.get(id) ?? 0) + 1 / (AMORTECIMENTO + posicao + 1));
      if (!origens.has(id)) origens.set(id, new Set());
      origens.get(id)!.add(origem);

      const existente = porId.get(id);
      // A similaridade medida vem da busca vetorial; o braço léxico não tem uma.
      // Quando o mesmo trecho vem pelos dois, fica a maior das duas, que é a
      // única que significa alguma coisa.
      if (!existente || trecho.similaridade > existente.similaridade) {
        porId.set(id, existente ? { ...existente, similaridade: trecho.similaridade } : trecho);
      }
    });
  };

  acumular(vetoriais, "vetorial");
  acumular(lexicos, "termos");

  const ordenados = [...pontos.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    // Empate desfeito pela similaridade, e depois pelo identificador, para que a
    // saída seja determinística e o teste possa afirmar a ordem.
    const sa = porId.get(a[0])?.similaridade ?? 0;
    const sb = porId.get(b[0])?.similaridade ?? 0;
    if (sb !== sa) return sb - sa;
    return a[0].localeCompare(b[0]);
  });

  return ordenados.slice(0, Math.max(1, maximo)).map(([id, pontuacao]) => {
    const conjunto = origens.get(id)!;
    const origem: OrigemRecuperacao =
      conjunto.size === 2 ? "ambos" : conjunto.has("vetorial") ? "vetorial" : "termos";
    return {
      ...porId.get(id)!,
      origemRecuperacao: origem,
      pontuacaoFusao: Number(pontuacao.toFixed(6)),
    };
  });
}
