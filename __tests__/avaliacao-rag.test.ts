import { describe, expect, it } from "vitest";
import { configuracaoAvaliacao } from "../scripts/lib/configuracao-avaliacao-rag";

describe("parâmetros da avaliação de RAG", () => {
  it.each(["", " ", "NaN", "abc", "Infinity", "-0.1", "1.1"])(
    "rejeita o limiar inválido %s antes de executar a avaliação", (valor) => {
      expect(() => configuracaoAvaliacao(valor, undefined, "local")).toThrow(/limiar/);
    },
  );
  it("preserva a escolha automática do provedor e a data de referência", () => {
    const config = configuracaoAvaliacao(undefined, "2026-10-13", "local");
    expect(config.limiar).toBeUndefined();
    expect(config.hoje.toISOString()).toBe("2026-10-13T15:00:00.000Z");
    expect(config.pausaMs).toBe(0);
  });
  it("aceita limiares de borda sem remover a pausa do provedor externo", () => {
    expect(configuracaoAvaliacao("0", undefined, "gemini").limiar).toBe(0);
    expect(configuracaoAvaliacao("1", undefined, "gemini").limiar).toBe(1);
    expect(configuracaoAvaliacao("0.65", undefined, "gemini").pausaMs).toBe(4_000);
  });
  it.each(["2026-02-29", "2026-02-30", "2026-13-01", "13/10/2026", ""])(
    "rejeita data impossível ou ambígua %s", (data) => {
      expect(() => configuracaoAvaliacao(undefined, data, "local")).toThrow(/data válida/);
    },
  );
  it("aceita o dia adicional de um ano bissexto", () => {
    expect(configuracaoAvaliacao(undefined, "2028-02-29", "local").hoje.getUTCDate()).toBe(29);
  });
});
