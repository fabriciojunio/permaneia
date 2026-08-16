import { defineConfig } from "vitest/config";
import path from "path";

// Os testes de integração falam com um Postgres de verdade, com a extensão
// pgvector instalada. Rodam em série e sem paralelismo: eles compartilham a
// mesma base e limpam tabelas entre si, então execução concorrente produziria
// falha intermitente que não diz nada sobre o código.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["__tests__/integracao/**/*.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ["./__tests__/integracao/preparar.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
