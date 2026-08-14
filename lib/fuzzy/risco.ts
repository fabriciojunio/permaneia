// Fachada do sistema fuzzy para o resto da aplicação.
//
// O motor trabalha com engajamento já normalizado de 0 a 10; o banco guarda o
// número bruto de acessos. É aqui que essa tradução acontece, junto com a
// montagem do detalhamento que a tela de explicação e o relatório consomem.

import { inferir, type ResultadoFuzzy } from "./motor";
import { normalizarEngajamento, type TermoRisco } from "./variaveis";

export type DadosMatricula = {
  frequenciaPercentual: number;
  mediaNotas: number;
  acessosPlataforma: number;
};

export type DetalheRisco = {
  score: number;
  faixa: TermoRisco;
  entradas: {
    frequenciaPercentual: number;
    mediaNotas: number;
    acessosPlataforma: number;
    engajamentoNormalizado: number;
  };
  fuzzificacao: ResultadoFuzzy["fuzzificacao"];
  regrasDisparadas: ResultadoFuzzy["regrasDisparadas"];
  /** Regra de maior força, que é a explicação principal mostrada à coordenação. */
  regraDominante: ResultadoFuzzy["regrasDisparadas"][number] | null;
  /** Ação sugerida à coordenação, derivada da faixa. */
  acaoSugerida: string;
  calculadoEm: string;
};

const ACOES: Record<TermoRisco, string> = {
  baixo: "Nenhuma ação necessária. Manter no acompanhamento regular da turma.",
  medio: "Observar no próximo ciclo. Vale uma mensagem de rotina perguntando como está o semestre.",
  alto: "Contatar o aluno nesta semana. Identificar o que mudou antes que a nota acompanhe a queda.",
  critico: "Acionar hoje. Caso para conversa individual com a coordenação e oferta formal de apoio.",
};

/** Rótulo legível da faixa, para tela e relatório. */
export const ROTULO_FAIXA: Record<TermoRisco, string> = {
  baixo: "Risco baixo",
  medio: "Risco médio",
  alto: "Risco alto",
  critico: "Risco crítico",
};

/** Limite inferior de cada faixa no score defuzzificado, usado só para documentação e legenda. */
export const LIMITES_FAIXA: Record<TermoRisco, number> = {
  baixo: 0,
  medio: 0.3,
  alto: 0.55,
  critico: 0.8,
};

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

/**
 * Calcula o risco de evasão de uma matrícula e devolve o detalhamento completo.
 *
 * Entradas fora da faixa são presas ao universo em vez de rejeitadas: dado
 * acadêmico chega com arredondamento e com o eventual 100,01 vindo de planilha,
 * e derrubar o cálculo da turma inteira por causa disso seria pior do que
 * tratar o valor como o extremo mais próximo.
 */
export function calcularRiscoEvasao(dados: DadosMatricula): DetalheRisco {
  const frequencia = Number.isFinite(dados.frequenciaPercentual) ? dados.frequenciaPercentual : 0;
  const notas = Number.isFinite(dados.mediaNotas) ? dados.mediaNotas : 0;
  const acessos = Number.isFinite(dados.acessosPlataforma) ? Math.max(0, dados.acessosPlataforma) : 0;
  const engajamento = normalizarEngajamento(acessos);

  const resultado = inferir({ frequencia, notas, engajamento });

  return {
    score: resultado.score,
    faixa: resultado.faixa,
    entradas: {
      frequenciaPercentual: arredondar(Math.min(100, Math.max(0, frequencia)), 2),
      mediaNotas: arredondar(Math.min(10, Math.max(0, notas)), 2),
      acessosPlataforma: Math.trunc(acessos),
      engajamentoNormalizado: engajamento,
    },
    fuzzificacao: resultado.fuzzificacao,
    regrasDisparadas: resultado.regrasDisparadas,
    regraDominante: resultado.regrasDisparadas[0] ?? null,
    acaoSugerida: ACOES[resultado.faixa],
    calculadoEm: new Date().toISOString(),
  };
}

/**
 * Compara o risco fuzzy com o critério ingênuo usado hoje na maioria das
 * instituições: olhar só a média de notas. A diferença entre os dois é o
 * argumento central da visão crítica do relatório, então ela é calculada pelo
 * código, e não estimada no texto.
 */
export function compararComCriterioPorNota(dados: DadosMatricula): {
  scoreFuzzy: number;
  faixaFuzzy: TermoRisco;
  criterioPorNota: "em risco" | "sem risco";
  divergem: boolean;
} {
  const detalhe = calcularRiscoEvasao(dados);
  // O critério ingênuo é o da secretaria: abaixo da média de aprovação, em risco.
  const criterioPorNota = dados.mediaNotas < 6 ? "em risco" : "sem risco";
  const fuzzyAlerta = detalhe.faixa === "alto" || detalhe.faixa === "critico";
  const notaAlerta = criterioPorNota === "em risco";

  return {
    scoreFuzzy: detalhe.score,
    faixaFuzzy: detalhe.faixa,
    criterioPorNota,
    divergem: fuzzyAlerta !== notaAlerta,
  };
}
