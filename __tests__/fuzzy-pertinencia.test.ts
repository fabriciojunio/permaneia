import { describe, expect, it } from "vitest";
import {
  construir,
  suporte,
  trapezoidal,
  triangular,
  type FormaPertinencia,
} from "@/lib/fuzzy/pertinencia";

describe("triangular", () => {
  const t = triangular(0, 5, 10);

  it.each([
    [-100, 0],
    [-1, 0],
    [0, 0],
    [1, 0.2],
    [2, 0.4],
    [2.5, 0.5],
    [3, 0.6],
    [4, 0.8],
    [5, 1],
    [6, 0.8],
    [7, 0.6],
    [7.5, 0.5],
    [8, 0.4],
    [9, 0.2],
    [10, 0],
    [11, 0],
    [1000, 0],
  ])("grau em x=%s é %s", (x, esperado) => {
    expect(t(x)).toBeCloseTo(esperado, 10);
  });

  it("atinge exatamente 1 no pico", () => {
    expect(t(5)).toBe(1);
  });

  it("é simétrica quando o pico está no meio", () => {
    for (let d = 0; d <= 5; d += 0.25) {
      expect(t(5 - d)).toBeCloseTo(t(5 + d), 10);
    }
  });

  it("nunca sai do intervalo [0, 1]", () => {
    for (let x = -20; x <= 30; x += 0.1) {
      const g = t(x);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  it("trata NaN como pertinência nula, em vez de propagar", () => {
    expect(t(Number.NaN)).toBe(0);
  });

  it.each([
    [0, 0, 10],
    [0, 10, 10],
    [3, 3, 3],
  ])("aceita lados degenerados (%s, %s, %s)", (a, b, c) => {
    expect(() => triangular(a, b, c)).not.toThrow();
  });

  it("com a === b, o lado esquerdo vira degrau", () => {
    const degrau = triangular(0, 0, 10);
    expect(degrau(0)).toBe(0);
    expect(degrau(0.001)).toBeGreaterThan(0.99);
    expect(degrau(5)).toBeCloseTo(0.5, 10);
  });

  it("com b === c, o lado direito vira degrau", () => {
    const degrau = triangular(0, 10, 10);
    expect(degrau(5)).toBeCloseTo(0.5, 10);
    expect(degrau(9.999)).toBeGreaterThan(0.99);
    expect(degrau(10)).toBe(0);
  });

  it("com a === b === c, só o próprio ponto tem pertinência", () => {
    const ponto = triangular(4, 4, 4);
    expect(ponto(4)).toBe(1);
    expect(ponto(3.999)).toBe(0);
    expect(ponto(4.001)).toBe(0);
  });

  it.each([
    [5, 1, 10],
    [0, 10, 5],
    [10, 5, 0],
    [1, 0, 2],
  ])("rejeita pontos fora de ordem (%s, %s, %s)", (a, b, c) => {
    expect(() => triangular(a, b, c)).toThrow(/a <= b <= c/);
  });

  it("cresce estritamente no lado de subida", () => {
    let anterior = -1;
    for (let x = 0; x <= 5; x += 0.1) {
      const atual = t(x);
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
  });

  it("decresce estritamente no lado de descida", () => {
    let anterior = 2;
    for (let x = 5; x <= 10; x += 0.1) {
      const atual = t(x);
      expect(atual).toBeLessThanOrEqual(anterior);
      anterior = atual;
    }
  });
});

describe("trapezoidal", () => {
  const tz = trapezoidal(0, 2, 8, 10);

  it.each([
    [-5, 0],
    [0, 0],
    [0.5, 0.25],
    [1, 0.5],
    [1.5, 0.75],
    [2, 1],
    [4, 1],
    [5, 1],
    [6, 1],
    [8, 1],
    [8.5, 0.75],
    [9, 0.5],
    [9.5, 0.25],
    [10, 0],
    [15, 0],
  ])("grau em x=%s é %s", (x, esperado) => {
    expect(tz(x)).toBeCloseTo(esperado, 10);
  });

  it("mantém pertinência 1 em todo o platô", () => {
    for (let x = 2; x <= 8; x += 0.1) {
      expect(tz(x)).toBe(1);
    }
  });

  it("nunca sai do intervalo [0, 1]", () => {
    for (let x = -20; x <= 30; x += 0.1) {
      const g = tz(x);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  it("trata NaN como pertinência nula", () => {
    expect(tz(Number.NaN)).toBe(0);
  });

  it("com a === b, ancora o conjunto na borda esquerda do universo", () => {
    const borda = trapezoidal(0, 0, 3, 6);
    expect(borda(0)).toBe(1);
    expect(borda(3)).toBe(1);
    expect(borda(4.5)).toBeCloseTo(0.5, 10);
    expect(borda(6)).toBe(0);
  });

  it("com c === d, ancora o conjunto na borda direita", () => {
    const borda = trapezoidal(4, 7, 10, 10);
    expect(borda(4)).toBe(0);
    expect(borda(5.5)).toBeCloseTo(0.5, 10);
    expect(borda(7)).toBe(1);
    expect(borda(10)).toBe(1);
  });

  it("com b === c, degenera em um triângulo", () => {
    const tzTri = trapezoidal(0, 5, 5, 10);
    const tri = triangular(0, 5, 10);
    for (let x = -2; x <= 12; x += 0.25) {
      expect(tzTri(x)).toBeCloseTo(tri(x), 10);
    }
  });

  it.each([
    [0, 5, 3, 10],
    [10, 2, 8, 0],
    [0, 2, 8, 1],
    [5, 4, 8, 10],
  ])("rejeita pontos fora de ordem (%s, %s, %s, %s)", (a, b, c, d) => {
    expect(() => trapezoidal(a, b, c, d)).toThrow(/a <= b <= c <= d/);
  });

  it("é monótona não decrescente até o platô", () => {
    let anterior = -1;
    for (let x = 0; x <= 2; x += 0.05) {
      const atual = tz(x);
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
  });

  it("é monótona não crescente depois do platô", () => {
    let anterior = 2;
    for (let x = 8; x <= 10; x += 0.05) {
      const atual = tz(x);
      expect(atual).toBeLessThanOrEqual(anterior);
      anterior = atual;
    }
  });
});

describe("construir", () => {
  const formas: FormaPertinencia[] = [
    { tipo: "triangular", pontos: [0, 5, 10] },
    { tipo: "triangular", pontos: [2, 2, 8] },
    { tipo: "trapezoidal", pontos: [0, 1, 4, 5] },
    { tipo: "trapezoidal", pontos: [0, 0, 3, 6] },
  ];

  it.each(formas)("constrói a forma %o e devolve função avaliável", (forma) => {
    const f = construir(forma);
    expect(typeof f).toBe("function");
    expect(f(0)).toBeGreaterThanOrEqual(0);
  });

  it("a forma triangular construída coincide com a função direta", () => {
    const f = construir({ tipo: "triangular", pontos: [1, 4, 9] });
    const direta = triangular(1, 4, 9);
    for (let x = 0; x <= 10; x += 0.2) {
      expect(f(x)).toBeCloseTo(direta(x), 10);
    }
  });

  it("a forma trapezoidal construída coincide com a função direta", () => {
    const f = construir({ tipo: "trapezoidal", pontos: [1, 3, 6, 9] });
    const direta = trapezoidal(1, 3, 6, 9);
    for (let x = 0; x <= 10; x += 0.2) {
      expect(f(x)).toBeCloseTo(direta(x), 10);
    }
  });
});

describe("suporte", () => {
  it.each([
    [{ tipo: "triangular", pontos: [0, 5, 10] } as FormaPertinencia, 0, 10],
    [{ tipo: "triangular", pontos: [2, 3, 4] } as FormaPertinencia, 2, 4],
    [{ tipo: "trapezoidal", pontos: [1, 2, 8, 9] } as FormaPertinencia, 1, 9],
    [{ tipo: "trapezoidal", pontos: [0, 0, 100, 100] } as FormaPertinencia, 0, 100],
  ])("devolve início e fim de %o", (forma, inicio, fim) => {
    expect(suporte(forma)).toEqual({ inicio, fim });
  });

  it("fora do suporte a pertinência é sempre nula", () => {
    const forma: FormaPertinencia = { tipo: "trapezoidal", pontos: [10, 20, 30, 40] };
    const f = construir(forma);
    const { inicio, fim } = suporte(forma);
    expect(f(inicio - 0.001)).toBe(0);
    expect(f(fim + 0.001)).toBe(0);
  });
});
