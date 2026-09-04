import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  comRastroDeConsultas,
  nomeDeConsultaCrua,
  nomeDoTrecho,
  resumir,
  textoDoComando,
} from "@/lib/rastro-do-banco";

let nivelAnterior: string | undefined;

// O trecho sai em nível debug, e o padrão em teste é "error" (ver lib/logger.ts).
beforeEach(() => {
  nivelAnterior = process.env.LOG_NIVEL;
  process.env.LOG_NIVEL = "debug";
});

afterEach(() => {
  if (nivelAnterior === undefined) delete process.env.LOG_NIVEL;
  else process.env.LOG_NIVEL = nivelAnterior;
  vi.restoreAllMocks();
});

describe("nome do trecho de uma consulta escrita à mão", () => {
  it.each([
    ["select id from aluno where id = $1", "db select aluno"],
    ["SELECT * FROM Chunk ORDER BY id", "db select chunk"],
    ['select 1 from "Documento"', "db select documento"],
    ["insert into consulta (id) values ($1)", "db insert consulta"],
    ["update matricula set risco = $1 where id = $2", "db update matricula"],
    ["delete from sessao where expira_em < now()", "db delete sessao"],
  ])("reconhece %s", (comando, esperado) => {
    expect(nomeDeConsultaCrua(comando)).toBe(esperado);
  });

  it("separa a tabela do parêntese que vem colado", () => {
    expect(nomeDeConsultaCrua("insert into consulta(id) values ($1)")).toBe("db insert consulta");
  });

  it("cai num nome genérico para comando que não é dos quatro", () => {
    expect(nomeDeConsultaCrua("create extension if not exists vector")).toBe("db comando");
  });

  it("não quebra quando falta a palavra que marca a tabela", () => {
    expect(nomeDeConsultaCrua("select 1")).toBe("db select ?");
  });
});

describe("nome do trecho de uma operação do cliente", () => {
  it.each([
    ["findMany", "db select aluno"],
    ["findUnique", "db select aluno"],
    ["count", "db select aluno"],
    ["create", "db insert aluno"],
    ["upsert", "db update aluno"],
    ["deleteMany", "db delete aluno"],
  ])("traduz %s para o verbo em SQL", (operacao, esperado) => {
    expect(nomeDoTrecho("Aluno", operacao, {})).toBe(esperado);
  });

  it("usa o texto do comando quando a consulta é crua, que é o caso da busca vetorial", () => {
    expect(nomeDoTrecho(undefined, "$queryRaw", ["select id from chunk order by embedding <=> $1"])).toBe(
      "db select chunk"
    );
  });

  it("não inventa nome para operação que não conhece", () => {
    expect(nomeDoTrecho("Aluno", "$connect", {})).toBe("db comando");
  });

  it("agrupa por nome estável, e não por consulta individual", () => {
    // O ponto do agrupamento: duas execuções da mesma consulta com valores
    // diferentes têm que cair no mesmo balde, senão "qual consulta está lenta
    // em geral" deixa de ter resposta.
    const uma = nomeDoTrecho(undefined, "$queryRaw", ["select * from aluno where id = 1"]);
    const outra = nomeDoTrecho(undefined, "$queryRaw", ["select * from aluno where id = 2"]);
    expect(uma).toBe(outra);
  });
});

describe("leitura do texto do comando", () => {
  it("lê a string direta", () => {
    expect(textoDoComando("select 1")).toBe("select 1");
  });

  it("lê o primeiro argumento do array, que é como o Prisma entrega", () => {
    expect(textoDoComando(["select 1", 42])).toBe("select 1");
  });

  it("junta os pedaços do gabarito, pondo o marcador no lugar do valor", () => {
    expect(textoDoComando([["select * from aluno where id = ", ""]])).toBe(
      "select * from aluno where id = ?"
    );
  });

  it("lê as formas de objeto que a biblioteca usa", () => {
    expect(textoDoComando({ sql: "select 1" })).toBe("select 1");
    expect(textoDoComando({ text: "select 2" })).toBe("select 2");
    expect(textoDoComando({ strings: ["select * from aluno where id = ", ""] })).toBe(
      "select * from aluno where id = ?"
    );
  });

  it("devolve nulo em vez de falhar quando não reconhece o formato", () => {
    expect(textoDoComando(undefined)).toBeNull();
    expect(textoDoComando(42)).toBeNull();
    expect(textoDoComando({ outraCoisa: true })).toBeNull();
  });
});

