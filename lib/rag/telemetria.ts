// Agregação da telemetria do assistente.
//
// O registro por consulta já existia e servia para depurar uma pergunta
// específica. O que faltava era a visão de conjunto, que responde outras
// perguntas: o assistente está degradando para o modo extrativo com que
// frequência, a latência piorou, quanto custou a semana, e qual fatia das
// perguntas o acervo não responde.
//
// Duas decisões de método:
//
// **Percentil, não média.** A média de latência de uma chamada a modelo de
// linguagem é dominada pelo caso comum e esconde a cauda, que é justamente onde
// o aluno desiste de esperar. O p95 é o número que diz como foi para quem teve
// azar.
//
// **A taxa de degradação é métrica de primeira classe.** Quando a cota do
// provedor acaba, o sistema continua respondendo pelo modo extrativo e nada
// falha: nenhum erro, nenhum alerta, resposta mais pobre. Sem esta linha, isso
// passaria semanas sem ninguém perceber.

import { prisma } from "@/lib/prisma";

export type ResumoDeTelemetria = {
  desde: string;
  consultas: number;
  latencia: { p50: number | null; p95: number | null };
  /** Fração das consultas em que o sistema disse que não achou no material. */
  taxaDeRecusa: number | null;
  /** Fração atendida pelo modo extrativo local, ou seja, o provedor externo não respondeu. */
  taxaDeDegradacao: number | null;
  tokens: { entrada: number; saida: number };
  custo: { totalUsd: number; porConsultaUsd: number | null; consultasComPreco: number };
  modelos: Array<{ modelo: string; consultas: number }>;
};

/** Percentil por posição, sem interpolação. Com dezenas de pontos, interpolar sugere precisão que a amostra não tem. */
export function percentil(valores: number[], fracao: number): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil(fracao * ordenados.length) - 1);
  // O `?? null` não é defensivo à toa: com `noUncheckedIndexedAccess` ligado, o
  // acesso por índice é `number | undefined` mesmo com o índice já limitado.
  return ordenados[Math.max(0, indice)] ?? null;
}

export async function resumir(dias = 30, agora = new Date()): Promise<ResumoDeTelemetria> {
  const desde = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);

  const consultas = await prisma.consultaRag.findMany({
    where: { criadoEm: { gte: desde } },
    select: {
      duracaoMs: true,
      admitiuNaoSaber: true,
      origemIa: true,
      modelo: true,
      tokensEntrada: true,
      tokensSaida: true,
      custoUsd: true,
    },
  });

  const total = consultas.length;
  const duracoes = consultas
    .map((c) => c.duracaoMs)
    .filter((d): d is number => typeof d === "number");

  const porModelo = new Map<string, number>();
  let entrada = 0;
  let saida = 0;
  let custo = 0;
  let comPreco = 0;
  let recusas = 0;
  let local = 0;

  for (const c of consultas) {
    if (c.admitiuNaoSaber) recusas += 1;
    if (c.origemIa === "local") local += 1;
    entrada += c.tokensEntrada ?? 0;
    saida += c.tokensSaida ?? 0;
    if (c.custoUsd !== null) {
      custo += Number(c.custoUsd);
      comPreco += 1;
    }
    if (c.modelo) porModelo.set(c.modelo, (porModelo.get(c.modelo) ?? 0) + 1);
  }

  return {
    desde: desde.toISOString(),
    consultas: total,
    latencia: { p50: percentil(duracoes, 0.5), p95: percentil(duracoes, 0.95) },
    taxaDeRecusa: total > 0 ? recusas / total : null,
    taxaDeDegradacao: total > 0 ? local / total : null,
    tokens: { entrada, saida },
    custo: {
      totalUsd: Number(custo.toFixed(6)),
      // Dividido pelas consultas COM preço conhecido, e não por todas: incluir
      // no denominador as que não têm preço faria o custo médio cair sozinho
      // toda vez que o alias do modelo mudasse.
      porConsultaUsd: comPreco > 0 ? Number((custo / comPreco).toFixed(6)) : null,
      consultasComPreco: comPreco,
    },
    modelos: [...porModelo.entries()]
      .map(([modelo, consultas]) => ({ modelo, consultas }))
      .sort((a, b) => b.consultas - a.consultas),
  };
}
