import { expect, test } from "@playwright/test";
import { CONTAS, ORIGEM, SENHA_DEMO, emailNovo, entrar, sair } from "./ajudantes";

test.describe("página pública", () => {
  test("a abertura apresenta o problema e as duas técnicas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PermaneIA");
    await expect(page.getByText("57,2%")).toBeVisible();
    await expect(page.getByRole("heading", { name: "IA generativa com RAG" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lógica fuzzy" })).toBeVisible();
  });

  test("declara que os dados são sintéticos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/exclusivamente dados sintéticos/i)).toBeVisible();
  });

  test("oferece entrar e criar conta", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Entrar no sistema" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar conta" })).toBeVisible();
  });
});

test.describe("proteção de rotas", () => {
  for (const rota of ["/inicio", "/chat", "/dashboard", "/disciplinas", "/privacidade"]) {
    test(`sem sessão, ${rota} redireciona para o login`, async ({ page }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("a API responde 401 em JSON, e não redireciona", async ({ request }) => {
    const resposta = await request.get("/api/dashboard/risco");
    expect(resposta.status()).toBe(401);
    const corpo = await resposta.json();
    expect(corpo.erro.codigo).toBe("NAO_AUTORIZADO");
  });

  test("o health check é público e informa o modo de operação", async ({ request }) => {
    const resposta = await request.get("/api/health");
    expect(resposta.ok()).toBeTruthy();
    const corpo = await resposta.json();
    expect(corpo.estado).toBe("saudavel");
    expect(corpo.buscaVetorial).toBe("ok");
    expect(corpo.regrasFuzzy).toBe(27);
  });
});

test.describe("login", () => {
  test("entra com credenciais corretas", async ({ page }) => {
    await entrar(page, CONTAS.coordenacao);
    await expect(page.getByRole("heading", { name: /^Olá,/ })).toBeVisible();
  });

  test("recusa senha errada com mensagem genérica", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(CONTAS.coordenacao);
    await page.getByLabel("Senha").fill("senhaCompletamenteErrada1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("a mensagem é a mesma para usuário inexistente", async ({ page }) => {
    // Diferenciar as duas entregaria uma lista de e-mails válidos da instituição.
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("ninguem@permaneia.exemplo");
    await page.getByLabel("Senha").fill("qualquerSenha123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("sai e perde o acesso às rotas protegidas", async ({ page }) => {
    await entrar(page, CONTAS.coordenacao);
    await sair(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("cadastro de conta", () => {
  test("cria conta de aluno e entra direto", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Nome completo").fill("Estudante de Teste");
    await page.getByLabel("E-mail").fill(emailNovo("cadastro"));
    await page.getByLabel(/^Curso/).fill("Ciência da Computação");
    await page.getByLabel("Senha", { exact: true }).fill("minhaSenhaBoa2026");
    await page.getByLabel("Confirme a senha").fill("minhaSenhaBoa2026");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();

    await page.waitForURL("**/inicio", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Olá, Estudante/ })).toBeVisible();
  });

  test("a conta criada é de aluno, e não vê o painel de risco", async ({ page }) => {
    // O cadastro público nunca aceita o papel vindo do formulário.
    await page.goto("/cadastro");
    await page.getByLabel("Nome completo").fill("Aluno Sem Painel");
    await page.getByLabel("E-mail").fill(emailNovo("papel"));
    await page.getByLabel("Senha", { exact: true }).fill("outraSenhaBoa2026");
    await page.getByLabel("Confirme a senha").fill("outraSenhaBoa2026");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("**/inicio", { timeout: 20_000 });

    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Painel de risco" })
    ).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/inicio/);
  });

  test("a barra de força reage e o botão só libera com senha válida", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Nome completo").fill("Teste Força");
    await page.getByLabel("E-mail").fill(emailNovo("forca"));
    await page.getByRole("checkbox").check();

    await page.getByLabel("Senha", { exact: true }).fill("curta");
    await expect(page.getByText(/pelo menos 10 caracteres/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar conta" })).toBeDisabled();

    await page.getByLabel("Senha", { exact: true }).fill("senhaValida2026");
    await page.getByLabel("Confirme a senha").fill("senhaValida2026");
    await expect(page.getByText(/Força:/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });

  test("avisa quando a confirmação não confere", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Senha", { exact: true }).fill("senhaValida2026");
    await page.getByLabel("Confirme a senha").fill("outraCoisaQualquer2026");
    await expect(page.getByText("As senhas não são iguais.")).toBeVisible();
  });

  test("exige o aceite do aviso de tratamento de dados", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Nome completo").fill("Sem Aceite");
    await page.getByLabel("E-mail").fill(emailNovo("aceite"));
    await page.getByLabel("Senha", { exact: true }).fill("senhaValida2026");
    await page.getByLabel("Confirme a senha").fill("senhaValida2026");
    await expect(page.getByRole("button", { name: "Criar conta" })).toBeDisabled();
  });

  test("e-mail já cadastrado não confirma que a conta existe", async ({ request }) => {
    // A resposta é deliberadamente igual à de sucesso: um erro "já existe"
    // transformaria o cadastro num oráculo de quem tem conta no sistema.
    const resposta = await request.post("/api/auth/cadastrar", {
      headers: { origin: ORIGEM },
      data: {
        nome: "Tentativa Duplicada",
        email: CONTAS.aluno,
        senha: "senhaQualquer2026",
        confirmacao: "senhaQualquer2026",
        aceiteTermos: true,
      },
    });
    expect(resposta.ok()).toBeTruthy();
    const corpo = await resposta.json();
    expect(corpo.autenticado).toBe(false);
    expect(JSON.stringify(corpo)).not.toMatch(/já existe|duplicad/i);
  });
});

test.describe("cabeçalhos de segurança", () => {
  test("a resposta traz os cabeçalhos de proteção", async ({ request }) => {
    const resposta = await request.get("/");
    const cabecalhos = resposta.headers();
    expect(cabecalhos["x-frame-options"]).toBe("DENY");
    expect(cabecalhos["x-content-type-options"]).toBe("nosniff");
    expect(cabecalhos["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(cabecalhos["content-security-policy"]).toContain("default-src 'self'");
    expect(cabecalhos["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("não revela a tecnologia do servidor", async ({ request }) => {
    const resposta = await request.get("/");
    expect(resposta.headers()["x-powered-by"]).toBeUndefined();
  });

  test("a API não é cacheável", async ({ request }) => {
    const resposta = await request.get("/api/health");
    expect(resposta.headers()["cache-control"]).toContain("no-store");
  });

  test("robots.txt bloqueia buscadores e rastreadores de treinamento", async ({ request }) => {
    const corpo = await (await request.get("/robots.txt")).text();
    expect(corpo).toContain("Disallow: /");
    expect(corpo).toContain("GPTBot");
    expect(corpo).toContain("ClaudeBot");
  });

  test("escrita sem Origin é recusada, como defesa contra CSRF", async ({ request }) => {
    // Nenhum navegador envia escrita sem Origin nem Referer. Requisição assim
    // vem de cliente automatizado, e a API não é feita para consumo externo.
    const resposta = await request.post("/api/auth/login", {
      data: { email: CONTAS.aluno, senha: SENHA_DEMO },
    });
    expect([400, 403]).toContain(resposta.status());
  });

  test("escrita com Origin da própria aplicação é aceita", async ({ request }) => {
    const resposta = await request.post("/api/auth/login", {
      headers: { origin: ORIGEM },
      data: { email: CONTAS.aluno, senha: SENHA_DEMO },
    });
    expect(resposta.ok()).toBeTruthy();
  });

  test("escrita vinda de outra origem é recusada", async ({ request }) => {
    const resposta = await request.post("/api/auth/login", {
      data: { email: CONTAS.aluno, senha: SENHA_DEMO },
      headers: { origin: "https://atacante.exemplo" },
    });
    expect(resposta.status()).toBe(403);
  });
});
