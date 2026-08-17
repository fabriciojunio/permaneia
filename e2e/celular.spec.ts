// Verificação de celular.
//
// O que se cobra aqui é o que quebra de verdade em tela estreita: barra de
// rolagem horizontal, elemento passando da borda, rodapé flutuando no meio da
// tela e campo de formulário estreito demais para ser usado com o polegar.
//
// A largura é 390 por 844, que é a do iPhone 13/14 e a mediana do parque
// brasileiro de Android. Se passa aqui, passa em tela maior.

import { expect, test, type Page } from "@playwright/test";
import { CONTAS, entrar } from "./ajudantes";

const CELULAR = { width: 390, height: 844 };
const ALVO_DE_TOQUE = 40;

test.use({ viewport: CELULAR });

/**
 * Elementos cuja borda direita passa da largura da janela.
 *
 * Ignora o que está dentro de um quadro com rolagem horizontal própria: a
 * tabela do painel de risco é larga por natureza e rola dentro da folha, o que
 * é solução e não defeito. O que não se admite é a PÁGINA rolar para os lados.
 */
async function transbordos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limite = document.documentElement.clientWidth;

    const dentroDeRolagem = (el: Element): boolean => {
      let atual = el.parentElement;
      while (atual && atual !== document.body) {
        const estilo = getComputedStyle(atual);
        if (estilo.overflowX === "auto" || estilo.overflowX === "scroll") return true;
        atual = atual.parentElement;
      }
      return false;
    };

    const nomear = (el: Element) => {
      const classe =
        typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 3).join(".") : "";
      return `${el.tagName.toLowerCase()}${classe ? "." + classe : ""}`;
    };

    return [...document.querySelectorAll("body *")]
      .filter((el) => {
        const caixa = el.getBoundingClientRect();
        return caixa.width > 0 && caixa.right > limite + 1 && !dentroDeRolagem(el);
      })
      .map(nomear)
      .slice(0, 6);
  });
}

async function conferirLargura(page: Page): Promise<void> {
  const { rolagem, cliente } = await page.evaluate(() => ({
    rolagem: document.documentElement.scrollWidth,
    cliente: document.documentElement.clientWidth,
  }));
  expect(await transbordos(page)).toEqual([]);
  expect(rolagem).toBeLessThanOrEqual(cliente + 1);
}

/** O rodapé encosta embaixo: ou a página rola, ou ele termina perto do fim da janela. */
async function conferirRodape(page: Page): Promise<void> {
  const rodape = page.locator("footer").last();
  await expect(rodape).toBeVisible();

  const fim = await page.evaluate(() => {
    const el = document.querySelectorAll("footer");
    const caixa = el[el.length - 1]!.getBoundingClientRect();
    return { base: caixa.bottom, janela: window.innerHeight, altura: document.body.scrollHeight };
  });

  // Página que cabe na tela: o rodapé precisa estar colado embaixo, e não
  // largado no meio com um vazio abaixo dele.
  if (fim.altura <= fim.janela + 1) {
    expect(fim.janela - fim.base).toBeLessThanOrEqual(40);
  }
}

const PUBLICAS = ["/", "/login", "/cadastro"];

