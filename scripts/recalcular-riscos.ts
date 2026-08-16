// Recalcula o score de risco de todas as matrículas.
//
// Rode isto sempre que mexer na calibração dos conjuntos fuzzy ou na base de
// regras. Sem recalcular, o painel continua exibindo scores da calibração
// antiga ao lado de uma explicação que já mudou, e ninguém percebe.
//
// Uso: npm run db:recalcular

import "./_carregar-env";
import { prisma } from "../lib/prisma";
import { recalcularTodas } from "../lib/repositorios/matricula";
import { BASE_DE_REGRAS } from "../lib/fuzzy/regras";

async function main(): Promise<void> {
  console.log(`Base de regras em vigor: ${BASE_DE_REGRAS.length} regras.\n`);

  const inicio = Date.now();
  const { processadas, porFaixa } = await recalcularTodas();
  const duracao = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log(`Matrículas recalculadas: ${processadas} em ${duracao}s\n`);
  console.log("Distribuição por faixa:");
  for (const [faixa, total] of Object.entries(porFaixa)) {
    const percentual = processadas === 0 ? 0 : (total / processadas) * 100;
    const barra = "#".repeat(Math.round(percentual / 2));
    console.log(`  ${faixa.padEnd(8)} ${String(total).padStart(4)}  ${percentual.toFixed(1).padStart(5)}%  ${barra}`);
  }

  const precisamDeContato = (porFaixa.alto ?? 0) + (porFaixa.critico ?? 0);
  console.log(`\nAlunos que precisam de contato: ${precisamDeContato}`);
}

main()
  .catch((e) => {
    console.error("Recálculo falhou:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
