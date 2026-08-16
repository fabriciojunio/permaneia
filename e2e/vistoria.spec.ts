// Vistoria visual da aplicação em produção.
//
// Não é um teste de asserção: é uma passagem pelas telas principais, com
// captura de imagem, para inspeção humana. Serve para pegar o que asserção não
// pega — texto cortado, contraste ruim, alinhamento quebrado, número mal
// formatado.
//
// Uso: npx playwright test vistoria --config playwright.producao.config.ts

import { test } from "@playwright/test";
import { CONTAS, SENHA_DEMO } from "./ajudantes";

const PASTA = "vistoria";

async function entrar(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA_DEMO);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio", { timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });

test("abertura", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${PASTA}/01-abertura.png`, fullPage: true });
});

test("cadastro com senha fraca", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill("Maria Antônia Souza");
  await page.getByLabel("E-mail").fill("maria.antonia@unisagrado.edu.br");
  await page.getByLabel(/^Curso/).fill("Ciência da Computação");
  await page.getByLabel("Senha", { exact: true }).fill("senha123");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${PASTA}/02-cadastro-senha-fraca.png`, fullPage: true });

  await page.getByLabel("Senha", { exact: true }).fill("minhaSenhaSegura2026");
  await page.getByLabel("Confirme a senha").fill("minhaSenhaSegura2026");
  await page.getByRole("checkbox").check();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${PASTA}/03-cadastro-senha-forte.png`, fullPage: true });
});

test("login", async ({ page }) => {
  await page.goto("/login");
  await page.screenshot({ path: `${PASTA}/04-login.png`, fullPage: true });
});

test("inicio da coordenacao", async ({ page }) => {
  await entrar(page, CONTAS.coordenacao);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${PASTA}/05-inicio-coordenacao.png`, fullPage: true });
});

test("painel de risco", async ({ page }) => {
  await entrar(page, CONTAS.coordenacao);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${PASTA}/06-painel-risco.png`, fullPage: false });

  // Abre o detalhamento do primeiro aluno, que é o de maior risco.
  await page.locator('tbody tr[role="button"]').first().click();
  await page.getByText("Carregando o detalhamento").waitFor({ state: "detached", timeout: 30_000 });
  const acao = page.getByText("Ação sugerida", { exact: true });
  await acao.waitFor({ timeout: 30_000 });
  await acao.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${PASTA}/07-detalhe-regras-fuzzy.png`, fullPage: false });
});

test("assistente de estudos", async ({ page }) => {
  await entrar(page, CONTAS.aluno);
  await page.goto("/chat");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${PASTA}/08-chat-inicial.png`, fullPage: true });

  await page.getByRole("button", { name: "Quando é a Prova P1?" }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${PASTA}/09-chat-resposta.png`, fullPage: true });

  // Expande as fontes citadas.
  const fontes = page.getByText(/trecho\(s\) usado\(s\) como fonte/).first();
  if (await fontes.isVisible()) {
    await fontes.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${PASTA}/10-chat-fontes.png`, fullPage: true });
  }

  await page.getByLabel("Sua pergunta").fill("Qual é o valor da mensalidade do curso?");
  await page.getByRole("button", { name: "Perguntar" }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${PASTA}/11-chat-admite-nao-saber.png`, fullPage: true });
});

test("disciplinas", async ({ page }) => {
  await entrar(page, CONTAS.coordenacao);
  await page.goto("/disciplinas");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${PASTA}/12-disciplinas.png`, fullPage: true });
});

test("privacidade", async ({ page }) => {
  await entrar(page, CONTAS.aluno);
  await page.goto("/privacidade");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${PASTA}/13-privacidade.png`, fullPage: true });
});

test("celular", async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexto.newPage();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${PASTA}/14-celular-abertura.png`, fullPage: true });

  await entrar(page, CONTAS.coordenacao);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${PASTA}/15-celular-painel.png`, fullPage: false });

  await contexto.close();
});
