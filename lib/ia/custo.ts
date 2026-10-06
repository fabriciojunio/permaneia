// Custo estimado de uma chamada de geração.
//
// Por que estimado, e não medido: a fatura é do Google e o projeto roda no tier
// gratuito, então não existe um valor cobrado para conferir. O que existe é a
// contagem de tokens que a própria API devolve e uma tabela de preço publicada.
// Multiplicar os dois dá uma estimativa, e o documento de avaliação precisa
// dizer que é estimativa.
//
// Três decisões que valem explicar:
//
// 1. **Preço fica em tabela com data e fonte.** Preço de API muda, e já mudou
//    nesta durante 2026. Guardar a data da conferência é o que permite a alguém
//    olhar a estimativa de três meses atrás e saber se ela ainda vale.
//
// 2. **Modelo fora da tabela devolve custo nulo, não zero.** Zero diria "esta
//    chamada não custou nada", que é falso. Nulo diz "não sei o preço deste
//    modelo", que é o que de fato acontece quando o alias `-latest` passa a
//    apontar para uma versão nova.
//
// 3. **O token de raciocínio entra na saída.** Ele é cobrado como saída e não
//    aparece no texto devolvido. Ignorá-lo faria a estimativa sair sempre menor
//    do que a realidade, e justamente nos modelos mais caros.
//
// Fonte dos valores: https://ai.google.dev/gemini-api/docs/pricing
// Conferido em 06/10/2026.

import type { UsoDeTokens } from "./provedor";

export type PrecoDoModelo = {
  /** Dólares por milhão de tokens de entrada. */
  entrada: number;
  /** Dólares por milhão de tokens de saída, incluindo os de raciocínio. */
  saida: number;
};

/**
 * Preço por prefixo do nome do modelo, do mais específico para o mais genérico.
 * A ordem importa: `gemini-3.5-flash-lite` precisa ser testado antes de
 * `gemini-3` para não casar com a linha errada.
 */
export const TABELA_DE_PRECO: ReadonlyArray<readonly [string, PrecoDoModelo]> = [
  ["gemini-3.5-flash-lite", { entrada: 0.3, saida: 2.5 }],
  ["gemini-3.1-flash-lite", { entrada: 0.25, saida: 1.5 }],
  ["gemini-2.5-flash-lite", { entrada: 0.1, saida: 0.4 }],
  ["gemini-2.0-flash-lite", { entrada: 0.075, saida: 0.3 }],
];

export const DATA_DA_TABELA = "2026-10-06";

/** Preço do modelo, ou nulo quando ele não está na tabela. */
export function precoDe(modelo: string | null | undefined): PrecoDoModelo | null {
  if (!modelo) return null;
  const nome = modelo.toLowerCase();
  for (const [prefixo, preco] of TABELA_DE_PRECO) {
    if (nome.startsWith(prefixo)) return preco;
  }
  return null;
}

/**
 * Custo estimado em dólares, ou nulo quando falta preço ou consumo.
 *
 * O valor sai com seis casas porque uma pergunta deste assistente custa na casa
 * do milionésimo de dólar: arredondar para centavo transformaria toda a
 * telemetria em uma coluna de zeros.
 */
export function custoEstimadoUsd(
  modelo: string | null | undefined,
  uso: UsoDeTokens | null | undefined
): number | null {
  const preco = precoDe(modelo);
  if (!preco || !uso) return null;
  const valor = (uso.entrada * preco.entrada + uso.saida * preco.saida) / 1_000_000;
  return Number(valor.toFixed(6));
}
