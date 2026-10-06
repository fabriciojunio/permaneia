// Registro da telemetria do Next, executado uma vez por processo.
//
// O Next chama `register()` antes de qualquer rota, e é o único ponto em que dá
// para instalar um processador de spans para a aplicação inteira. Fica aqui, e
// não dentro da rota do assistente, porque instalar o processador a cada
// requisição criaria um exportador novo por chamada.
//
// Sem as chaves do Langfuse, nada é registrado e a aplicação sobe igual. Ver
// docs/adr/015-rastro-de-llm-com-langfuse.md.

export async function register(): Promise<void> {
  // Só no runtime Node: o middleware roda no runtime de borda, onde o SDK de
  // OpenTelemetry não funciona, e tentar carregar lá quebra o deploy inteiro.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Tudo dentro de try: uma exceção aqui não falha só a telemetria, ela impede
  // o gancho de instrumentação de carregar, e aí TODA requisição responde 500,
  // inclusive a de saúde. Foi o que aconteceu em 06/10/2026 por causa de uma
  // variável de ambiente gravada com marca de ordem de byte.
  try {
    const { obterProcessador } = await import("./lib/otel");
    const processador = await obterProcessador();
    if (!processador) return;

    const { NodeTracerProvider } = await import("@opentelemetry/sdk-trace-node");
    const provedor = new NodeTracerProvider({ spanProcessors: [processador] });
    provedor.register();
  } catch (e) {
    console.error("Rastro de LLM não pôde ser registrado:", (e as Error).message);
  }
}
