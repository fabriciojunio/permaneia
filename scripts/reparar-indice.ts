// Reindexa os trechos cujo vetor está no espaço errado.
//
// O problema que este script resolve é silencioso: a ingestão cai para o modo
// local quando o provedor externo recusa a chamada, e o trecho fica gravado com
// um vetor que a busca vetorial não compara com os outros, porque ela filtra
// por origem do embedding. O documento aparece na lista da disciplina, tem
// trechos, e mesmo assim não responde nada.
//
// A reindexação parte do TEXTO já guardado, e não do arquivo original: assim
// funciona também para documento que veio por upload e cujo arquivo ninguém
// tem mais.
//
// Uso: npx tsx scripts/reparar-indice.ts

import "./_carregar-env";
import { prisma } from "../lib/prisma";
import { gerarEmbeddingsComFallback, origemAtual } from "../lib/ia";
import {
  atualizarEmbeddingDoTrecho,
  contarTrechosPorOrigem,
  listarTrechosDeOutraOrigem,
} from "../lib/repositorios/documento";

/**
 * Lote pequeno e pausa entre eles.
 *
 * A cota gratuita do provedor é por minuto, e foi ela que quebrou o índice na
 * primeira carga: oitenta e poucos vetores seguidos e a chamada seguinte veio
 * 429. Reparar devagar é melhor do que reparar pela metade.
 */
const TAMANHO_LOTE = 20;
const PAUSA_MS = 15_000;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const desejada = origemAtual();
  console.log(`Origem de embedding esperada: ${desejada}`);
  console.log("Antes:", await contarTrechosPorOrigem());

  const pendentes = await listarTrechosDeOutraOrigem(desejada);
  if (pendentes.length === 0) {
    console.log("Nada a reparar: todos os trechos estão no mesmo espaço vetorial.");
    return;
  }
  console.log(`${pendentes.length} trecho(s) para reindexar.`);

  let reparados = 0;
  for (let i = 0; i < pendentes.length; i += TAMANHO_LOTE) {
    const lote = pendentes.slice(i, i + TAMANHO_LOTE);
    const embeddings = await gerarEmbeddingsComFallback(lote.map((t) => t.texto));

    if (embeddings.origem !== desejada) {
      console.log(`  lote ${i / TAMANHO_LOTE + 1}: provedor indisponível (${embeddings.motivoFallback ?? "sem motivo"}).`);
      console.log("  Interrompendo para não gravar vetor no espaço errado. Rode de novo mais tarde.");
      break;
    }

    for (let j = 0; j < lote.length; j += 1) {
      await atualizarEmbeddingDoTrecho(lote[j]!.chunkId, embeddings.valor[j]!, desejada);
      reparados += 1;
    }
    console.log(`  ${reparados}/${pendentes.length} trecho(s) reindexado(s).`);

    if (i + TAMANHO_LOTE < pendentes.length) await esperar(PAUSA_MS);
  }

  console.log("Depois:", await contarTrechosPorOrigem());
}

main()
  .catch((e) => {
    console.error("Falhou:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
