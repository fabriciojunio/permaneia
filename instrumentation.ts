// Registro da telemetria do Next, executado uma vez por processo.
//
// O processador é criado e **exportado** aqui, e não num módulo auxiliar, por
// um motivo de empacotamento que custou uma tarde: o Next compila o gancho de
// instrumentação num pacote separado do código das rotas. Um módulo importado
// pelos dois vira duas instâncias, e o resultado é o pior possível: a rota
// esvazia uma fila vazia enquanto a fila que de fato recebeu os dados nunca é
// enviada. Nada falha, e o painel fica vazio.
//
// Importando daqui, as duas pontas falam com o mesmo objeto.
//
// Sem as chaves, nada é registrado e a aplicação sobe igual. Ver
// docs/adr/015-rastro-de-llm-com-langfuse.md.

import { LangfuseSpanProcessor } from "@langfuse/otel";

/** Remove marca de ordem de byte e espaço em volta. Ver ADR 015. */
function limpar(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const limpo = valor.replace(/^﻿/, "").trim();
  return limpo.length > 0 ? limpo : undefined;
}

const publica = limpar(process.env.LANGFUSE_PUBLIC_KEY);
const secreta = limpar(process.env.LANGFUSE_SECRET_KEY);

export const processadorLangfuse =
  publica && secreta
    ? new LangfuseSpanProcessor({
        publicKey: publica,
        secretKey: secreta,
        baseUrl: limpar(process.env.LANGFUSE_BASE_URL) ?? "https://us.cloud.langfuse.com",
      })
    : null;

export async function register(): Promise<void> {
  // Só no runtime Node: o middleware roda no runtime de borda, onde o SDK de
  // OpenTelemetry não funciona.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!processadorLangfuse) return;

  // Tudo dentro de try: uma exceção aqui não falha só a telemetria, ela impede
  // o gancho de carregar, e aí TODA requisição responde 500, inclusive a de
  // saúde. Foi o que aconteceu em 06/10/2026, por causa de uma variável de
  // ambiente gravada com marca de ordem de byte.
  try {
    // `registerOTel` da Vercel, e não o registro direto do provedor do SDK.
    // O motivo é empacotamento, de novo: registrar à mão deixava o provedor
    // numa cópia da API de OpenTelemetry e as rotas noutra, então a span era
    // criada contra um provedor que não existia. Sem erro, sem dado, painel
    // vazio. Este pacote existe justamente para resolver isso no Next.
    const { registerOTel } = await import("@vercel/otel");
    registerOTel({
      serviceName: "permaneia",
      spanProcessors: [processadorLangfuse],
    });
  } catch (e) {
    console.error("Rastro de LLM não pôde ser registrado:", (e as Error).message);
  }
}
