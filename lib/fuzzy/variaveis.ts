// Variáveis linguísticas do sistema de risco de evasão.
//
// Cada variável tem um universo de discurso (a faixa numérica válida) e um
// conjunto de termos linguísticos ("baixa", "média", "alta"). Os termos se
// sobrepõem de propósito: é justamente a sobreposição que produz a gradação
// contínua do risco, em vez do degrau de um classificador binário.

import { construir, type FormaPertinencia, type FuncaoPertinencia } from "./pertinencia";

export type TermoVariavel<Rotulo extends string> = {
  rotulo: Rotulo;
  forma: FormaPertinencia;
  pertinencia: FuncaoPertinencia;
};

export type VariavelLinguistica<Rotulo extends string> = {
  nome: string;
  descricao: string;
  minimo: number;
  maximo: number;
  termos: ReadonlyArray<TermoVariavel<Rotulo>>;
};

function montar<Rotulo extends string>(
  nome: string,
  descricao: string,
  minimo: number,
  maximo: number,
  definicoes: ReadonlyArray<{ rotulo: Rotulo; forma: FormaPertinencia }>
): VariavelLinguistica<Rotulo> {
  return {
    nome,
    descricao,
    minimo,
    maximo,
    termos: definicoes.map((d) => ({ ...d, pertinencia: construir(d.forma) })),
  };
}

export type TermoFrequencia = "baixa" | "media" | "alta";
export type TermoNotas = "baixa" | "media" | "alta";
export type TermoEngajamento = "baixo" | "medio" | "alto";
export type TermoRisco = "baixo" | "medio" | "alto" | "critico";

/**
 * Frequência às aulas, em porcentagem. O contrato didático da disciplina limita
 * as faltas a 25%, então 75% é o ponto em que o aluno passa a correr risco
 * formal de reprovação: o termo "média" cobre exatamente a faixa em que ele
 * ainda está aprovado mas já se aproxima do limite.
 */
export const FREQUENCIA = montar<TermoFrequencia>(
  "frequencia_percentual",
  "Percentual de presença nas aulas da disciplina",
  0,
  100,
  [
    { rotulo: "baixa", forma: { tipo: "trapezoidal", pontos: [0, 0, 40, 60] } },
    { rotulo: "media", forma: { tipo: "trapezoidal", pontos: [50, 63, 72, 85] } },
    { rotulo: "alta", forma: { tipo: "trapezoidal", pontos: [80, 90, 100, 100] } },
  ]
);

/**
 * Média das notas, de 0 a 10. O corte de aprovação usual é 6,0, e o termo
 * "média" foi centrado logo abaixo dele para capturar o aluno que está no fio.
 */
export const NOTAS = montar<TermoNotas>(
  "media_notas",
  "Média das avaliações da disciplina, de 0 a 10",
  0,
  10,
  [
    { rotulo: "baixa", forma: { tipo: "trapezoidal", pontos: [0, 0, 3, 5] } },
    { rotulo: "media", forma: { tipo: "triangular", pontos: [4, 5.5, 7] } },
    { rotulo: "alta", forma: { tipo: "trapezoidal", pontos: [6.5, 8, 10, 10] } },
  ]
);

/**
 * Engajamento normalizado de 0 a 10, derivado dos acessos à plataforma. É a
 * variável que dá o sinal mais precoce: o aluno para de acessar semanas antes
 * de a nota cair, e meses antes de formalizar o trancamento.
 */
export const ENGAJAMENTO = montar<TermoEngajamento>(
  "engajamento",
  "Uso da plataforma normalizado de 0 a 10, derivado dos acessos registrados",
  0,
  10,
  [
    { rotulo: "baixo", forma: { tipo: "trapezoidal", pontos: [0, 0, 1.5, 3] } },
    { rotulo: "medio", forma: { tipo: "triangular", pontos: [2, 4, 6] } },
    { rotulo: "alto", forma: { tipo: "trapezoidal", pontos: [5, 7, 10, 10] } },
  ]
);

/**
 * Saída: risco de evasão de 0 a 1. Quatro termos, e não três, porque a
 * coordenação precisa separar "acompanhar" (alto) de "procurar hoje"
 * (crítico): a diferença entre os dois muda a ação, não só o rótulo.
 */
export const RISCO = montar<TermoRisco>(
  "risco_evasao",
  "Risco de evasão estimado, de 0 (nenhum) a 1 (máximo)",
  0,
  1,
  [
    { rotulo: "baixo", forma: { tipo: "trapezoidal", pontos: [0, 0, 0.1, 0.3] } },
    { rotulo: "medio", forma: { tipo: "triangular", pontos: [0.2, 0.4, 0.6] } },
    { rotulo: "alto", forma: { tipo: "triangular", pontos: [0.5, 0.675, 0.85] } },
    { rotulo: "critico", forma: { tipo: "trapezoidal", pontos: [0.75, 0.9, 1, 1] } },
  ]
);

/** Todas as variáveis de entrada, na ordem em que aparecem nas regras. */
export const VARIAVEIS_ENTRADA = [FREQUENCIA, NOTAS, ENGAJAMENTO] as const;

/** Busca o termo pelo rótulo; lança se o rótulo não existir, o que só acontece por erro de programação. */
export function termo<Rotulo extends string>(
  variavel: VariavelLinguistica<Rotulo>,
  rotulo: Rotulo
): TermoVariavel<Rotulo> {
  const encontrado = variavel.termos.find((t) => t.rotulo === rotulo);
  if (!encontrado) {
    throw new Error(`Termo "${rotulo}" não existe na variável "${variavel.nome}".`);
  }
  return encontrado;
}

/**
 * Grau de pertinência do valor em cada termo da variável, com o valor preso ao
 * universo antes de avaliar. Prender em vez de rejeitar é deliberado: um
 * percentual de 101 vindo de arredondamento da secretaria deve ser tratado como
 * 100, não derrubar o cálculo de risco da turma inteira.
 */
export function pertinencias<Rotulo extends string>(
  variavel: VariavelLinguistica<Rotulo>,
  valor: number
): Record<Rotulo, number> {
  const preso = Math.min(variavel.maximo, Math.max(variavel.minimo, valor));
  const resultado = {} as Record<Rotulo, number>;
  for (const t of variavel.termos) {
    resultado[t.rotulo] = t.pertinencia(preso);
  }
  return resultado;
}

/**
 * Converte o número bruto de acessos à plataforma no engajamento de 0 a 10.
 *
 * A curva é logarítmica porque a diferença entre 0 e 5 acessos no semestre diz
 * muito mais sobre o vínculo do aluno do que a diferença entre 60 e 65. O ponto
 * de saturação (`acessosParaMaximo`) representa o uso de um aluno que entra na
 * plataforma em toda semana letiva.
 */
export function normalizarEngajamento(acessos: number, acessosParaMaximo = 40): number {
  if (!Number.isFinite(acessos) || acessos <= 0) return 0;
  if (acessosParaMaximo <= 0) {
    throw new Error("acessosParaMaximo deve ser maior que zero.");
  }
  const bruto = (10 * Math.log1p(acessos)) / Math.log1p(acessosParaMaximo);
  return Math.min(10, Math.round(bruto * 1000) / 1000);
}
