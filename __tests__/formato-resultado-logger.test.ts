import { describe, expect, it } from "vitest";
import {
  formatarData,
  formatarDataHora,
  formatarNota,
  formatarNumero,
  formatarPercentual,
  formatarScore,
  iniciais,
  pluralizar,
  primeiroNome,
  resumir,
} from "@/lib/formato";
import { erro, falha, ok, statusHttp, type CodigoErro } from "@/lib/resultado";
import { limparContexto } from "@/lib/logger";

const NULOS = [null, undefined, Number.NaN];

describe("formatarScore", () => {
  it.each([
    [0, "0%"],
    [0.5, "50%"],
    [0.723, "72%"],
    [0.725, "73%"],
    [1, "100%"],
  ])("formata %s como %s", (v, esperado) => {
    expect(formatarScore(v)).toBe(esperado);
  });

  it.each(NULOS)("devolve travessão para %s", (v) => {
    expect(formatarScore(v as number | null | undefined)).toBe("—");
  });
});

describe("formatarPercentual", () => {
  it.each([
    [75, 1, "75,0%"],
    [75.46, 1, "75,5%"],
    [100, 0, "100%"],
    [0, 1, "0,0%"],
  ])("formata %s com %s casas como %s", (v, casas, esperado) => {
    expect(formatarPercentual(v, casas)).toBe(esperado);
  });

  it("usa vírgula decimal, que é o separador do português do Brasil", () => {
    expect(formatarPercentual(62.5)).toContain(",");
    expect(formatarPercentual(62.5)).not.toContain(".");
  });

  it.each(NULOS)("devolve travessão para %s", (v) => {
    expect(formatarPercentual(v as number | null)).toBe("—");
  });
});

describe("formatarNota", () => {
  it.each([
    [8.5, "8,5"],
    [10, "10,0"],
    [0, "0,0"],
    [6.25, "6,3"],
  ])("formata %s como %s", (v, esperado) => {
    expect(formatarNota(v)).toBe(esperado);
  });

  it.each(NULOS)("devolve travessão para %s", (v) => {
    expect(formatarNota(v as number | null)).toBe("—");
  });
});

describe("formatarNumero", () => {
  it.each([
    [0, "0"],
    [42, "42"],
    [1000, "1.000"],
    [1234567, "1.234.567"],
  ])("formata %s como %s", (v, esperado) => {
    expect(formatarNumero(v)).toBe(esperado);
  });

  it("usa ponto como separador de milhar", () => {
    expect(formatarNumero(1000)).toBe("1.000");
  });
});

describe("formatarDataHora e formatarData", () => {
  const iso = "2026-09-24T15:30:00.000Z";

  it("formata data e hora no fuso da instituição", () => {
    // 15:30 UTC é 12:30 em São Paulo.
    expect(formatarDataHora(iso)).toBe("24/09/2026, 12:30");
  });

  it("formata apenas a data", () => {
    expect(formatarData(iso)).toBe("24/09/2026");
  });

  it("aceita objeto Date", () => {
    expect(formatarData(new Date(iso))).toBe("24/09/2026");
  });

  it.each([null, undefined, "", "não é data"])("devolve travessão para %s", (v) => {
    expect(formatarData(v as string | null)).toBe("—");
    expect(formatarDataHora(v as string | null)).toBe("—");
  });

  it("usa o formato brasileiro de dia antes do mês", () => {
    expect(formatarData("2026-01-02T12:00:00.000Z")).toBe("02/01/2026");
  });
});

describe("primeiroNome", () => {
  it.each([
    ["Maria Antônia Souza", "Maria"],
    ["João", "João"],
    ["  Ana  Paula  ", "Ana"],
  ])("de %s devolve %s", (nome, esperado) => {
    expect(primeiroNome(nome)).toBe(esperado);
  });

  it("não quebra com texto vazio", () => {
    expect(() => primeiroNome("")).not.toThrow();
  });
});

describe("iniciais", () => {
  it.each([
    ["Maria Antônia Souza", "MS"],
    ["João Silva", "JS"],
    ["Ana", "AN"],
    ["", "?"],
    ["   ", "?"],
  ])("de %s devolve %s", (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado);
  });

  it("usa o primeiro e o último nome, e não os dois primeiros", () => {
    expect(iniciais("Ana Carolina Beatriz Zutter")).toBe("AZ");
  });

  it("devolve sempre em maiúsculas", () => {
    expect(iniciais("ana zutter")).toBe("AZ");
  });
});

describe("resumir", () => {
  it("devolve o texto inteiro quando ele já cabe", () => {
    expect(resumir("texto curto", 100)).toBe("texto curto");
  });

  it("corta e acrescenta reticências quando não cabe", () => {
    const r = resumir("a".repeat(300), 50);
    expect(r.length).toBeLessThanOrEqual(51);
    expect(r.endsWith("…")).toBe(true);
  });

  it("não quebra palavra ao meio quando dá para evitar", () => {
    const r = resumir("palavras separadas por espaço em um texto bem mais longo do que o limite", 30);
    expect(r.replace("…", "").trim().split(" ").pop()).not.toBe("es");
  });

  it("colapsa espaços em excesso", () => {
    expect(resumir("muitos     espaços    aqui", 100)).toBe("muitos espaços aqui");
  });

  it("remove quebras de linha, para caber numa linha de tabela", () => {
    expect(resumir("linha um\nlinha dois", 100)).toBe("linha um linha dois");
  });
});

