import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  gerarEmbeddingComFallback,
  gerarEmbeddingsComFallback,
  gerarTextoComFallback,
  origemAtual,
  provedorLocal,
} from "@/lib/ia";
import { DIMENSAO_EMBEDDING, ErroProvedorIA } from "@/lib/ia/provedor";
import { embeddingLocal } from "@/lib/ia/local";
import { CONTAS_DEMO } from "@/lib/demo";
import { logger } from "@/lib/logger";

const PROMPT = "<contexto>\n[Doc]\nO limite de faltas é de 25%.\n</contexto>\n<pergunta>\nlimite de faltas\n</pergunta>";

const ambienteOriginal = { ...process.env };

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  process.env.IA_EXTERNA = "on";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env = { ...ambienteOriginal };
});

describe("origemAtual", () => {
  it("sem chave configurada, o sistema opera no provedor local", () => {
    expect(origemAtual()).toBe("local");
  });

  it("com chave configurada, o sistema opera no Gemini", () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    expect(origemAtual()).toBe("gemini");
  });

  it("IA_EXTERNA desligada força o provedor local mesmo com chave", () => {
    // Serve à demonstração offline e aos testes de integração.
    process.env.GEMINI_API_KEY = "chave-de-teste";
    process.env.IA_EXTERNA = "off";
    expect(origemAtual()).toBe("local");
  });

  it("chave vazia conta como ausente", () => {
    process.env.GEMINI_API_KEY = "";
    expect(origemAtual()).toBe("local");
  });
});

describe("gerarTextoComFallback", () => {
  it("sem provedor externo, responde pelo local e diz o motivo", async () => {
    const r = await gerarTextoComFallback(PROMPT);
    expect(r.origem).toBe("local");
    expect(r.motivoFallback).toMatch(/não configurado/i);
    expect(r.valor).toContain("25%");
  });

  it("com o provedor externo respondendo, usa a resposta dele", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "O limite é de 25% [Doc]." }] } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const r = await gerarTextoComFallback(PROMPT);
    expect(r.origem).toBe("gemini");
    expect(r.valor).toBe("O limite é de 25% [Doc].");
    expect(r.motivoFallback).toBeUndefined();
  });

  it("quando o provedor externo falha, o local assume e a aplicação continua respondendo", async () => {
    // Do ponto de vista do aluno na frente da tela, uma resposta extraída do
    // documento é sempre melhor do que uma tela de erro.
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("cota esgotada", { status: 429 })));
    const r = await gerarTextoComFallback(PROMPT);
    expect(r.origem).toBe("local");
    expect(r.motivoFallback).toContain("429");
    expect(r.valor).toContain("25%");
  });

  it.each([400, 401, 403, 429, 500, 503])("cai no local diante do status %s", async (status) => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status })));
    const r = await gerarTextoComFallback(PROMPT);
    expect(r.origem).toBe("local");
  });

  it("cai no local diante de falha de rede", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const r = await gerarTextoComFallback(PROMPT);
    expect(r.origem).toBe("local");
    expect(r.motivoFallback).toMatch(/rede|ECONNREFUSED/i);
  });

  it("cai no local quando o provedor externo devolve resposta vazia", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ candidates: [{ finishReason: "SAFETY" }] }), { status: 200 })
      )
    );
    const r = await gerarTextoComFallback(PROMPT);
    expect(r.origem).toBe("local");
  });

  it("nunca lança: a rota sempre recebe uma resposta", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("qualquer coisa"); }));
    await expect(gerarTextoComFallback(PROMPT)).resolves.toBeDefined();
  });
});

describe("gerarEmbeddingsComFallback", () => {
  it("lote vazio devolve lista vazia sem chamar provedor algum", async () => {
    const chamadas = vi.fn();
    vi.stubGlobal("fetch", chamadas);
    const r = await gerarEmbeddingsComFallback([]);
    expect(r.valor).toEqual([]);
    expect(chamadas).not.toHaveBeenCalled();
  });

  it("sem chave, gera pelo provedor local", async () => {
    const r = await gerarEmbeddingsComFallback(["primeiro", "segundo"]);
    expect(r.origem).toBe("local");
    expect(r.valor).toHaveLength(2);
    expect(r.valor[0]).toEqual(embeddingLocal("primeiro"));
  });

  it("todos os vetores têm a dimensão do contrato", async () => {
    const r = await gerarEmbeddingsComFallback(["a", "b", "c"]);
    for (const v of r.valor) expect(v).toHaveLength(DIMENSAO_EMBEDDING);
  });

  it("quando o Gemini falha, cai no local e MARCA a origem", async () => {
    // A origem precisa ser gravada junto com os vetores: vetor do Gemini e
    // vetor local vivem em espaços diferentes, e comparar um com o outro
    // produz um número que parece similaridade e não significa nada.
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("falhou", { status: 500 })));
    const r = await gerarEmbeddingsComFallback(["texto"]);
    expect(r.origem).toBe("local");
    expect(r.motivoFallback).toBeTruthy();
  });

  it("cai no local quando o lote volta incompleto", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ embeddings: [{ values: new Array(DIMENSAO_EMBEDDING).fill(0.1) }] }), {
          status: 200,
        })
      )
    );
    const r = await gerarEmbeddingsComFallback(["um", "dois"]);
    expect(r.origem).toBe("local");
    expect(r.valor).toHaveLength(2);
  });

  it("cai no local quando o vetor volta com dimensão errada", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ embeddings: [{ values: [1, 2, 3] }] }), { status: 200 }))
    );
    const r = await gerarEmbeddingsComFallback(["um"]);
    expect(r.origem).toBe("local");
  });
});

