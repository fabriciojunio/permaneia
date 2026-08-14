import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // A suíte unitária vive só em __tests__. Integração (banco real) e E2E
    // (Playwright) rodam por configurações próprias.
    include: ["__tests__/**/*.test.ts"],
    exclude: ["**/integracao/**", "e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      // O gate cobre a lógica de domínio: funções puras, testáveis sem I/O.
      // Adaptadores de infraestrutura (Prisma, cliente HTTP do Gemini, parsing
      // de PDF) são exercitados por integração e E2E e ficam fora do número
      // para que ele reflita exatamente o que mede.
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/prisma.ts",
        "lib/env.ts",
        "lib/tipos.ts",
        "lib/ia/gemini.ts",
        "lib/repositorios/**",
        "lib/rag/pdf.ts",
      ],
      thresholds: {
        statements: 90,
        functions: 90,
        lines: 90,
        branches: 85,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
