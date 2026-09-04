// O rastro em andamento, e a emissão de trechos.
//
// Separado de lib/rastro.ts porque este arquivo importa `node:async_hooks`, que
// não existe no runtime de borda onde o middleware roda. Importar os dois do
// mesmo lugar quebraria o build do middleware sem nenhum aviso útil.
//
// O armazenamento por contexto assíncrono é o que permite a extensão do Prisma
// saber a qual pedido pertence a consulta que ela acabou de ver, sem que cada
// repositório precise receber e repassar o rastro por parâmetro. Fosse por
// parâmetro, a instrumentação pararia na primeira função que alguém esquecesse
// de mudar, e essa é a função que interessa no dia da investigação.

import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "./logger";
import { abrirRastro, type Rastro } from "./rastro";

const contexto = new AsyncLocalStorage<Rastro>();

/** O rastro do pedido atual, ou nulo fora de uma requisição (tarefa, script, teste). */
export function rastroAtual(): Rastro | null {
  return contexto.getStore() ?? null;
}

/**
 * Roda o trabalho com um rastro estabelecido, que tudo abaixo enxerga.
 *
 * Quem chama passa o cabeçalho recebido; a continuação do rastro do cliente,
 * quando ele existe, acontece aqui e não no chamador.
 */
export function comRastro<T>(paiCabecalho: string | null | undefined, trabalho: () => T): T {
  return contexto.run(abrirRastro(paiCabecalho), trabalho);
}

/** Os campos de correlação para juntar a uma linha de log. */
export function camposDeRastro(): Record<string, string> {
  const rastro = rastroAtual();
  if (!rastro) return {};
  return {
    traceId: rastro.traceId,
    spanId: rastro.spanId,
    ...(rastro.paiSpanId ? { paiSpanId: rastro.paiSpanId } : {}),
  };
}

/**
 * Publica um trecho concluído.
 *
 * Uma linha de log e não uma chamada a coletor: não há coletor configurado, e
 * fingir que há só acrescentaria uma dependência que ninguém lê. Os campos
 * seguem os nomes do OpenTelemetry para que ligar um coletor um dia seja
 * trocar esta função, e não reescrever quem a chama.
 */
export function emitirTrecho(nome: string, duracaoMs: number, atributos: Record<string, unknown> = {}): void {
  logger.debug("trecho", {
    trecho: nome,
    duracaoMs,
    ...camposDeRastro(),
    ...atributos,
  });
}

/**
 * Mede uma operação e publica o trecho, propagando erro depois de marcá-lo.
 *
 * O erro sobe porque quem decide o que fazer com a falha é quem chamou; aqui
 * só passa a informação de que o trecho terminou mal, que é o que faz o trecho
 * aparecer marcado em vez de sumir do rastro.
 */
export async function medirTrecho<T>(
  nome: string,
  operacao: () => Promise<T>,
  atributos: Record<string, unknown> = {}
): Promise<T> {
  const inicio = Date.now();
  try {
    const valor = await operacao();
    emitirTrecho(nome, Date.now() - inicio, atributos);
    return valor;
  } catch (erro) {
    emitirTrecho(nome, Date.now() - inicio, {
      ...atributos,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    throw erro;
  }
}
