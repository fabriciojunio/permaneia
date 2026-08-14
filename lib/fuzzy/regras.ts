// Base de regras do sistema de risco de evasão.
//
// A base é FATORIAL COMPLETA: as três variáveis de entrada têm três termos
// cada, então existem 3 x 3 x 3 = 27 combinações e todas as 27 estão escritas
// aqui. Isso não é excesso de zelo, é uma garantia: com a base completa, nenhum
// par (frequência, notas, engajamento) cai num vazio da base, e a saída nunca
// depende de uma defuzzificação sobre agregação vazia. O teste
// `regras.test.ts` verifica essa completude e falha se alguém remover uma linha.
//
// Como as regras foram calibradas
// -------------------------------
// O ponto de partida foi uma soma ponderada dos três sinais, com pesos que
// refletem o que a literatura sobre evasão descreve: a presença é o sinal mais
// forte, o engajamento vem logo atrás e a nota é o indicador que chega por
// último, quando o aluno já decidiu sair. Depois disso a tabela foi revisada
// linha a linha e ajustada onde o número contrariava o bom senso pedagógico.
// O ADR 002 registra a calibração e os casos revisados manualmente.
//
// As quatro regras exigidas na especificação do projeto estão marcadas com
// `destaque: true` e são verificadas por teste dedicado.

import type { TermoEngajamento, TermoFrequencia, TermoNotas, TermoRisco } from "./variaveis";

export type Regra = {
  /** Identificador estável, usado no log de decisão e na tela de explicação. */
  id: number;
  se: {
    frequencia: TermoFrequencia;
    notas: TermoNotas;
    engajamento: TermoEngajamento;
  };
  entao: TermoRisco;
  /** Peso da regra na agregação. Toda regra vale 1 nesta versão; o campo existe para permitir recalibração sem mudar o motor. */
  peso: number;
  /** Marca as regras citadas nominalmente na especificação do trabalho. */
  destaque?: boolean;
  /** Justificativa em linguagem natural, exibida na tela de explicação do score. */
  porque: string;
};

function r(
  id: number,
  frequencia: TermoFrequencia,
  notas: TermoNotas,
  engajamento: TermoEngajamento,
  entao: TermoRisco,
  porque: string,
  destaque = false
): Regra {
  return { id, se: { frequencia, notas, engajamento }, entao, peso: 1, porque, destaque };
}

export const BASE_DE_REGRAS: ReadonlyArray<Regra> = [
  // ---- Frequência baixa: o aluno já parou de vir ----
  r(1, "baixa", "baixa", "baixo", "critico",
    "Os três sinais estão no pior patamar ao mesmo tempo. É o perfil clássico de abandono já em curso.", true),
  r(2, "baixa", "baixa", "medio", "critico",
    "Sem presença e sem nota, um uso moderado da plataforma não compensa: o vínculo com a disciplina já se rompeu."),
  r(3, "baixa", "baixa", "alto", "critico",
    "Mesmo acessando bastante a plataforma, quem não vem às aulas e não tem nota está em situação crítica. O acesso aqui costuma ser tentativa tardia de recuperar o que já se perdeu."),
  r(4, "baixa", "media", "baixo", "critico",
    "Presença e engajamento no chão, com nota apenas mediana. A nota é o último indicador a cair e vai acompanhar."),
  r(5, "baixa", "media", "medio", "alto",
    "A ausência nas aulas é o problema dominante; nota e engajamento medianos seguram o caso fora do crítico, mas exigem contato."),
  r(6, "baixa", "media", "alto", "alto",
    "O aluno sumiu da sala mas continua na plataforma. Vale entender o que impede a presença antes que a nota caia."),
  r(7, "baixa", "alta", "baixo", "alto",
    "Notas boas, mas frequência e engajamento em queda. Este é o caso central do projeto: um critério baseado só em nota classificaria este aluno como tranquilo, e ele não está.", true),
  r(8, "baixa", "alta", "medio", "alto",
    "Bom desempenho não anula a ausência sistemática das aulas; o histórico apenas atrasa o efeito na média."),
  r(9, "baixa", "alta", "alto", "medio",
    "Aluno com nota alta e plataforma ativa, mas ausente da sala. Merece acompanhamento, sem urgência."),

  // ---- Frequência média: o limite de 25% de faltas se aproxima ----
  r(10, "media", "baixa", "baixo", "critico",
    "Nota baixa somada a engajamento baixo, com presença já no limite. A reprovação por nota e por falta se aproximam juntas."),
  r(11, "media", "baixa", "medio", "alto",
    "Desempenho ruim com presença apertada. Sem intervenção pedagógica, tende a virar reprovação."),
  r(12, "media", "baixa", "alto", "medio",
    "O aluno está tentando: acessa a plataforma com constância. A nota baixa parece dificuldade de conteúdo, não desinteresse."),
  r(13, "media", "media", "baixo", "alto",
    "Tudo mediano e o engajamento caindo. O afastamento da plataforma é o que puxa o caso para cima."),
  r(14, "media", "media", "medio", "medio",
    "Situação mediana em todas as frentes. Merece observação no próximo ciclo, sem alarme.", true),
  r(15, "media", "media", "alto", "medio",
    "Presença e nota medianas, mas plataforma ativa. O engajamento indica vínculo preservado."),
  r(16, "media", "alta", "baixo", "alto",
    "Notas boas escondem o desligamento: presença apertada e plataforma abandonada são sinal precoce."),
  r(17, "media", "alta", "medio", "medio",
    "Desempenho bom com presença no limite. Vale um alerta sobre o teto de faltas."),
  r(18, "media", "alta", "alto", "baixo",
    "Bom desempenho e plataforma ativa compensam a presença apenas mediana."),

  // ---- Frequência alta: o aluno está na sala ----
  r(19, "alta", "baixa", "baixo", "alto",
    "O aluno vem às aulas, mas não aprende e não usa o material. Risco de reprovação por nota, que costuma anteceder a evasão."),
  r(20, "alta", "baixa", "medio", "medio",
    "Presença garantida e alguma busca por material, com nota baixa. É caso de apoio de conteúdo."),
  r(21, "alta", "baixa", "alto", "medio",
    "Aluno presente e engajado que ainda assim vai mal. Dificuldade de aprendizagem, não de permanência."),
  r(22, "alta", "media", "baixo", "medio",
    "Presença boa e nota suficiente, mas plataforma abandonada. O sinal fraco vale registro."),
  r(23, "alta", "media", "medio", "medio",
    "Perfil regular sem sinal de alarme, mas também sem folga."),
  r(24, "alta", "media", "alto", "baixo",
    "Presença alta, plataforma ativa e nota suficiente. Trajetória saudável."),
  r(25, "alta", "alta", "baixo", "medio",
    "Vai bem em tudo, mas parou de acessar a plataforma. Sozinho o sinal é fraco; acumulado com outros, não é."),
  r(26, "alta", "alta", "medio", "baixo",
    "Trajetória sólida, com uso moderado da plataforma."),
  r(27, "alta", "alta", "alto", "baixo",
    "Os três sinais no melhor patamar. Nenhuma ação necessária.", true),
];

/** As quatro regras citadas nominalmente na especificação do trabalho. */
export function regrasEmDestaque(): ReadonlyArray<Regra> {
  return BASE_DE_REGRAS.filter((regra) => regra.destaque === true);
}
