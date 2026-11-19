// Troca os documentos da turma de IA de quinta-feira na base que está no ar.
//
// O seed resolve a carga inicial, mas apaga tudo antes: alunos, matrículas e o
// histórico de perguntas feitas ao assistente. Para atualizar só o material,
// este script indexa cada documento de prisma/acervo-ia.ts e, só depois que a
// nova versão está gravada, remove as versões antigas de mesmo título. A ordem
// importa: entre uma coisa e outra o assistente responde com o material velho
// ou com os dois, nunca com nenhum.
//
// Se o embedding cair para o provedor local, a versão nova é descartada e a
// antiga fica: vetor no espaço errado deixa o documento invisível na busca.
//
// Uso:
//   npx tsx scripts/atualizar-acervo.ts            (mostra o que faria)
//   npx tsx scripts/atualizar-acervo.ts --aplicar  (grava)

import "./_carregar-env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../lib/prisma";
import { origemAtual } from "../lib/ia";
import { ingerir } from "../lib/rag/ingestao";
import { removerDocumento } from "../lib/repositorios/documento";
import { DOCUMENTOS_IA_QUINTA, TITULOS_RETIRADOS } from "../prisma/acervo-ia";

const NOME_DA_DISCIPLINA = "Inteligência Artificial - Quinta-feira";

/** A cota gratuita do provedor é por minuto; a pausa evita o índice partido. */
const PAUSA_ENTRE_DOCUMENTOS_MS = 12_000;

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const aplicar = process.argv.includes("--aplicar");
  const disciplina = await prisma.disciplina.findFirst({
    where: { nome: NOME_DA_DISCIPLINA },
    select: { id: true, nome: true },
  });
  if (!disciplina) throw new Error(`Disciplina "${NOME_DA_DISCIPLINA}" não encontrada.`);

  const existentes = await prisma.documento.findMany({
    where: { disciplinaId: disciplina.id },
    select: { id: true, titulo: true, totalChunks: true },
  });
  console.log(`${disciplina.nome}: ${existentes.length} documento(s) hoje.`);
  for (const d of existentes) console.log(`  ${d.titulo} (${d.totalChunks} trechos)`);

  if (!aplicar) {
    console.log("\nNada gravado. Rode com --aplicar para trocar os documentos abaixo:");
    for (const doc of DOCUMENTOS_IA_QUINTA) console.log(`  ${doc.titulo} <- ${doc.arquivo}`);
    for (const titulo of TITULOS_RETIRADOS) console.log(`  ${titulo} (sai do acervo)`);
    return;
  }

  const desejada = origemAtual();
  for (const [i, doc] of DOCUMENTOS_IA_QUINTA.entries()) {
    if (i > 0) await esperar(PAUSA_ENTRE_DOCUMENTOS_MS);
    const conteudo = readFileSync(resolve(process.cwd(), "data/documentos_exemplo", doc.arquivo), "utf8");
    const novo = await ingerir({
      disciplinaId: disciplina.id,
      titulo: doc.titulo,
      referencia: doc.referencia,
      conteudo,
      origem: "seed",
      modo: "unidade",
    });

    if (novo.origemEmbedding !== desejada) {
      await removerDocumento(novo.documentoId);
      console.log(`  ${doc.titulo}: provedor caiu para ${novo.origemEmbedding}; versão antiga mantida.`);
      process.exitCode = 1;
      continue;
    }

    const antigos = existentes.filter((d) => d.titulo === doc.titulo);
    for (const antigo of antigos) await removerDocumento(antigo.id);
    console.log(`  ${doc.titulo}: ${novo.trechos} trecho(s), ${antigos.length} versão(ões) antiga(s) removida(s).`);
  }

  for (const antigo of existentes.filter((d) => TITULOS_RETIRADOS.includes(d.titulo))) {
    await removerDocumento(antigo.id);
    console.log(`  ${antigo.titulo}: retirado do acervo.`);
  }
}

main()
  .catch((e) => {
    console.error("Atualização falhou:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
