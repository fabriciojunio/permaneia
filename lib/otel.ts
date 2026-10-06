// O processador de spans, num módulo só, para ter uma instância por processo.
//
// Existe separado de `instrumentation.ts` por um motivo prático: além de
// registrar o processador no início do processo, é preciso pedir o envio
// explícito ao fim de cada requisição, e as duas pontas precisam falar com o
// MESMO objeto.
//
// A razão do envio explícito é a plataforma. Em função sem servidor, o processo
// congela assim que a resposta sai, e o envio em segundo plano que funciona num
// servidor de vida longa simplesmente não acontece. O sintoma é o pior
// possível: nada falha, nada aparece no log, e o painel fica vazio.

import type { LangfuseSpanProcessor } from "@langfuse/otel";

let processador: LangfuseSpanProcessor | null = null;

export function configurado(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

export async function obterProcessador(): Promise<LangfuseSpanProcessor | null> {
  if (!configurado()) return null;
  if (processador) return processador;
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");
  processador = new LangfuseSpanProcessor();
  return processador;
}

/** Força o envio do que está na fila. Chamado ao fim da requisição que gerou o rastro. */
export async function enviarPendentes(): Promise<void> {
  if (!processador) return;
  await processador.forceFlush();
}
