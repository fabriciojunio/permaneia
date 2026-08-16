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
      // Ficam de fora os módulos que só existem acoplados ao Prisma ou ao
      // runtime do Next, e que por isso são exercitados pelos testes de
      // integração e E2E, com banco real. Mantê-los no gate faria o número
      // medir a presença de mocks em vez da qualidade da lógica.
      exclude: [
        "lib/prisma.ts",
        "lib/env.ts",
        "lib/auth.ts", // lê next/headers
        "lib/auditoria.ts", // escreve no banco
        "lib/observabilidade.ts", // NextResponse e next/headers
        "lib/repositorios/**", // SQL e Prisma
        "lib/rag/consulta.ts", // orquestra banco e provedor de IA
        "lib/rag/ingestao.ts", // grava no banco
        "lib/rag/pdf.ts", // depende de biblioteca externa de parsing
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
