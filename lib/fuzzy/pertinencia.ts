// Funções de pertinência do sistema fuzzy.
//
// Uma função de pertinência mapeia um valor nítido (crisp) do universo de
// discurso para o grau com que ele pertence a um conjunto fuzzy, entre 0 e 1.
// Só usamos as duas formas clássicas de Mamdani, triangular e trapezoidal:
// juntas descrevem "baixo/médio/alto" sem precisar de derivada nem de
// gaussianas, e são fáceis de desenhar no quadro durante a apresentação.

/** Descrição serializável de uma função de pertinência, útil para a API e para os gráficos do dashboard. */
export type FormaPertinencia =
  | { tipo: "triangular"; pontos: [number, number, number] }
  | { tipo: "trapezoidal"; pontos: [number, number, number, number] };

export type FuncaoPertinencia = (x: number) => number;

/** Garante que o grau devolvido nunca escape do intervalo [0, 1] por erro de ponto flutuante. */
function limitar(grau: number): number {
  if (Number.isNaN(grau)) return 0;
  if (grau < 0) return 0;
  if (grau > 1) return 1;
  return grau;
}

/**
 * Pertinência triangular definida por (a, b, c): sobe de `a` até o pico em `b`
 * e desce até `c`. Quando `a === b` (ou `b === c`) o lado correspondente vira
 * um degrau, o que permite ancorar o conjunto na borda do universo.
 */
export function triangular(a: number, b: number, c: number): FuncaoPertinencia {
  if (!(a <= b && b <= c)) {
    throw new Error(`Triangular inválida: exige a <= b <= c, recebido (${a}, ${b}, ${c}).`);
  }
  return (x: number): number => {
    if (Number.isNaN(x)) return 0;
    if (x <= a || x >= c) {
      // Pico degenerado na borda: um triângulo (a, a, a) só tem pertinência em x === a.
      if (a === b && b === c && x === a) return 1;
      return 0;
    }
    if (x === b) return 1;
    if (x < b) return limitar((x - a) / (b - a));
    return limitar((c - x) / (c - b));
  };
}

/**
 * Pertinência trapezoidal definida por (a, b, c, d): sobe de `a` a `b`, fica em
 * 1 no platô entre `b` e `c`, e desce de `c` a `d`. É a forma usada nos
 * conjuntos das pontas ("frequência alta", "risco crítico"), em que existe uma
 * faixa inteira de valores igualmente representativos do rótulo.
 */
export function trapezoidal(a: number, b: number, c: number, d: number): FuncaoPertinencia {
  if (!(a <= b && b <= c && c <= d)) {
    throw new Error(`Trapezoidal inválida: exige a <= b <= c <= d, recebido (${a}, ${b}, ${c}, ${d}).`);
  }
  return (x: number): number => {
    if (Number.isNaN(x)) return 0;
    if (x >= b && x <= c) return 1;
    if (x <= a || x >= d) return 0;
    if (x < b) return limitar((x - a) / (b - a));
    return limitar((d - x) / (d - c));
  };
}

/** Constrói a função a partir da descrição serializável. */
export function construir(forma: FormaPertinencia): FuncaoPertinencia {
  if (forma.tipo === "triangular") {
    const [a, b, c] = forma.pontos;
    return triangular(a, b, c);
  }
  const [a, b, c, d] = forma.pontos;
  return trapezoidal(a, b, c, d);
}

/** Menor e maior valor com pertinência possivelmente não nula. Usado para desenhar o conjunto. */
export function suporte(forma: FormaPertinencia): { inicio: number; fim: number } {
  const pontos = forma.pontos;
  return { inicio: pontos[0], fim: pontos[pontos.length - 1] as number };
}
