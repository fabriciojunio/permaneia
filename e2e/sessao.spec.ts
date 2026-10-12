import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";
import { ORIGEM } from "./ajudantes";
import { validarBancoDeTeste } from "../scripts/banco-de-teste";

test("trocar a senha revoga o cookie anterior e desativar a conta revoga o novo", async ({ browser }) => {
  validarBancoDeTeste(process.env.DATABASE_URL);
  const banco = new PrismaClient();
  const email = `sessao.${Date.now()}@permaneia.exemplo`;
  const senha = "SenhaInicialSegura2026";
  const novaSenha = "NovaSenhaSegura2026";
  const usuario = await banco.usuario.create({ data: {
    nome: "Conta de teste de sessão", email, senhaHash: await hash(senha, 12), papel: "admin",
  } });
  const atual = await browser.newContext();
  const anterior = await browser.newContext();
  try {
    const login = await atual.request.post(`${ORIGEM}/api/auth/login`, {
      headers: { origin: ORIGEM }, data: { email, senha },
    });
    expect(login.status()).toBe(200);
    await anterior.addCookies(await atual.cookies());
    expect((await anterior.request.get(`${ORIGEM}/api/auth/eu`)).status()).toBe(200);

    const troca = await atual.request.post(`${ORIGEM}/api/auth/trocar-senha`, {
      headers: { origin: ORIGEM }, data: { senhaAtual: senha, senhaNova: novaSenha, confirmacao: novaSenha },
    });
    expect(troca.status()).toBe(200);
    expect((await anterior.request.get(`${ORIGEM}/api/auth/eu`)).status()).toBe(401);
    expect((await atual.request.get(`${ORIGEM}/api/auth/eu`)).status()).toBe(200);

    await banco.usuario.update({ where: { id: usuario.id }, data: { ativo: false } });
    expect((await atual.request.get(`${ORIGEM}/api/auth/eu`)).status()).toBe(401);
    const pagina = await atual.newPage();
    await pagina.goto(`${ORIGEM}/inicio`);
    await expect(pagina).toHaveURL(/\/login$/);
  } finally {
    await atual.close();
    await anterior.close();
    await banco.registroAuditoria.deleteMany({ where: { atorId: usuario.id } });
    await banco.usuario.delete({ where: { id: usuario.id } });
    await banco.$disconnect();
  }
});
