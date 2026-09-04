import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { camposDeRastro, comRastro, emitirTrecho, medirTrecho, rastroAtual } from "@/lib/rastro-ativo";

const VALIDO = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

/** O logger escreve por console.error, inclusive nos níveis baixos (ver lib/logger.ts). */
function capturarLinhas() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

let nivelAnterior: string | undefined;

beforeEach(() => {
  // O nível padrão em teste é "error", então o trecho, que sai em debug, não
  // apareceria. Baixar o nível aqui é o que torna a emissão observável.
  nivelAnterior = process.env.LOG_NIVEL;
  process.env.LOG_NIVEL = "debug";
});

afterEach(() => {
  if (nivelAnterior === undefined) delete process.env.LOG_NIVEL;
  else process.env.LOG_NIVEL = nivelAnterior;
  vi.restoreAllMocks();
});

describe("rastro em andamento", () => {
  it("não existe fora de uma requisição, e isso é caso normal", () => {
    expect(rastroAtual()).toBeNull();
    expect(camposDeRastro()).toEqual({});
  });

  it("fica visível para tudo que roda abaixo, sem passar por parâmetro", () => {
    comRastro(VALIDO, () => {
      function bemLaEmbaixo() {
        return rastroAtual();
      }
      expect(bemLaEmbaixo()?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    });
  });

  it("atravessa o await, que é o ponto de tudo isto existir", async () => {
    await comRastro(VALIDO, async () => {
      await new Promise((resolva) => setTimeout(resolva, 5));
      expect(rastroAtual()?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    });
  });

  it("não vaza de um pedido para o outro", () => {
    comRastro(VALIDO, () => undefined);
    expect(rastroAtual()).toBeNull();
  });

  it("dois pedidos simultâneos não se misturam", async () => {
    const [um, outro] = await Promise.all([
      comRastro(`00-${"a".repeat(32)}-${"1".repeat(16)}-01`, async () => {
        await new Promise((resolva) => setTimeout(resolva, 10));
        return rastroAtual()?.traceId;
      }),
      comRastro(`00-${"b".repeat(32)}-${"2".repeat(16)}-01`, async () => rastroAtual()?.traceId),
    ]);

    expect(um).toBe("a".repeat(32));
    expect(outro).toBe("b".repeat(32));
  });

  it("os campos de correlação incluem o pai quando o rastro veio de fora", () => {
    comRastro(VALIDO, () => {
      expect(camposDeRastro()).toMatchObject({
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        paiSpanId: "00f067aa0ba902b7",
      });
    });
  });
});

describe("emissão de trecho", () => {
  it("sai como uma linha com nome, duração e correlação", () => {
    const linhas = capturarLinhas();

    comRastro(VALIDO, () => emitirTrecho("db select aluno", 42, { "db.system": "postgresql" }));

    const registrada = JSON.parse(linhas.mock.calls[0]?.[0] as string);
    expect(registrada.contexto).toMatchObject({
      trecho: "db select aluno",
      duracaoMs: 42,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      "db.system": "postgresql",
    });
  });

  it("sai mesmo sem rastro estabelecido, só sem os campos de correlação", () => {
    const linhas = capturarLinhas();

    emitirTrecho("tarefa agendada", 7);

    const registrada = JSON.parse(linhas.mock.calls[0]?.[0] as string);
    expect(registrada.contexto.trecho).toBe("tarefa agendada");
    expect(registrada.contexto.traceId).toBeUndefined();
  });
});

describe("medição de trecho", () => {
  it("devolve o valor da operação e publica o trecho", async () => {
    const linhas = capturarLinhas();

    const valor = await medirTrecho("consulta ao provedor", async () => "resposta");

    expect(valor).toBe("resposta");
    expect(JSON.parse(linhas.mock.calls[0]?.[0] as string).contexto.trecho).toBe("consulta ao provedor");
  });

  it("propaga a falha, mas deixa o trecho marcado antes de sair", async () => {
    const linhas = capturarLinhas();

    await expect(
      medirTrecho("consulta ao provedor", async () => {
        throw new Error("tempo esgotado");
      })
    ).rejects.toThrow("tempo esgotado");

    expect(JSON.parse(linhas.mock.calls[0]?.[0] as string).contexto.erro).toBe("tempo esgotado");
  });
});
