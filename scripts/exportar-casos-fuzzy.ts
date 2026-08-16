// Exporta uma grade de casos do sistema fuzzy em CSV.
//
// Existe para uma finalidade específica: permitir validação cruzada contra uma
// implementação de referência. O ADR 002 registra que o motor foi escrito do
// zero e que a ausência dessa validação é uma limitação conhecida. Este script
// é o primeiro passo para resolvê-la.
//
// O CSV gerado pode ser lido por um script em Python que rode a mesma grade com
// `scikit-fuzzy` e compare os scores coluna a coluna.
//
// Uso: npm run fuzzy:comparar > casos-fuzzy.csv

import { inferir } from "../lib/fuzzy/motor";
import { normalizarEngajamento } from "../lib/fuzzy/variaveis";

const PASSO_FREQUENCIA = 10;
const PASSO_NOTAS = 1;
const PASSO_ENGAJAMENTO = 1;

function main(): void {
  console.log("frequencia,media_notas,engajamento,score,faixa,regras_disparadas,regra_dominante");

  for (let f = 0; f <= 100; f += PASSO_FREQUENCIA) {
    for (let n = 0; n <= 10; n += PASSO_NOTAS) {
      for (let e = 0; e <= 10; e += PASSO_ENGAJAMENTO) {
        const r = inferir({ frequencia: f, notas: n, engajamento: e });
        console.log(
          [f, n, e, r.score.toFixed(4), r.faixa, r.regrasDisparadas.length, r.regrasDisparadas[0]?.id ?? ""].join(",")
        );
      }
    }
  }

  // A curva de normalização também precisa ser comparada: ela é nossa, e não
  // faz parte do método de Mamdani.
  process.stderr.write("\nCurva de normalização de acessos (para conferência):\n");
  for (const acessos of [0, 1, 3, 5, 10, 20, 30, 40, 60]) {
    process.stderr.write(`  ${String(acessos).padStart(3)} acessos -> ${normalizarEngajamento(acessos)}\n`);
  }
}

main();
