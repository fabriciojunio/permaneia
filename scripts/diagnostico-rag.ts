// Inspeciona a recuperação do RAG sem o filtro de relevância.
//
// Responde à pergunta que a avaliação sozinha não responde: quando o sistema
// erra, ele recuperou o trecho errado ou recuperou o certo e o descartou no
// limiar? São defeitos diferentes, com correções diferentes.
//
// Uso: npx tsx scripts/diagnostico-rag.ts "sua pergunta"

import "./_carregar-env";
import { prisma } from "../lib/prisma";
import { gerarEmbeddingComFallback } from "../lib/ia";
import { buscarTrechosSimilares } from "../lib/repositorios/documento";
import { resumir } from "../lib/formato";

const PERGUNTAS_PADRAO = [
  "Quando é a Prova P1?",
  "Qual é o limite de faltas da disciplina?",
  "Quanto vale o quiz na nota?",
  "Em que aula o professor vai dar lógica fuzzy?",
  "Como faço para trancar a matrícula?",
];

async function main(): Promise<void> {
  const perguntas = process.argv.slice(2);
  const lista = perguntas.length > 0 ? perguntas : PERGUNTAS_PADRAO;

  const disciplina = await prisma.disciplina.findFirst({
    where: { nome: { contains: "Inteligência Artificial" } },
    select: { id: true, nome: true },
  });
  if (!disciplina) throw new Error("Disciplina não encontrada. Rode o seed antes.");

  const totalChunks = await prisma.documentoChunk.count({ where: { disciplinaId: disciplina.id } });
  console.log(`Disciplina: ${disciplina.nome} | ${totalChunks} trecho(s) indexado(s)\n`);

  for (const pergunta of lista) {
    const embedding = await gerarEmbeddingComFallback(pergunta);
    const trechos = await buscarTrechosSimilares(disciplina.id, embedding.valor, embedding.origem, 3);

    console.log(`> ${pergunta}   [provedor: ${embedding.origem}]`);
    for (const t of trechos) {
      console.log(`   ${t.similaridade.toFixed(3)}  [${t.titulo} #${t.indice}]  ${resumir(t.texto, 130)}`);
    }
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error("Falhou:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
