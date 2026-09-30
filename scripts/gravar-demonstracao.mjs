// Grava a demonstração da aplicação em vídeo, para a apresentação em sala.
//
// A ideia é não depender de operar o sistema ao vivo na frente da turma: o
// vídeo roda e a equipe narra por cima. Os tempos de espera são generosos de
// propósito, e cada bloco tem duração fixa, para o roteiro falado bater com o
// que está na tela. Se mudar um tempo aqui, mude também docs/ROTEIRO-DEMONSTRACAO.md.
//
// Uso: node scripts/gravar-demonstracao.mjs [url] [pasta]

import { chromium } from "@playwright/test";
import { existsSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "https://permaneia.vercel.app";
const PASTA = process.argv[3] ?? "demonstracao";
const SENHA = "permanencia2026";
const COORDENACAO = "coordenacao@permaneia.exemplo";
const ALUNO = "aluno@permaneia.exemplo";

// O login aceita 5 tentativas por minuto. A gravação entra duas vezes.
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Rola devagar, em passos pequenos, para dar tempo de ler o que passa. */
async function rolar(pagina, pixels, passos = 18) {
  const passo = Math.round(pixels / passos);
  for (let i = 0; i < passos; i += 1) {
    await pagina.mouse.wheel(0, passo);
    await pagina.waitForTimeout(520);
  }
}

async function entrar(pagina, email) {
  await pagina.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await pagina.waitForTimeout(1200);
  await pagina.getByLabel("E-mail").fill(email);
  await pagina.waitForTimeout(400);
  await pagina.getByLabel("Senha").fill(SENHA);
  await pagina.waitForTimeout(600);
  await pagina.getByRole("button", { name: "Entrar" }).click();
  await pagina.waitForURL("**/inicio", { timeout: 30_000 });
  await pagina.waitForLoadState("networkidle").catch(() => null);
}

(async () => {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: PASTA, size: { width: 1280, height: 720 } },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const pagina = await contexto.newPage();
  const marcos = [];
  const inicio = Date.now();
  const marcar = (nome) => {
    const s = Math.round((Date.now() - inicio) / 1000);
    marcos.push(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}  ${nome}`);
  };

  // ---------------------------------------------------------------- BLOCO 1
  marcar("Bloco 1 - abertura, o problema e os dois lados do sistema");
  await pagina.goto(BASE, { waitUntil: "domcontentloaded" });
  await pagina.waitForTimeout(11000);
  await rolar(pagina, 900);
  await pagina.waitForTimeout(9000);
  await rolar(pagina, 700);
  await pagina.waitForTimeout(9000);

  // ---------------------------------------------------------------- BLOCO 2
  marcar("Bloco 2 - painel de risco da coordenacao");
  await entrar(pagina, COORDENACAO);
  await pagina.waitForTimeout(2500);
  await pagina.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await pagina.waitForLoadState("networkidle").catch(() => null);
  await pagina.waitForTimeout(12000);
  await rolar(pagina, 600);
  await pagina.waitForTimeout(9000);
  await rolar(pagina, -600, 8);
  await pagina.waitForTimeout(6000);

  // ---------------------------------------------------------------- BLOCO 3
  marcar("Bloco 3 - as regras fuzzy que produziram o numero");
  await pagina.locator('tbody tr[role="button"]').first().click();
  await pagina.getByText("Carregando o detalhamento")
    .waitFor({ state: "detached", timeout: 30_000 }).catch(() => null);
  const acao = pagina.getByText("Ação sugerida", { exact: true });
  await acao.waitFor({ timeout: 30_000 }).catch(() => null);
  await pagina.waitForTimeout(9000);
  await acao.scrollIntoViewIfNeeded().catch(() => null);
  await pagina.waitForTimeout(14000);
  await rolar(pagina, 400, 8);
  await pagina.waitForTimeout(10000);

  // ---------------------------------------------------------------- BLOCO 4
  marcar("Bloco 4 - o assistente responde citando a fonte");
  await entrar(pagina, ALUNO);
  await pagina.waitForTimeout(2000);
  await pagina.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded" });
  await pagina.waitForLoadState("networkidle").catch(() => null);
  await pagina.waitForTimeout(8000);
  await pagina.getByRole("button", { name: "Quando é a Prova P1?" }).click();
  await pagina.waitForTimeout(14000);
  const fontes = pagina.getByText(/trecho\(s\) usado\(s\) como fonte/).first();
  if (await fontes.isVisible().catch(() => false)) {
    await fontes.click();
    await pagina.waitForTimeout(10000);
    await rolar(pagina, 400, 8);
    await pagina.waitForTimeout(10000);
  }

  // ---------------------------------------------------------------- BLOCO 5
  marcar("Bloco 5 - o assistente admite quando a resposta nao esta no material");
  await pagina.getByLabel("Sua pergunta").fill("Qual é o valor da mensalidade do curso?");
  await pagina.waitForTimeout(5000);
  await pagina.getByRole("button", { name: "Perguntar" }).click();
  await pagina.waitForTimeout(16_000);
  await rolar(pagina, 500, 10);
  await pagina.waitForTimeout(14000);

  // ---------------------------------------------------------------- BLOCO 6
  marcar("Bloco 6 - privacidade e fechamento");
  await pagina.goto(`${BASE}/privacidade`, { waitUntil: "domcontentloaded" });
  await pagina.waitForLoadState("networkidle").catch(() => null);
  await pagina.waitForTimeout(12000);
  await rolar(pagina, 700);
  await pagina.waitForTimeout(16000);
  marcar("fim");

  await pagina.close();
  await contexto.close();
  await navegador.close();

  // O Playwright nomeia o arquivo com um identificador aleatorio.
  if (existsSync(PASTA)) {
    const bruto = readdirSync(PASTA).find((n) => n.endsWith(".webm"));
    if (bruto) {
      const alvo = path.join(PASTA, "permaneia-demonstracao.webm");
      renameSync(path.join(PASTA, bruto), alvo);
      console.log(`Video em ${alvo}`);
    }
  }
  console.log("\nMarcos (aproximados, o video e gravado em tempo real):");
  for (const m of marcos) console.log("  " + m);
})();
