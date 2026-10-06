// Registro da telemetria do Next, executado uma vez por processo.
//
// O Next chama `register()` antes de qualquer rota, e e o unico ponto em que da
// para instalar um processador de spans para a aplicacao inteira. Fica aqui, e
// nao dentro da rota do assistente, porque instalar o processador a cada
// requisicao criaria um exportador novo por chamada.
//
// Sem as chaves do Langfuse, nada e registrado e a aplicacao sobe igual. Ver
// docs/adr/015-rastro-de-llm-com-langfuse.md.

export async function register(): Promise<void> {
  // Só no runtime Node: o middleware roda no runtime de borda, onde o SDK de
  // OpenTelemetry não funciona, e tentar carregar lá quebra o deploy inteiro.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return;

  const { NodeTracerProvider } = await import("@opentelemetry/sdk-trace-node");
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");

  const provedor = new NodeTracerProvider({
    spanProcessors: [new LangfuseSpanProcessor()],
  });
  provedor.register();
}
