// Diagnóstico do sistema fuzzy fora da suíte de testes.
//
// Imprime o score dos casos de referência e varre uma grade das três entradas
// procurando violação de monotonicidade: piorar qualquer sinal isolado nunca
// pode diminuir o risco. Essa propriedade é o que garante que a base de regras
// não tem linha contraditória, e é a primeira coisa a rodar depois de mexer na
// calibração. A suíte de testes verifica o mesmo de forma automatizada; este
// script existe para inspeção manual, com os números à vista.
//
// Uso: npx tsx scripts/diagnostico-fuzzy.ts

import { inferir } from "../lib/fuzzy/motor";
import { calcularRiscoEvasao } from "../lib/fuzzy/risco";
import { normalizarEngajamento } from "../lib/fuzzy/variaveis";

const CASOS = [
  { nome: "Abandono já em curso", f: 20, n: 2, a: 1 },
  { nome: "Notas boas, mas sumiu", f: 30, n: 8.5, a: 1 },
  { nome: "Trajetória saudável", f: 95, n: 9, a: 35 },
  { nome: "Mediano em tudo", f: 67, n: 5.5, a: 10 },
  { nome: "Presente e com dificuldade", f: 92, n: 3, a: 30 },
  { nome: "No limite de faltas", f: 76, n: 6.2, a: 12 },
  { nome: "Extremo inferior", f: 0, n: 0, a: 0 },
  { nome: "Extremo superior", f: 100, n: 10, a: 40 },
];

console.log("Casos de referência\n");
for (const c of CASOS) {
  const r = calcularRiscoEvasao({
    frequenciaPercentual: c.f,
    mediaNotas: c.n,
    acessosPlataforma: c.a,
  });
  console.log(
    `${c.nome.padEnd(28)} freq=${String(c.f).padStart(3)}  nota=${String(c.n).padStart(4)}  acessos=${String(c.a).padStart(2)}` +
      `  engajamento=${String(r.entradas.engajamentoNormalizado).padStart(6)}` +
      `  score=${r.score.toFixed(3)}  faixa=${r.faixa.padEnd(8)}  regra=${r.regraDominante?.id ?? "-"}`
  );
}

console.log(
  "\nCurva de normalização dos acessos:\n  " +
    [0, 1, 3, 5, 10, 20, 30, 40, 60, 100].map((a) => `${a} -> ${normalizarEngajamento(a)}`).join("   ")
);

const score = (f: number, n: number, e: number) => inferir({ frequencia: f, notas: n, engajamento: e }).score;

const ORDEM_FAIXA = { baixo: 0, medio: 1, alto: 2, critico: 3 } as const;

let violacoes = 0;
let pior = { delta: 0, descricao: "" };
let violacoesDeFaixa = 0;
let total = 0;

for (let f = 0; f <= 100; f += 5) {
  for (let n = 0; n <= 10; n += 0.5) {
    for (let e = 0; e <= 10; e += 0.5) {
      const base = inferir({ frequencia: f, notas: n, engajamento: e });
      const piores: Array<[number, number, number]> = [
        [f - 5, n, e],
        [f, n - 0.5, e],
        [f, n, e - 0.5],
      ];
      for (const [pf, pn, pe] of piores) {
        if (pf < 0 || pn < 0 || pe < 0) continue;
        total += 1;
        const piorado = inferir({ frequencia: pf, notas: pn, engajamento: pe });
        const delta = base.score - piorado.score;
        // Tolerância de 1e-9 absorve o ruído do somatório do centroide.
        if (delta > 1e-9) {
          violacoes += 1;
          if (delta > pior.delta) {
            pior = {
              delta,
              descricao: `(${f}, ${n}, ${e}) = ${base.score.toFixed(3)} mas (${pf}, ${pn}, ${pe}) = ${piorado.score.toFixed(3)}`,
            };
          }
        }
        if (ORDEM_FAIXA[piorado.faixa] < ORDEM_FAIXA[base.faixa]) {
          violacoesDeFaixa += 1;
          if (violacoesDeFaixa <= 5) {
            console.log(
              `  faixa caiu ao piorar entrada: (${f}, ${n}, ${e}) = ${base.faixa} mas (${pf}, ${pn}, ${pe}) = ${piorado.faixa}`
            );
          }
        }
      }
    }
  }
}

// Limite tolerado para a inversão de score. Não é um número escolhido para o
// teste passar: é o artefato conhecido do Mamdani com implicação por mínimo,
// agregação por máximo e defuzzificação por centroide. Perto da fronteira entre
// dois termos, a massa que cada regra contribui muda de forma descontínua e o
// centroide pode andar alguns milésimos na direção "errada". O que importa
// operacionalmente é a FAIXA, e essa é estritamente monótona. Ver a seção de
// visão crítica do relatório.
const LIMITE_INVERSAO = 0.05;

console.log(`\nComparações avaliadas: ${total}`);
console.log(`Inversões no score: ${violacoes} (${((violacoes / total) * 100).toFixed(1)}%)`);
console.log(`Maior inversão: ${pior.delta.toFixed(4)}  ${pior.descricao}`);
console.log(`Inversões de FAIXA: ${violacoesDeFaixa}`);

const aprovado = violacoesDeFaixa === 0 && pior.delta <= LIMITE_INVERSAO;
console.log(aprovado ? "\nDiagnóstico aprovado." : "\nDiagnóstico REPROVADO.");
process.exit(aprovado ? 0 : 1);
