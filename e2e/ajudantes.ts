import type { Page } from "@playwright/test";

/** Senha das contas semeadas pelo seed. Vale só na base sintética. */
export const SENHA_DEMO = "permanencia2026";

export const CONTAS = {
  coordenacao: "coordenacao@permaneia.exemplo",
  aluno: "aluno@permaneia.exemplo",
  admin: "admin@permaneia.exemplo",
} as const;

/** Entra pelo formulário de login e espera a aplicação carregar. */
export async function entrar(pagina: Page, email: string, senha = SENHA_DEMO): Promise<void> {
  await pagina.goto("/login");
  await pagina.getByLabel("E-mail").fill(email);
  await pagina.getByLabel("Senha").fill(senha);
  await pagina.getByRole("button", { name: "Entrar" }).click();
  await pagina.waitForURL("**/inicio", { timeout: 20_000 });
}

export async function sair(pagina: Page): Promise<void> {
  await pagina.getByRole("button", { name: "Sair" }).click();
  await pagina.waitForURL("**/login", { timeout: 20_000 });
}

/**
 * Clica num item da navegação principal.
 *
 * Sempre pela landmark de navegação: os mesmos rótulos aparecem também nos
 * cartões da página inicial, e um seletor solto por papel de link casaria com
 * os dois, quebrando em modo estrito.
 */
export async function navegar(pagina: Page, rotulo: string, rota: string): Promise<void> {
  await pagina.getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: rotulo, exact: true })
    .click();
  await pagina.waitForURL(`**${rota}`, { timeout: 20_000 });
}

/** Origem da aplicação, para requisições diretas à API passarem pela checagem anti-CSRF. */
export const ORIGEM = `http://127.0.0.1:${process.env.E2E_PORTA ?? "3100"}`;

/** E-mail único por execução, para o cadastro não colidir entre rodadas. */
export function emailNovo(prefixo = "teste"): string {
  return `${prefixo}.${Date.now()}.${Math.floor(Math.random() * 10000)}@aluno.permaneia.exemplo`;
}
