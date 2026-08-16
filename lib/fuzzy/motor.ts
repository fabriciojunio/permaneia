// Mamdani implementado do zero, sem biblioteca, porque as quatro etapas são o
// conteúdo avaliado da disciplina: fuzzificação, disparo pelo mínimo, agregação
// pelo máximo e defuzzificação por centroide.
//
// Função pura, sem I/O e sem estado, o que permite cobrir a base inteira com
// teste de tabela. Ver ADR 002.

import { BASE_DE_REGRAS, type Regra } from "./regras";
import {
  ENGAJAMENTO,
  FREQUENCIA,
  NOTAS,
  RISCO,
  pertinencias,
  termo,
  type TermoRisco,
} from "./variaveis";

/** Entradas nítidas do sistema. */
export type EntradaFuzzy = {
  /** Presença em porcentagem, de 0 a 100. */
  frequencia: number;
  /** Média das avaliações, de 0 a 10. */
  notas: number;
  /** Engajamento já normalizado, de 0 a 10. Use `normalizarEngajamento` para converter acessos brutos. */
  engajamento: number;
};

export type RegraDisparada = {
  id: number;
  forca: number;
  entao: TermoRisco;
  porque: string;
  destaque: boolean;
};

export type ResultadoFuzzy = {
  /** Risco defuzzificado, de 0 a 1, arredondado a três casas. */
  score: number;
  /** Faixa nominal correspondente ao score, para o badge do dashboard. */
  faixa: TermoRisco;
  /** Grau de pertinência das entradas em cada termo, para a tela de explicação. */
  fuzzificacao: {
    frequencia: Record<"baixa" | "media" | "alta", number>;
    notas: Record<"baixa" | "media" | "alta", number>;
    engajamento: Record<"baixo" | "medio" | "alto", number>;
  };
  /** Regras que efetivamente dispararam, da mais forte para a mais fraca. */
  regrasDisparadas: RegraDisparada[];
  /** Recorte agregado por termo de saída, antes da defuzzificação. */
  agregado: Record<TermoRisco, number>;
};

/** Resolução da discretização do universo de saída no cálculo do centroide. */
export const PASSOS_DEFUZZIFICACAO = 1000;

/**
 * O conectivo "E" é o mínimo, norma T padrão de Mamdani. Mínimo e não produto:
 * a força fica atrelada ao antecedente mais fraco.
 */
export function forcaDeDisparo(
  regra: Regra,
  graus: ResultadoFuzzy["fuzzificacao"]
): number {
  const minimo = Math.min(
    graus.frequencia[regra.se.frequencia],
    graus.notas[regra.se.notas],
    graus.engajamento[regra.se.engajamento]
  );
  return minimo * regra.peso;
}

/**
 * Centroide sobre o universo discretizado. Ele leva em conta a área inteira do
 * conjunto agregado, então uma regra "crítico" fraca e uma "médio" forte
 * produzem score intermediário. A média dos máximos descartaria a regra fraca e
 * devolveria o degrau que o fuzzy existe para evitar.
 */
export function defuzzificarCentroide(agregado: Record<TermoRisco, number>): number {
  const inicio = RISCO.minimo;
  const fim = RISCO.maximo;
  const passo = (fim - inicio) / PASSOS_DEFUZZIFICACAO;

  let numerador = 0;
  let denominador = 0;

  for (let i = 0; i <= PASSOS_DEFUZZIFICACAO; i += 1) {
    const x = inicio + i * passo;
    // União dos consequentes recortados, ponto a ponto.
    let altura = 0;
    for (const t of RISCO.termos) {
      const corte = agregado[t.rotulo];
      if (corte <= 0) continue;
      const valor = Math.min(corte, t.pertinencia(x));
      if (valor > altura) altura = valor;
    }
    numerador += x * altura;
    denominador += altura;
  }

  // Área nula só ocorre se nenhuma regra disparar, o que a base fatorial
  // completa impede. Zero seria lido como "sem risco" e esconderia o defeito.
  if (denominador === 0) return (inicio + fim) / 2;
  return numerador / denominador;
}

/** Converte o score nítido na faixa nominal, pelo termo de maior pertinência no ponto. */
export function faixaDoScore(score: number): TermoRisco {
  let melhorRotulo: TermoRisco = RISCO.termos[0]!.rotulo;
  let melhorGrau = -1;
  for (const t of RISCO.termos) {
    const grau = t.pertinencia(score);
    // ">" estrito deixa o empate com o termo de menor risco: não se anuncia
    // "crítico" onde "alto" explica igualmente bem.
    if (grau > melhorGrau) {
      melhorGrau = grau;
      melhorRotulo = t.rotulo;
    }
  }
  return melhorRotulo;
}

/** A base é parâmetro para os testes exercitarem o motor com bases mínimas. */
export function inferir(
  entrada: EntradaFuzzy,
  base: ReadonlyArray<Regra> = BASE_DE_REGRAS
): ResultadoFuzzy {
  // Etapa 1: fuzzificação.
  const fuzzificacao = {
    frequencia: pertinencias(FREQUENCIA, entrada.frequencia),
    notas: pertinencias(NOTAS, entrada.notas),
    engajamento: pertinencias(ENGAJAMENTO, entrada.engajamento),
  };

  // Etapas 2 e 3: disparo das regras e agregação por máximo.
  const agregado: Record<TermoRisco, number> = { baixo: 0, medio: 0, alto: 0, critico: 0 };
  const regrasDisparadas: RegraDisparada[] = [];

  for (const regra of base) {
    const forca = forcaDeDisparo(regra, fuzzificacao);
    if (forca <= 0) continue;
    if (forca > agregado[regra.entao]) agregado[regra.entao] = forca;
    regrasDisparadas.push({
      id: regra.id,
      forca: Math.round(forca * 1000) / 1000,
      entao: regra.entao,
      porque: regra.porque,
      destaque: regra.destaque === true,
    });
  }

  regrasDisparadas.sort((a, b) => b.forca - a.forca || a.id - b.id);

  // Etapa 4: defuzzificação.
  const bruto = defuzzificarCentroide(agregado);
  const score = Math.round(bruto * 1000) / 1000;

  return {
    score,
    faixa: faixaDoScore(score),
    fuzzificacao,
    regrasDisparadas,
    agregado,
  };
}

/** Verifica se `termoExiste` está declarado na variável de saída. Usado pela validação da base. */
export function termoDeSaidaValido(rotulo: string): rotulo is TermoRisco {
  return RISCO.termos.some((t) => t.rotulo === rotulo);
}

/** Reexportado por conveniência para quem só quer o termo de saída. */
export { termo };
