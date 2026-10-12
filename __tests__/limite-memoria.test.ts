import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumir, identificarCliente, limparExpirados, zerarLimites } from "@/lib/rate-limit";

beforeEach(zerarLimites);
afterEach(() => vi.unstubAllEnvs());

describe("limite de requisições sob pressão de memória", () => {
  it("não permite contornar o limite com x-real-ip quando o proxy não é confiável", () => {
    vi.stubEnv("RATE_LIMIT_CONFIA_PROXY", "false");
    const regra = { limite: 1, janelaMs: 60_000 };
    const cliente = (ip: string) => identificarCliente(new Headers({ "x-real-ip": ip }), "login");
    expect(consumir(cliente("203.0.113.1"), regra, 0).permitido).toBe(true);
    expect(consumir(cliente("203.0.113.2"), regra, 1).permitido).toBe(false);
  });

  it("mantém contadores ativos quando atinge a capacidade e libera espaço só na expiração", () => {
    const regra = { limite: 1, janelaMs: 60_000 };
    for (let i = 0; i < 10_000; i += 1) {
      expect(consumir(`cliente-${i}`, regra, 0).permitido).toBe(true);
    }
    expect(consumir("excedente", regra, 1).permitido).toBe(false);
    expect(consumir("cliente-0", regra, 1).permitido).toBe(false);
    expect(consumir("excedente", regra, 60_000).permitido).toBe(true);
  });

  it("não apaga o limite de cadastro de uma hora após dez minutos", () => {
    const regra = { limite: 1, janelaMs: 3_600_000 };
    consumir("cadastro", regra, 0);
    expect(limparExpirados(600_001)).toBe(0);
    expect(consumir("cadastro", regra, 600_002).permitido).toBe(false);
    expect(limparExpirados(3_600_000)).toBe(1);
    expect(consumir("cadastro", regra, 3_600_000).permitido).toBe(true);
  });
});
