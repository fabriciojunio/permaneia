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
import { logger } from "./logger";

let processador: LangfuseSpanProcessor | null = null;

/**
 * Remove marca de ordem de byte e espaço em volta do valor.
 *
 * Isto não é preciosismo: uma variável gravada por uma ferramenta que escreve
 * UTF-8 com BOM chega aqui com um caractere invisível no começo, e um endereço
 * com BOM não passa no construtor de URL. Já aconteceu em produção, e o efeito
 * foi a aplicação inteira parar de subir por causa de uma configuração de
 * telemetria.
 */
function limpar(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const limpo = valor.replace(/^﻿/, "").trim();
  return limpo.length > 0 ? limpo : undefined;
}

export function configurado(): boolean {
  return Boolean(limpar(process.env.LANGFUSE_PUBLIC_KEY) && limpar(process.env.LANGFUSE_SECRET_KEY));
}

export async function obterProcessador(): Promise<LangfuseSpanProcessor | null> {
  if (!configurado()) return null;
  if (processador) return processador;

  try {
    const { LangfuseSpanProcessor } = await import("@langfuse/otel");
    processador = new LangfuseSpanProcessor({
      publicKey: limpar(process.env.LANGFUSE_PUBLIC_KEY),
      secretKey: limpar(process.env.LANGFUSE_SECRET_KEY),
      baseUrl: limpar(process.env.LANGFUSE_BASE_URL) ?? "https://us.cloud.langfuse.com",
    });
    return processador;
  } catch (e) {
    // Defeito de telemetria não derruba a aplicação. Esta linha existe porque o
    // contrário aconteceu: a exceção subiu pelo gancho de instrumentação do
    // Next e toda requisição passou a responder 500, inclusive a de saúde.
    logger.error("Falha ao preparar o rastro de LLM; seguindo sem ele", {
      detalhe: (e as Error).message,
    });
    return null;
  }
}

/** Força o envio do que está na fila. Chamado ao fim da requisição que gerou o rastro. */
export async function enviarPendentes(): Promise<void> {
  if (!processador) return;
  await processador.forceFlush();
}