describe("pluralizar", () => {
  it.each([
    [0, "0 documentos"],
    [1, "1 documento"],
    [2, "2 documentos"],
    [1000, "1.000 documentos"],
  ])("com %s devolve %s", (n, esperado) => {
    expect(pluralizar(n, "documento", "documentos")).toBe(esperado);
  });

  it("usa o singular apenas em exatamente um", () => {
    expect(pluralizar(1, "aula", "aulas")).toContain("aula");
    expect(pluralizar(1, "aula", "aulas")).not.toContain("aulas");
  });
});

describe("Resultado", () => {
  it("ok carrega o valor", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.valor).toBe(42);
  });

  it("falha carrega o erro", () => {
    const r = falha(erro("VALIDACAO", "campo inválido"));
    expect(r.ok).toBe(false);
    expect(r.erro.codigo).toBe("VALIDACAO");
  });

  it("erro aceita detalhamento por campo", () => {
    const e = erro("VALIDACAO", "confira", { email: "inválido" });
    expect(e.campos).toEqual({ email: "inválido" });
  });

  it("erro sem campos não cria a chave", () => {
    expect("campos" in erro("INTERNO", "x")).toBe(false);
  });

  it.each([
    ["NAO_ENCONTRADO", 404],
    ["VALIDACAO", 422],
    ["CONFLITO", 409],
    ["NAO_AUTORIZADO", 401],
    ["PROIBIDO", 403],
    ["LIMITE_EXCEDIDO", 429],
    ["INDISPONIVEL", 503],
    ["INTERNO", 500],
  ] as Array<[CodigoErro, number]>)("o código %s vira status %s", (codigo, status) => {
    expect(statusHttp(codigo)).toBe(status);
  });

  it("distingue não autorizado de proibido", () => {
    // Um pede login, o outro não tem o que fazer. Devolver 403 para sessão
    // expirada faria o cliente parar de oferecer o login.
    expect(statusHttp("NAO_AUTORIZADO")).toBe(401);
    expect(statusHttp("PROIBIDO")).toBe(403);
  });
});

describe("limparContexto do logger", () => {
  it.each([
    "senha",
    "senhaHash",
    "password",
    "token",
    "authorization",
    "cookie",
    "GEMINI_API_KEY",
    "apiKey",
    "SESSION_SECRET",
    "DATABASE_URL",
  ])("oculta o campo sensível %s", (campo) => {
    const limpo = limparContexto({ [campo]: "valor-secreto" }) as Record<string, unknown>;
    expect(limpo[campo]).toBe("[oculto]");
  });

  it("preserva campos comuns", () => {
    const limpo = limparContexto({ usuarioId: "u1", total: 5 }) as Record<string, unknown>;
    expect(limpo).toEqual({ usuarioId: "u1", total: 5 });
  });

  it("oculta em qualquer profundidade", () => {
    // O vazamento típico não vem de logar a senha de propósito, vem de logar um
    // objeto inteiro que por acaso a contém.
    const limpo = limparContexto({ a: { b: { c: { senha: "x" } } } }) as Record<string, unknown>;
    expect(JSON.stringify(limpo)).toContain("[oculto]");
    expect(JSON.stringify(limpo)).not.toContain('"x"');
  });

  it("corta profundidade excessiva em vez de recursar sem fim", () => {
    const profundo: Record<string, unknown> = {};
    let atual = profundo;
    for (let i = 0; i < 20; i += 1) {
      const proximo: Record<string, unknown> = {};
      atual.nivel = proximo;
      atual = proximo;
    }
    expect(JSON.stringify(limparContexto(profundo))).toContain("profundo demais");
  });

  it("converte Error em objeto legível, sem a pilha", () => {
    const limpo = limparContexto(new Error("falhou")) as Record<string, unknown>;
    expect(limpo).toEqual({ nome: "Error", mensagem: "falhou" });
    expect(limpo).not.toHaveProperty("stack");
  });

  it("limita o tamanho de listas", () => {
    const grande = Array.from({ length: 500 }, (_, i) => i);
    expect((limparContexto(grande) as unknown[]).length).toBeLessThanOrEqual(50);
  });

  it.each([null, undefined, 0, "", false])("preserva o primitivo %s", (v) => {
    expect(limparContexto(v)).toBe(v);
  });

  it("é insensível a maiúsculas no nome do campo", () => {
    const limpo = limparContexto({ SENHA: "x", Token: "y" }) as Record<string, unknown>;
    expect(limpo.SENHA).toBe("[oculto]");
    expect(limpo.Token).toBe("[oculto]");
  });
});
