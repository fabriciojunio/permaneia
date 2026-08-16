import { defineConfig, devices } from "@playwright/test";

// Configuração para a vistoria visual contra a aplicação já publicada.
// Não sobe servidor local: aponta para a URL de produção.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /vistoria\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 120_000,
  use: {
    baseURL: process.env.URL_PRODUCAO ?? "https://permaneia.vercel.app",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
