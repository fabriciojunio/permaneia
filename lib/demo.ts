// Modo demonstração.
//
// Ligado, libera uma entrada de vitrine com as contas de exemplo, para que o
// professor e a turma abram o sistema pelo link sem precisar de credencial. A
// base é inteiramente sintética (ver LGPD.md), então não há dado pessoal real
// exposto por essa porta.
//
// Desligado, a rota de acesso à demonstração responde 404, e não 403: 403
// confirmaria que a rota existe.

export const MODO_DEMO = process.env.DEMO_MODE === "on";

/** Contas de vitrine. As senhas são públicas de propósito e só valem no modo demonstração. */
export const CONTAS_DEMO = [
  {
    papel: "coordenacao" as const,
    email: "coordenacao@permaneia.exemplo",
    descricao: "Painel de risco de evasão, com os 30 alunos sintéticos",
  },
  {
    papel: "aluno" as const,
    email: "aluno@permaneia.exemplo",
    descricao: "Assistente de estudos, com o cronograma da disciplina indexado",
  },
];
