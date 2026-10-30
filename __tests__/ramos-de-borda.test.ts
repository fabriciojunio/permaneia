import { afterEach, describe, expect, it, vi } from "vitest";
import { fundir } from "@/lib/rag/fusao";
import type { TrechoRecuperado } from "@/lib/rag/similaridade";

function trecho(chunkId: string, similaridade: number): TrechoRecuperado {
  return { chunkId, documentoId: "doc", titulo: "Plano", referencia: null, indice: 0, texto: chunkId, similaridade };
}

describe("fusão: desempate e similaridade", () => {
  it("empate de posição é decidido pela similaridade, e depois pelo identificador", () => {
    // Mesma posição em listas diferentes dá a mesma pontuação de fusão.
    const saida = fundir({
      vetoriais: [trecho("b", 0.4)],
      lexicos: [trecho("a", 0.9)],
    });
    expect(saida.map((t) => t.chunkId)).toEqual(["a", "b"]);

    const iguais = fundir({ vetoriais: [trecho("z", 0.5)], lexicos: [trecho("m", 0.5)] });
    expect(iguais.map((t) => t.chunkId)).toEqual(["m", "z"]);
  });

  it("o trecho que vem pelas duas buscas fica com a maior similaridade medida", () => {
    const saida = fundir({ vetoriais: [trecho("a", 0.3)], lexicos: [trecho("a", 0.8)] });
    expect(saida).toHaveLength(1);
    expect(saida[0]!.origemRecuperacao).toBe("ambos");
    expect(saida[0]!.similaridade).toBe(0.8);
  });

  it("maximo zero ainda devolve o melhor trecho", () => {
    const saida = fundir({ vetoriais: [trecho("a", 0.9), trecho("b", 0.8)], lexicos: [], maximo: 0 });
    expect(saida.map((t) => t.chunkId)).toEqual(["a"]);
  });
});

describe("cadastro restrito por domínio", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("com a lista preenchida, aceita o domínio e seus subdomínios e recusa o resto", async () => {
    vi.stubEnv("DOMINIOS_CADASTRO", " @Unisagrado.edu.br , exemplo.org ");
    const { dominioPermitido, DOMINIOS_PERMITIDOS } = await import("@/lib/cadastro");
    expect(DOMINIOS_PERMITIDOS).toEqual(["unisagrado.edu.br", "exemplo.org"]);
    expect(dominioPermitido("ana@unisagrado.edu.br")).toBe(true);
    expect(dominioPermitido("ana@aluno.unisagrado.edu.br")).toBe(true);
    expect(dominioPermitido("ana@unisagrado.edu.br.golpe.com")).toBe(false);
    expect(dominioPermitido("ana@gmail.com")).toBe(false);
    expect(dominioPermitido("sem-arroba")).toBe(false);
  });
});

describe("nível mínimo do log", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function emitidas(nivel: "debug" | "info" | "warn" | "error"): Promise<number> {
    const saida = vi.spyOn(console, "error").mockImplementation(() => {});
    const { logger } = await import("@/lib/logger");
    logger[nivel]("evento");
    return saida.mock.calls.length;
  }

  it("LOG_NIVEL configurado manda mais que o padrão do ambiente", async () => {
    vi.stubEnv("LOG_NIVEL", "warn");
    expect(await emitidas("info")).toBe(0);
    expect(await emitidas("warn")).toBe(1);
  });

  it("em produção, sem configuração, info sai e debug não", async () => {
    vi.stubEnv("LOG_NIVEL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(await emitidas("debug")).toBe(0);
    expect(await emitidas("info")).toBe(1);
  });

  it("em desenvolvimento, sem configuração, até debug sai", async () => {
    vi.stubEnv("LOG_NIVEL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(await emitidas("debug")).toBe(1);
  });
});
