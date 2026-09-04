import { describe, expect, it } from "vitest";
import {
  abrirRastro,
  analisarRastro,
  CAMPO_RASTRO,
  idDeCorrelacao,
  paraCabecalho,
} from "@/lib/rastro";

const VALIDO = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("leitura do traceparent recebido", () => {
  it("reconhece o exemplo da especificação", () => {
    expect(analisarRastro(VALIDO)).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      flags: "01",
    });
  });

  it("aceita espaço em volta, que proxy costuma deixar", () => {
    expect(analisarRastro(`  ${VALIDO} `)?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("devolve nulo quando não veio nada, que é o caso do navegador", () => {
    expect(analisarRastro(null)).toBeNull();
    expect(analisarRastro(undefined)).toBeNull();
    expect(analisarRastro("")).toBeNull();
  });

  it.each([
    ["campo a menos", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7"],
    ["trace curto demais", "00-4bf92f35-00f067aa0ba902b7-01"],
    ["span longo demais", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b700-01"],
    ["letra fora do hexadecimal", "00-4bf92f3577b34da6a3ce929d0e0e473g-00f067aa0ba902b7-01"],
    ["separador trocado", "00_4bf92f3577b34da6a3ce929d0e0e4736_00f067aa0ba902b7_01"],
  ])("recusa cabeçalho malformado: %s", (_caso, cabecalho) => {
    expect(analisarRastro(cabecalho)).toBeNull();
  });

  it("recusa maiúscula, porque o identificador vira chave de busca do outro lado", () => {
    expect(analisarRastro(VALIDO.toUpperCase())).toBeNull();
  });

  it("recusa a versão ff, a única que a especificação declara inválida", () => {
    expect(analisarRastro(`ff-${"a".repeat(32)}-${"b".repeat(16)}-01`)).toBeNull();
  });

  it("aceita versão futura, que mantém os quatro primeiros campos no lugar", () => {
    expect(analisarRastro(`01-${"a".repeat(32)}-${"b".repeat(16)}-01`)?.traceId).toBe("a".repeat(32));
  });

  it("recusa identificador todo em zero, que a especificação reserva para 'sem rastro'", () => {
    expect(analisarRastro(`00-${"0".repeat(32)}-${"b".repeat(16)}-01`)).toBeNull();
    expect(analisarRastro(`00-${"a".repeat(32)}-${"0".repeat(16)}-01`)).toBeNull();
  });
});

describe("abertura de um trecho", () => {
  it("continua o rastro do cliente, mantendo o mesmo traceId", () => {
    const rastro = abrirRastro(VALIDO);
    expect(rastro.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("abre trecho filho, e não continua o mesmo, para separar os dois trabalhos", () => {
    const rastro = abrirRastro(VALIDO);
    expect(rastro.spanId).not.toBe("00f067aa0ba902b7");
    expect(rastro.paiSpanId).toBe("00f067aa0ba902b7");
  });

  it("herda a decisão de amostragem de quem chamou", () => {
    expect(abrirRastro(`00-${"a".repeat(32)}-${"b".repeat(16)}-00`).flags).toBe("00");
  });

  it("começa um rastro novo quando não veio nada, sem pai", () => {
    const rastro = abrirRastro(null);
    expect(rastro.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(rastro.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(rastro.paiSpanId).toBeUndefined();
    expect(rastro.flags).toBe("01");
  });

  it("começa um rastro novo quando o cabeçalho veio quebrado, em vez de falhar", () => {
    expect(abrirRastro("lixo").traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("não repete identificador entre pedidos diferentes", () => {
    const traces = new Set(Array.from({ length: 200 }, () => abrirRastro(null).traceId));
    expect(traces.size).toBe(200);
  });
});

describe("valor devolvido no cabeçalho", () => {
  it("sai no formato que a especificação exige, e volta igual na leitura", () => {
    const rastro = abrirRastro(VALIDO);
    const cabecalho = paraCabecalho(rastro);

    expect(cabecalho).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
    expect(analisarRastro(cabecalho)).toEqual({
      traceId: rastro.traceId,
      spanId: rastro.spanId,
      flags: rastro.flags,
    });
  });

  it("o identificador mostrado ao usuário é o traceId, e não um número à parte", () => {
    const rastro = abrirRastro(VALIDO);
    expect(idDeCorrelacao(rastro)).toBe(rastro.traceId);
  });

  it("o nome do campo é o do padrão, que é o que o outro lado procura", () => {
    expect(CAMPO_RASTRO).toBe("traceparent");
  });
});
