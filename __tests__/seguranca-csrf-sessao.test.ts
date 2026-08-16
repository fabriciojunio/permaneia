import { beforeEach, describe, expect, it } from "vitest";
import { hostDe, validarOrigem } from "@/lib/csrf";
import {
  DURACAO_SEGUNDOS,
  NOME_COOKIE,
  assinarSessao,
  opcoesCookie,
  verificarSessao,
} from "@/lib/sessao";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres-ok";

beforeEach(() => {
  process.env.SESSION_SECRET = SEGREDO;
  process.env.NODE_ENV = "test";
});

describe("hostDe", () => {
  it.each([
    ["https://permaneia.app/rota", "permaneia.app"],
    ["http://localhost:3000", "localhost:3000"],
    ["https://sub.dominio.com.br:8443/x?y=1", "sub.dominio.com.br:8443"],
  ])("extrai o host de %s", (url, esperado) => {
    expect(hostDe(url)).toBe(esperado);
  });

  it.each([null, "", "não é url", "javascript:alert(1)x"])("devolve null para %s", (url) => {
    expect(hostDe(url as string | null)).toBeNull();
  });
});

describe("validarOrigem", () => {
  const HOST = "permaneia.app";

  it.each(["GET", "HEAD", "OPTIONS", "get", "head", "options"])(
    "libera o método seguro %s sem exigir origem",
    (metodo) => {
      expect(validarOrigem(metodo, true, null, null, HOST).permitido).toBe(true);
    }
  );

  it("libera navegação de página, que é GET e não altera estado", () => {
    expect(validarOrigem("POST", false, null, null, HOST).permitido).toBe(true);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "aceita %s na API quando o Origin confere com o host",
    (metodo) => {
      const r = validarOrigem(metodo, true, `https://${HOST}`, null, HOST);
      expect(r.permitido).toBe(true);
    }
  );

  it("aceita quando só o Referer confere", () => {
    expect(validarOrigem("POST", true, null, `https://${HOST}/login`, HOST).permitido).toBe(true);
  });

  it("prefere o Origin ao Referer quando os dois existem", () => {
    const r = validarOrigem("POST", true, "https://atacante.test", `https://${HOST}/x`, HOST);
    expect(r.permitido).toBe(false);
  });

  it.each([
    "https://atacante.test",
    "https://permaneia.app.atacante.test",
    "https://outro.app",
    "http://localhost:3000",
  ])("recusa escrita vinda de %s", (origem) => {
    const r = validarOrigem("POST", true, origem, null, HOST);
    expect(r.permitido).toBe(false);
    expect(r.status).toBe(403);
  });

  it("recusa escrita sem Origin nem Referer", () => {
    // Nenhum navegador envia escrita sem os dois. Requisição assim vem de
    // cliente automatizado, e a API não é feita para consumo externo.
    const r = validarOrigem("POST", true, null, null, HOST);
    expect(r.permitido).toBe(false);
    expect(r.status).toBe(403);
  });

  it("recusa quando o host do destino está ausente", () => {
    const r = validarOrigem("POST", true, `https://${HOST}`, null, null);
    expect(r.permitido).toBe(false);
    expect(r.status).toBe(400);
  });

  it("a porta faz parte da comparação", () => {
    expect(validarOrigem("POST", true, "http://localhost:3000", null, "localhost:3000").permitido).toBe(true);
    expect(validarOrigem("POST", true, "http://localhost:4000", null, "localhost:3000").permitido).toBe(false);
  });

  it("toda recusa traz motivo legível", () => {
    const r = validarOrigem("POST", true, "https://atacante.test", null, HOST);
    expect(r.motivo).toBeTruthy();
    expect(r.motivo!.length).toBeGreaterThan(10);
  });
});

describe("assinarSessao e verificarSessao", () => {
  const base = {
    usuarioId: "11111111-1111-1111-1111-111111111111",
    email: "pessoa@exemplo.test",
    nome: "Maria Antônia",
    papel: "coordenacao" as const,
    vs: 3,
  };

  it("assina e verifica de volta os mesmos dados", async () => {
    const token = await assinarSessao(base);
    const s = await verificarSessao(token);
    expect(s).not.toBeNull();
    expect(s!.usuarioId).toBe(base.usuarioId);
    expect(s!.email).toBe(base.email);
    expect(s!.nome).toBe(base.nome);
    expect(s!.papel).toBe(base.papel);
    expect(s!.vs).toBe(base.vs);
  });

  it("preserva acentuação no nome", async () => {
    const token = await assinarSessao({ ...base, nome: "João Conceição" });
    expect((await verificarSessao(token))!.nome).toBe("João Conceição");
  });

  it("preserva o vínculo com o aluno quando existe", async () => {
    const token = await assinarSessao({ ...base, papel: "aluno", alunoId: "a-1" });
    expect((await verificarSessao(token))!.alunoId).toBe("a-1");
  });

  it("omite alunoId quando não há vínculo", async () => {
    const token = await assinarSessao(base);
    expect((await verificarSessao(token))!.alunoId).toBeUndefined();
  });

  it("carrega a marca de troca de senha pendente", async () => {
    const token = await assinarSessao({ ...base, trocarSenha: true });
    expect((await verificarSessao(token))!.trocarSenha).toBe(true);
  });

  it("inclui expiração", async () => {
    const token = await assinarSessao(base);
    const s = await verificarSessao(token);
    expect(s!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it.each([undefined, "", "token-invalido", "a.b.c", "eyJhbGciOiJub25lIn0..", "null"])(
    "recusa o token %s",
    async (token) => {
      expect(await verificarSessao(token as string | undefined)).toBeNull();
    }
  );

  it("recusa token assinado com outro segredo", async () => {
    const token = await assinarSessao(base);
    process.env.SESSION_SECRET = "um-outro-segredo-completamente-diferente-32";
    expect(await verificarSessao(token)).toBeNull();
  });

  it("recusa token com o payload adulterado", async () => {
    const token = await assinarSessao({ ...base, papel: "aluno" });
    const [cabecalho, payload, assinatura] = token.split(".");
    const dados = JSON.parse(Buffer.from(payload!, "base64url").toString());
    dados.papel = "admin";
    const adulterado = Buffer.from(JSON.stringify(dados)).toString("base64url");
    expect(await verificarSessao(`${cabecalho}.${adulterado}.${assinatura}`)).toBeNull();
  });

  it("recusa papel desconhecido, mesmo com assinatura válida", async () => {
    // @ts-expect-error papel inválido de propósito
    const token = await assinarSessao({ ...base, papel: "superusuario" });
    expect(await verificarSessao(token)).toBeNull();
  });

  it("exige segredo com pelo menos 32 caracteres", async () => {
    process.env.SESSION_SECRET = "curto";
    await expect(assinarSessao(base)).rejects.toThrow(/32 caracteres/);
  });

  it("exige que o segredo exista", async () => {
    delete process.env.SESSION_SECRET;
    await expect(assinarSessao(base)).rejects.toThrow(/SESSION_SECRET/);
  });

  it("a versão da sessão viaja no token, o que permite revogação imediata", async () => {
    const token = await assinarSessao({ ...base, vs: 7 });
    expect((await verificarSessao(token))!.vs).toBe(7);
  });

  it("token sem versão declarada assume zero", async () => {
    // @ts-expect-error omissão proposital
    const token = await assinarSessao({ ...base, vs: undefined });
    expect((await verificarSessao(token))!.vs).toBe(0);
  });
});

describe("opcoesCookie", () => {
  it("é HttpOnly, para que script na página não leia o token", () => {
    expect(opcoesCookie().httpOnly).toBe(true);
  });

  it("usa SameSite lax", () => {
    // "strict" faria o cookie não acompanhar a navegação vinda de um link
    // externo, e o usuário cairia no login logo depois de entrar.
    expect(opcoesCookie().sameSite).toBe("lax");
  });

  it("é secure em produção", () => {
    process.env.NODE_ENV = "production";
    expect(opcoesCookie().secure).toBe(true);
  });

  it("não é secure fora de produção, senão o login local por http não funciona", () => {
    process.env.NODE_ENV = "development";
    expect(opcoesCookie().secure).toBe(false);
  });

  it("vale para o site inteiro", () => {
    expect(opcoesCookie().path).toBe("/");
  });

  it("expira junto com o token", () => {
    expect(opcoesCookie().maxAge).toBe(DURACAO_SEGUNDOS);
  });

  it("a duração é de uma jornada de estudo, e não de um mês", () => {
    expect(DURACAO_SEGUNDOS).toBeLessThanOrEqual(60 * 60 * 12);
    expect(DURACAO_SEGUNDOS).toBeGreaterThanOrEqual(60 * 60);
  });

  it("o nome do cookie não revela a tecnologia usada", () => {
    expect(NOME_COOKIE).not.toMatch(/jwt|jose|next|token/i);
  });
});
