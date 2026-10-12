import { describe, expect, it } from "vitest";
import { validarBancoDeTeste } from "@/scripts/banco-de-teste";

describe("proteção das suítes que gravam dados", () => {
  it.each(["permaneia_test", "permaneia_e2e", "ci", "test_permaneia"])("aceita a base isolada %s", (nome) => {
    const url = `postgresql://ci:ci@127.0.0.1:5432/${nome}`;
    expect(validarBancoDeTeste(url)).toBe(url);
  });
  it.each([undefined, "inválida", "postgresql://usuario:segredo@servidor/permaneia", "postgresql://usuario:segredo@servidor/latest", "https://servidor/ci"])(
    "recusa configuração ausente ou sem identificação de teste", (valor) => {
      expect(() => validarBancoDeTeste(valor)).toThrow();
    }
  );
  it("não inclui as credenciais na mensagem de erro", () => {
    try { validarBancoDeTeste("postgresql://usuario:segredo@servidor/permaneia"); }
    catch (e) { expect(String(e)).not.toContain("segredo"); }
  });
});