describe("gerarEmbeddingComFallback", () => {
  it("devolve um único vetor", async () => {
    const r = await gerarEmbeddingComFallback("uma pergunta qualquer");
    expect(r.valor).toHaveLength(DIMENSAO_EMBEDDING);
    expect(r.origem).toBe("local");
  });

  it("é determinístico no modo local", async () => {
    const a = await gerarEmbeddingComFallback("mesma pergunta");
    const b = await gerarEmbeddingComFallback("mesma pergunta");
    expect(a.valor).toEqual(b.valor);
  });
});

describe("ErroProvedorIA", () => {
  it("carrega o provedor e a recuperabilidade", () => {
    const e = new ErroProvedorIA("gemini", "cota esgotada", true);
    expect(e.provedor).toBe("gemini");
    expect(e.recuperavel).toBe(true);
    expect(e.name).toBe("ErroProvedorIA");
  });

  it("é uma instância de Error, para o catch genérico funcionar", () => {
    expect(new ErroProvedorIA("local", "x")).toBeInstanceOf(Error);
  });
});

describe("provedorLocal", () => {
  it("é exposto para os testes e scripts injetarem provedor controlado", () => {
    expect(provedorLocal().nome).toBe("local");
    expect(provedorLocal().disponivel()).toBe(true);
  });
});

describe("contas de demonstração", () => {
  it("existem contas de coordenação e de aluno", () => {
    expect(CONTAS_DEMO.map((c) => c.papel).sort()).toEqual(["aluno", "coordenacao"]);
  });

  it.each(CONTAS_DEMO)("a conta $papel usa o domínio reservado .exemplo", (conta) => {
    // O domínio .exemplo é reservado pela RFC 2606 e nunca será registrado,
    // então nenhum destes endereços pode existir de verdade.
    expect(conta.email).toMatch(/\.exemplo$/);
  });

  it.each(CONTAS_DEMO)("a conta $papel descreve o que o visitante vai ver", (conta) => {
    expect(conta.descricao.length).toBeGreaterThan(20);
  });

  it("nenhuma conta de demonstração é administradora", () => {
    expect(CONTAS_DEMO.some((c) => String(c.papel) === "admin")).toBe(false);
  });
});

describe("logger", () => {
  it.each(["debug", "info", "warn", "error"] as const)("o nível %s existe e não lança", (nivel) => {
    process.env.LOG_NIVEL = "debug";
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => logger[nivel]("mensagem de teste")).not.toThrow();
    espia.mockRestore();
  });

  it("emite uma linha de JSON válido", () => {
    process.env.LOG_NIVEL = "debug";
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.info("teste", { usuarioId: "u1" });
    const linha = espia.mock.calls[0]?.[0] as string;
    espia.mockRestore();
    const objeto = JSON.parse(linha);
    expect(objeto.nivel).toBe("info");
    expect(objeto.mensagem).toBe("teste");
    expect(objeto.contexto).toEqual({ usuarioId: "u1" });
    expect(objeto.momento).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("oculta campo sensível também no caminho de emissão", () => {
    process.env.LOG_NIVEL = "debug";
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("falha ao entrar", { email: "a@b.com", senha: "segredo" });
    const linha = espia.mock.calls[0]?.[0] as string;
    espia.mockRestore();
    expect(linha).not.toContain("segredo");
    expect(linha).toContain("[oculto]");
  });

  it("respeita o nível mínimo configurado", () => {
    process.env.LOG_NIVEL = "warn";
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.debug("não deve sair");
    logger.info("também não");
    logger.warn("esta sai");
    expect(espia).toHaveBeenCalledTimes(1);
    espia.mockRestore();
  });

  it("omite o contexto quando não é informado", () => {
    process.env.LOG_NIVEL = "debug";
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.info("sem contexto");
    const objeto = JSON.parse(espia.mock.calls[0]?.[0] as string);
    espia.mockRestore();
    expect(objeto).not.toHaveProperty("contexto");
  });
});