test.describe("páginas públicas no celular", () => {
  for (const rota of PUBLICAS) {
    test(`${rota} não transborda a largura da tela`, async ({ page }) => {
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      await conferirLargura(page);
    });

    test(`${rota} fecha com o rodapé embaixo`, async ({ page }) => {
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      await conferirRodape(page);
    });
  }

  test("os campos do login cabem na tela e são clicáveis com o polegar", async ({ page }) => {
    await page.goto("/login");
    for (const rotulo of ["E-mail", "Senha"]) {
      const caixa = await page.getByLabel(rotulo).boundingBox();
      expect(caixa!.width).toBeGreaterThan(200);
      expect(caixa!.width).toBeLessThanOrEqual(CELULAR.width);
      expect(caixa!.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE);
    }
    const entrar = await page.getByRole("button", { name: "Entrar" }).boundingBox();
    expect(entrar!.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE);
  });

  test("o formulário vem antes do texto explicativo no celular", async ({ page }) => {
    // Quem abre o login no celular quer o campo de e-mail, não o texto sobre os
    // perfis. Em tela larga a ordem é a inversa, com o texto à esquerda.
    await page.goto("/login");
    const campo = await page.getByLabel("E-mail").boundingBox();
    const explicacao = await page.getByRole("heading", { name: "PermaneIA" }).boundingBox();
    expect(campo!.y).toBeLessThan(explicacao!.y);
  });

  test("a linha de cabeçalho não quebra em duas no celular", async ({ page }) => {
    await page.goto("/login");
    const caixa = await page.getByText("Unisagrado · Inteligência Artificial").boundingBox();
    expect(caixa!.height).toBeLessThan(28);
  });

  test("o cadastro mostra a política de senha sem cortar texto", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Senha", { exact: true }).fill("abc");
    await expect(page.getByText(/pelo menos 10 caracteres/)).toBeVisible();
    await conferirLargura(page);
  });
});

test.describe("aluno no celular", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, CONTAS.aluno);
  });

  for (const rota of ["/inicio", "/chat", "/privacidade"]) {
    test(`${rota} não transborda e fecha com o rodapé embaixo`, async ({ page }) => {
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      await conferirLargura(page);
      await conferirRodape(page);
    });
  }

  test("a navegação principal cabe na tela", async ({ page }) => {
    await page.goto("/inicio");
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    const caixa = await nav.boundingBox();
    expect(caixa!.width).toBeLessThanOrEqual(CELULAR.width);
    await expect(nav.getByRole("link", { name: "Assistente" })).toBeVisible();
  });

  test("o campo de pergunta e o botão do assistente cabem lado a lado", async ({ page }) => {
    await page.goto("/chat");
    const campo = await page.getByLabel("Sua pergunta").boundingBox();
    const botao = await page.getByRole("button", { name: "Perguntar" }).boundingBox();

    expect(campo!.width).toBeGreaterThan(120);
    expect(botao!.x + botao!.width).toBeLessThanOrEqual(CELULAR.width + 1);
    expect(botao!.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE);
  });

  test("a resposta do assistente não estoura a largura", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("button", { name: "Quando é a Prova P1?" }).click();
    await expect(page.getByRole("log")).toContainText("24 de setembro", { timeout: 60_000 });
    await conferirLargura(page);
  });
});

test.describe("coordenação no celular", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, CONTAS.coordenacao);
  });

  for (const rota of ["/inicio", "/disciplinas"]) {
    test(`${rota} não transborda e fecha com o rodapé embaixo`, async ({ page }) => {
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      await conferirLargura(page);
      await conferirRodape(page);
    });
  }

  test("o painel de risco não empurra a página para os lados", async ({ page }) => {
    // A tabela é larga por natureza. Ela pode rolar dentro do próprio quadro,
    // mas a PÁGINA não pode rolar junto: rolagem horizontal no documento
    // inteiro é o defeito clássico de tabela em celular.
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await conferirLargura(page);
  });

  test("a etiqueta de risco aparece sem precisar rolar a tabela para o lado", async ({ page }) => {
    // Painel de risco cuja coluna de risco fica fora da tela é painel sem
    // risco. No celular a tabela mostra aluno e risco, e o resto vai para o
    // detalhamento.
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const etiqueta = page.locator("tbody tr").first().getByText(/crítico|alto|médio|baixo/i).first();
    await expect(etiqueta).toBeVisible();

    const caixa = await etiqueta.boundingBox();
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(CELULAR.width + 1);
  });

  test("o detalhamento fuzzy abre sem cortar as regras", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator('tbody tr[role="button"]').first().click();
    await page.getByText("Ação sugerida", { exact: true }).waitFor({ timeout: 30_000 });
    await conferirLargura(page);
  });

  test("o formulário de envio de documento cabe na tela", async ({ page }) => {
    await page.goto("/disciplinas");
    const arquivo = page.locator('input[type="file"]').first();
    const caixa = await arquivo.boundingBox();
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(CELULAR.width + 1);
    await conferirLargura(page);
  });
});
