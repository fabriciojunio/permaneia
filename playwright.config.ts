import { defineConfig, devices } from "@playwright/test";

const PORTA = process.env.E2E_PORTA ?? "3100";
const URL_BASE = `http://127.0.0.1:${PORTA}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Um trabalhador só: os testes compartilham a mesma base semeada.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: URL_BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Roda o build de produção, e não o servidor de desenvolvimento: é o
    // artefato que vai para a Vercel, e é nele que os cabeçalhos de segurança
    // e o middleware se comportam como em produção.
    command: `npm run start -- --port ${PORTA}`,
    url: `${URL_BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NODE_ENV: "production",
      DEMO_MODE: "on",
      // Sem chave de API a suíte fica determinística e não consome cota.
      IA_EXTERNA: "off",
      // A suíte inteira entra pelo mesmo 127.0.0.1, e o limite de produção
      // barraria os próprios testes a partir da sexta autenticação. O limitador
      // em si é coberto pelos testes unitários, com o relógio controlado.
      RATE_LIMIT_LOGIN: "200",
    },
  },
});
