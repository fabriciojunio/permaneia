import { expect, test } from "@playwright/test";
import { CONTAS, entrar, navegar } from "./ajudantes";

test.describe("assistente de estudos", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, CONTAS.aluno);
    await navegar(page, "Assistente", "/chat");
  });

  test("lista apenas disciplinas com documento indexado", async ({ page }) => {
    const opcoes = page.locator("#disciplina option");
    await expect(opcoes.first()).toContainText("Inteligência Artificial");
  });

  test("responde a pergunta sobre a data da prova, com a data certa", async ({ page }) => {
    // A demonstração da apresentação: perguntar e conferir contra o cronograma
    // real na hora.
    await page.getByRole("button", { name: "Quando é a Prova P1?" }).click();
    await expect(page.getByRole("log")).toContainText("24 de setembro", { timeout: 45_000 });
  });

  test("mostra os trechos usados como fonte", async ({ page }) => {
    await page.getByRole("button", { name: "Quando é a Prova P1?" }).click();
    await expect(page.getByText(/trecho\(s\) usado\(s\) como fonte/)).toBeVisible({ timeout: 45_000 });

    await page.getByText(/trecho\(s\) usado\(s\) como fonte/).click();
    await expect(page.getByText("Cronograma de aulas").first()).toBeVisible();
    await expect(page.getByText(/similaridade \d/).first()).toBeVisible();
  });

  test("declara o modo de operação de cada resposta", async ({ page }) => {
    // Uma resposta gerada e uma resposta extraída do documento têm garantias
    // diferentes, e esconder qual das duas o aluno está lendo seria desonesto.
    await page.getByRole("button", { name: "Qual é o limite de faltas da disciplina?" }).click();
    // A linha de diagnóstico fica logo abaixo da resposta e é a última do bloco.
    await expect(
      page.getByText(/^(Leitura direta do material|Resposta gerada \(Gemini\)) ·/).last()
    ).toBeVisible({ timeout: 45_000 });
  });

  test("a pergunta de enumeração devolve o cronograma, e não uma aula só", async ({ page }) => {
    // O defeito que este teste tranca: "qual é o conteúdo das aulas" respondia
    // com a aula que ficou em primeiro na busca vetorial, correta e parcial.
    await page.getByLabel("Sua pergunta").fill("Quais são os temas de todas as aulas da disciplina?");
    await page.getByRole("button", { name: "Perguntar" }).click();

    const log = page.getByRole("log");
    await expect(log).toContainText("agosto", { timeout: 60_000 });
    await expect(log).toContainText("novembro");
    await expect(log).toContainText(/lógica fuzzy/i);
  });

  test("admite não saber quando a informação não está no material", async ({ page }) => {
    await page.getByLabel("Sua pergunta").fill("Qual é o valor da mensalidade do curso?");
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByRole("log")).toContainText(/Não encontrei/i, { timeout: 45_000 });
  });

  test("o botão fica desabilitado para pergunta curta demais", async ({ page }) => {
    await page.getByLabel("Sua pergunta").fill("ab");
    await expect(page.getByRole("button", { name: "Perguntar" })).toBeDisabled();
  });

  test("trocar de disciplina limpa a conversa", async ({ page }) => {
    await page.getByRole("button", { name: "Quando é a Prova P1?" }).click();
    await expect(page.getByRole("log")).toContainText("24 de setembro", { timeout: 45_000 });

    const opcoes = await page.locator("#disciplina option").count();
    test.skip(opcoes < 2, "só há uma disciplina com documento indexado");

    await page.locator("#disciplina").selectOption({ index: 1 });
    await expect(page.getByText("Comece por uma destas perguntas")).toBeVisible();
  });

  test("o aluno não enxerga o painel de risco na navegação", async ({ page }) => {
    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Painel de risco" })
    ).toHaveCount(0);
  });
});

