import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { versaoAtual } from "@/lib/versao";

const CHAVES = [
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL_ENV",
  "APP_COMMIT",
  "APP_RAMO",
  "APP_CONSTRUIDO_EM",
] as const;

let anterior: Record<string, string | undefined> = {};

beforeEach(() => {
  anterior = Object.fromEntries(CHAVES.map((chave) => [chave, process.env[chave]]));
  for (const chave of CHAVES) delete process.env[chave];
});

afterEach(() => {
  for (const chave of CHAVES) {
    const valor = anterior[chave];
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
});

describe("versão publicada", () => {
  it("lê o que a Vercel publica no ambiente da função", () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "80d4f7911223344556677889900aabbccddeeff0";
    process.env.VERCEL_GIT_COMMIT_REF = "main";
    process.env.VERCEL_ENV = "production";

    expect(versaoAtual()).toMatchObject({
      commit: "80d4f79",
      ramo: "main",
      ambiente: "production",
    });
  });

  it("aceita o que o build da imagem preenche, para quem roda fora da Vercel", () => {
    process.env.APP_COMMIT = "2df789b0000000000000000000000000000000aa";
    process.env.APP_RAMO = "main";

    expect(versaoAtual()).toMatchObject({ commit: "2df789b", ramo: "main" });
  });

  it("a variável da Vercel tem precedência, para o mesmo pacote servir nos dois lugares", () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.APP_COMMIT = "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    expect(versaoAtual().commit).toBe("1111111");
  });

  it("encurta o commit para sete caracteres, que bastam para achá-lo", () => {
    process.env.APP_COMMIT = "abcdef1234567890abcdef1234567890abcdef12";
    expect(versaoAtual().commit).toHaveLength(7);
  });

  it("diz que não sabe em vez de mentir, quando ninguém preencheu", () => {
    expect(versaoAtual()).toEqual({
      commit: "desconhecido",
      ramo: "desconhecido",
      construidoEm: "desconhecido",
      ambiente: expect.any(String),
    });
  });

  it("o instante da construção vem congelado do build, e não da hora da chamada", () => {
    process.env.APP_CONSTRUIDO_EM = "2026-09-04T12:00:00.000Z";
    expect(versaoAtual().construidoEm).toBe("2026-09-04T12:00:00.000Z");
  });
});