describe("resumo do comando guardado no trecho", () => {
  it("achata a quebra de linha, para a consulta caber numa linha de log", () => {
    expect(resumir("select id\n  from aluno\n where id = $1")).toBe("select id from aluno where id = $1");
  });

  it("corta o comando enorme que ORM gera, porque ninguém lê o fim", () => {
    const resumido = resumir("select " + "coluna, ".repeat(300) + "from aluno");
    expect(resumido.length).toBe(503);
    expect(resumido.endsWith("...")).toBe(true);
  });

  it("guarda o gabarito, e nunca o valor do parâmetro", () => {
    // O que o trecho leva vai para telemetria e sai da aplicação. Matrícula,
    // e-mail e nome de aluno não têm por que passear por lá (ver LGPD.md).
    const comando = "select * from aluno where email = $1";
    expect(resumir(comando)).not.toContain("@");
    expect(resumir(comando)).toContain("$1");
  });
});

describe("instrumentação aplicada ao cliente", () => {
  /**
   * Um cliente de mentira que só sabe registrar a extensão e devolver o
   * interceptador, para exercitar o que de fato roda a cada consulta sem
   * precisar de banco. O teste de integração cobre o encaixe com o Prisma real.
   */
  function clienteFalso() {
    let interceptar: ((entrada: Record<string, unknown>) => Promise<unknown>) | undefined;
    const cliente = {
      $extends(extensao: {
        query: { $allOperations: (entrada: Record<string, unknown>) => Promise<unknown> };
      }) {
        interceptar = extensao.query.$allOperations;
        return cliente;
      },
    };
    return { cliente, executar: () => interceptar! };
  }

  function linhasDoLog() {
    return vi.spyOn(console, "error").mockImplementation(() => {});
  }

  it("devolve o resultado da consulta sem alterá-lo", async () => {
    const { cliente, executar } = clienteFalso();
    comRastroDeConsultas(cliente as never);

    const resultado = await executar()({
      model: "Aluno",
      operation: "findMany",
      args: {},
      query: async () => [{ id: "1" }],
    });

    expect(resultado).toEqual([{ id: "1" }]);
  });

  it("publica o trecho com a operação e o modelo", async () => {
    const linhas = linhasDoLog();
    const { cliente, executar } = clienteFalso();
    comRastroDeConsultas(cliente as never);

    await executar()({ model: "Aluno", operation: "findMany", args: {}, query: async () => [] });

    expect(JSON.parse(linhas.mock.calls[0]?.[0] as string).contexto).toMatchObject({
      trecho: "db select aluno",
      "db.system": "postgresql",
      "db.operation": "findMany",
      "db.model": "Aluno",
    });
  });

  it("guarda o gabarito da consulta crua, que é onde mora a busca vetorial", async () => {
    const linhas = linhasDoLog();
    const { cliente, executar } = clienteFalso();
    comRastroDeConsultas(cliente as never);

    await executar()({
      operation: "$queryRaw",
      args: ["select id from chunk where documento_id = $1"],
      query: async () => [],
    });

    const contexto = JSON.parse(linhas.mock.calls[0]?.[0] as string).contexto;
    expect(contexto.trecho).toBe("db select chunk");
    expect(contexto["db.statement"]).toBe("select id from chunk where documento_id = $1");
  });

  it("publica o trecho mesmo quando a consulta falha, e deixa o erro subir", async () => {
    // Sem isto, a consulta que estourou seria justamente a que some do rastro.
    const linhas = linhasDoLog();
    const { cliente, executar } = clienteFalso();
    comRastroDeConsultas(cliente as never);

    await expect(
      executar()({
        model: "Aluno",
        operation: "findMany",
        args: {},
        query: async () => {
          throw new Error("conexão recusada");
        },
      })
    ).rejects.toThrow("conexão recusada");

    expect(JSON.parse(linhas.mock.calls[0]?.[0] as string).contexto.trecho).toBe("db select aluno");
  });
});