test.describe("painel de risco", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, CONTAS.coordenacao);
    await navegar(page, "Painel de risco", "/dashboard");
  });

  test("lista os alunos com os cartões de resumo por faixa", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Painel de risco de evasão" })).toBeVisible();
    await expect(page.getByText("Crítico", { exact: true })).toBeVisible();
    await expect(page.getByText("Alto", { exact: true })).toBeVisible();
  });

  test("ordena do mais crítico para o menos", async ({ page }) => {
    // A ordenação é a funcionalidade: a coordenação trabalha de cima para baixo.
    const etiquetas = page.locator("tbody .etiqueta");
    await expect(etiquetas.first()).toBeVisible();
    // innerText devolve o texto já com o text-transform aplicado, então a
    // comparação precisa ignorar a caixa.
    const primeira = await etiquetas.first().innerText();
    expect(primeira).toMatch(/crítico|alto/i);
  });

  test("abre o detalhamento com as regras fuzzy que produziram o score", async ({ page }) => {
    await page.locator('tbody tr[role="button"]').first().click();
    // O texto exato importa: o parágrafo de introdução da página também contém
    // "a ação sugerida", e um seletor por substring casaria com ele. O teste
    // passaria sem o detalhamento ter sequer carregado.
    await expect(page.getByText("Ação sugerida", { exact: true })).toBeVisible();
    await expect(page.getByText(/regra \d+/i).first()).toBeVisible();
    await expect(page.getByText(/força \d/).first()).toBeVisible();
  });

  test("o detalhamento explica a decisão em linguagem natural", async ({ page }) => {
    await page.locator('tbody tr[role="button"]').first().click();
    await expect(page.getByText(/Engajamento normalizado/)).toBeVisible();
    await expect(page.getByText(/então risco é/).first()).toBeVisible();
  });

  test("filtra por disciplina", async ({ page }) => {
    await page.locator("#filtro-disciplina").selectOption({ index: 1 });
    await page.waitForURL(/disciplinaId=/);
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("declara que os dados são sintéticos", async ({ page }) => {
    await expect(page.getByText(/Dados sintéticos/i)).toBeVisible();
  });
});

test.describe("gestão de disciplinas", () => {
  test("a coordenação vê as disciplinas e os documentos indexados", async ({ page }) => {
    await entrar(page, CONTAS.coordenacao);
    await navegar(page, "Disciplinas", "/disciplinas");

    await expect(page.getByRole("heading", { name: "Disciplinas e documentos" })).toBeVisible();
    await expect(page.getByText("Cronograma de aulas").first()).toBeVisible();
    await expect(page.getByText(/trecho\(s\)/).first()).toBeVisible();
  });

  test("avisa quando a disciplina não tem documento indexado", async ({ page }) => {
    await entrar(page, CONTAS.coordenacao);
    await page.goto("/disciplinas");
    await expect(page.getByText(/Sem documento indexado/).first()).toBeVisible();
  });
});

test.describe("privacidade", () => {
  test("qualquer papel acessa os próprios dados", async ({ page }) => {
    await entrar(page, CONTAS.aluno);
    await navegar(page, "Meus dados", "/privacidade");
    await expect(page.getByRole("heading", { name: "Meus dados", level: 1 })).toBeVisible();
  });

  test("explica que o score não é mostrado ao aluno, e por quê", async ({ page }) => {
    await entrar(page, CONTAS.aluno);
    await page.goto("/privacidade");
    await expect(page.getByText(/Apenas a coordenação pedagógica/)).toBeVisible();
  });

  test("exporta os dados do usuário em formato aberto", async ({ page }) => {
    await entrar(page, CONTAS.aluno);
    await page.goto("/privacidade");
    await page.getByRole("button", { name: "Ver meus dados" }).click();
    await expect(page.locator("pre")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("pre")).toContainText("consultasAoAssistente");
  });
});

test.describe("acessibilidade básica", () => {
  test("existe atalho para pular a navegação", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  });

  test("a tabela do painel tem legenda para leitor de tela", async ({ page }) => {
    await entrar(page, CONTAS.coordenacao);
    await page.goto("/dashboard");
    await expect(page.locator("table caption")).toHaveText(/ordenados por score de risco/i);
  });

  test("os campos do login têm rótulo associado", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
  });
});
