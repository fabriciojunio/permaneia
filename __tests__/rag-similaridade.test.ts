import { describe, expect, it } from "vitest";
import {
  LIMIARES,
  LIMIAR_RELEVANCIA,
  MARGEM_DOMINANCIA,
  cosseno,
  distanciaParaSimilaridade,
  filtrarRelevantes,
  limiarDoProvedor,
  norma,
  produtoEscalar,
  removerRedundantes,
  similaridadeMaxima,
  sobreposicaoTextual,
  type TrechoRecuperado,
} from "@/lib/rag/similaridade";

function trecho(parcial: Partial<TrechoRecuperado> = {}): TrechoRecuperado {
  return {
    chunkId: "c1",
    documentoId: "d1",
    titulo: "Cronograma",
    referencia: "2026-2",
    indice: 0,
    texto: "Conteúdo do trecho.",
    similaridade: 0.5,
    ...parcial,
  };
}

describe("produtoEscalar", () => {
  it.each([
    [[1, 0], [1, 0], 1],
    [[1, 0], [0, 1], 0],
    [[1, 2, 3], [4, 5, 6], 32],
    [[0, 0], [0, 0], 0],
    [[-1, 2], [3, -4], -11],
  ])("de %o e %o é %s", (a, b, esperado) => {
    expect(produtoEscalar(a, b)).toBeCloseTo(esperado, 10);
  });

  it("rejeita vetores de dimensões diferentes", () => {
    expect(() => produtoEscalar([1, 2], [1, 2, 3])).toThrow(/dimensões diferentes/);
  });
});

describe("norma", () => {
  it.each([
    [[3, 4], 5],
    [[1, 0, 0], 1],
    [[0, 0], 0],
    [[1, 1], Math.SQRT2],
  ])("de %o é %s", (v, esperado) => {
    expect(norma(v)).toBeCloseTo(esperado, 10);
  });
});

describe("cosseno", () => {
  it.each([
    [[1, 0], [1, 0], 1],
    [[1, 0], [2, 0], 1],
    [[1, 0], [0, 1], 0],
    [[1, 0], [-1, 0], -1],
    [[1, 1], [1, 0], Math.SQRT1_2],
  ])("entre %o e %o é %s", (a, b, esperado) => {
    expect(cosseno(a, b)).toBeCloseTo(esperado, 10);
  });

  it("vetor nulo devolve zero, e não NaN", () => {
    expect(cosseno([0, 0], [1, 1])).toBe(0);
    expect(cosseno([1, 1], [0, 0])).toBe(0);
    expect(cosseno([0, 0], [0, 0])).toBe(0);
  });

  it("nunca escapa de [-1, 1], mesmo com acúmulo de ponto flutuante", () => {
    const v = new Array(768).fill(0.036);
    expect(cosseno(v, v)).toBeLessThanOrEqual(1);
    expect(cosseno(v, v)).toBeGreaterThanOrEqual(-1);
  });

  it("é simétrico", () => {
    const a = [0.2, 0.5, -0.3];
    const b = [0.1, -0.4, 0.9];
    expect(cosseno(a, b)).toBeCloseTo(cosseno(b, a), 12);
  });

  it("é invariante a escala", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(cosseno(a, b)).toBeCloseTo(cosseno(a.map((x) => x * 7), b), 10);
  });

  it("rejeita vetores de dimensões diferentes", () => {
    expect(() => cosseno([1], [1, 2])).toThrow(/dimensões diferentes/);
  });
});

describe("distanciaParaSimilaridade", () => {
  it.each([
    [0, 1],
    [0.5, 0.5],
    [1, 0],
    [1.5, -0.5],
    [2, -1],
  ])("distância %s vira similaridade %s", (d, esperado) => {
    expect(distanciaParaSimilaridade(d)).toBeCloseTo(esperado, 10);
  });

  it("prende o resultado em [-1, 1]", () => {
    expect(distanciaParaSimilaridade(5)).toBe(-1);
    expect(distanciaParaSimilaridade(-5)).toBe(1);
  });

  it("é monótona decrescente na distância", () => {
    let anterior = 2;
    for (let d = 0; d <= 2; d += 0.05) {
      const s = distanciaParaSimilaridade(d);
      expect(s).toBeLessThanOrEqual(anterior);
      anterior = s;
    }
  });
});

describe("limiares por provedor", () => {
  it("o limiar do Gemini é bem maior que o do provedor local", () => {
    // Os dois espaços de embedding têm geometrias diferentes: um número só
    // desligaria o assistente em um dos modos. Ver docs/AVALIACAO-RAG.md.
    expect(LIMIARES.gemini).toBeGreaterThan(LIMIARES.local);
  });

  it.each(["gemini", "local"] as const)("o limiar de %s fica em (0, 1)", (p) => {
    expect(LIMIARES[p]).toBeGreaterThan(0);
    expect(LIMIARES[p]).toBeLessThan(1);
  });

  it("limiarDoProvedor devolve o valor da tabela", () => {
    expect(limiarDoProvedor("gemini")).toBe(LIMIARES.gemini);
    expect(limiarDoProvedor("local")).toBe(LIMIARES.local);
  });

  it("o limiar padrão é o do provedor local, que é o modo de degradação", () => {
    expect(LIMIAR_RELEVANCIA).toBe(LIMIARES.local);
  });

  it("a margem de dominância é positiva e pequena", () => {
    expect(MARGEM_DOMINANCIA).toBeGreaterThan(0);
    expect(MARGEM_DOMINANCIA).toBeLessThan(0.5);
  });
});

describe("filtrarRelevantes", () => {
  it("descarta o que está abaixo do limiar", () => {
    const lista = [trecho({ similaridade: 0.9 }), trecho({ similaridade: 0.1 })];
    expect(filtrarRelevantes(lista, 0.5)).toHaveLength(1);
  });

  it("mantém o que empata com o limiar", () => {
    expect(filtrarRelevantes([trecho({ similaridade: 0.5 })], 0.5)).toHaveLength(1);
  });

  it("devolve lista vazia quando nada passa, que é o que faz o sistema admitir ignorância", () => {
    const lista = [trecho({ similaridade: 0.05 }), trecho({ similaridade: 0.02 })];
    expect(filtrarRelevantes(lista, 0.5)).toEqual([]);
  });

  it("preserva a ordem original", () => {
    const lista = [
      trecho({ chunkId: "a", similaridade: 0.9 }),
      trecho({ chunkId: "b", similaridade: 0.8 }),
      trecho({ chunkId: "c", similaridade: 0.7 }),
    ];
    expect(filtrarRelevantes(lista, 0.5).map((t) => t.chunkId)).toEqual(["a", "b", "c"]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(filtrarRelevantes([], 0.5)).toEqual([]);
  });

  it.each([0, 0.1, 0.25, 0.5, 0.75, 0.9, 1])("limiar %s nunca devolve item abaixo dele", (limiar) => {
    const lista = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 0.95].map((s) => trecho({ similaridade: s }));
    for (const t of filtrarRelevantes(lista, limiar)) {
      expect(t.similaridade).toBeGreaterThanOrEqual(limiar);
    }
  });

  it("limiar maior nunca devolve mais itens que limiar menor", () => {
    const lista = [0.1, 0.3, 0.5, 0.7, 0.9].map((s) => trecho({ similaridade: s }));
    let anterior = Number.POSITIVE_INFINITY;
    for (let l = 0; l <= 1; l += 0.1) {
      const total = filtrarRelevantes(lista, l).length;
      expect(total).toBeLessThanOrEqual(anterior);
      anterior = total;
    }
  });
});

describe("similaridadeMaxima", () => {
  it("devolve a maior da lista", () => {
    expect(similaridadeMaxima([0.2, 0.9, 0.5].map((s) => trecho({ similaridade: s })))).toBe(0.9);
  });

  it("lista vazia devolve zero", () => {
    expect(similaridadeMaxima([])).toBe(0);
  });

  it("similaridade negativa não é escolhida sobre o zero padrão", () => {
    expect(similaridadeMaxima([trecho({ similaridade: -0.5 })])).toBe(0);
  });
});

describe("sobreposicaoTextual", () => {
  it("textos idênticos têm sobreposição total", () => {
    expect(sobreposicaoTextual("a prova é amanhã", "a prova é amanhã")).toBe(1);
  });

  it("textos sem palavra em comum têm sobreposição nula", () => {
    expect(sobreposicaoTextual("alfa beta", "gama delta")).toBe(0);
  });

  it("texto vazio devolve zero", () => {
    expect(sobreposicaoTextual("", "qualquer")).toBe(0);
    expect(sobreposicaoTextual("qualquer", "")).toBe(0);
  });

  it("mede pela fração do texto menor", () => {
    expect(sobreposicaoTextual("prova", "a prova é amanhã na sala")).toBe(1);
  });

  it("ignora diferença de caixa", () => {
    expect(sobreposicaoTextual("PROVA", "prova")).toBe(1);
  });

  it("é simétrica", () => {
    const a = "cronograma da disciplina";
    const b = "cronograma completo";
    expect(sobreposicaoTextual(a, b)).toBeCloseTo(sobreposicaoTextual(b, a), 10);
  });
});

describe("removerRedundantes", () => {
  it("remove trecho praticamente idêntico do mesmo documento", () => {
    // A sobreposição do chunking faz o mesmo parágrafo cair em dois vetores
    // vizinhos; sem isso o contexto gastaria metade do espaço repetindo.
    const lista = [
      trecho({ chunkId: "a", texto: "O total de faltas não deve extrapolar os 25%." }),
      trecho({ chunkId: "b", texto: "O total de faltas não deve extrapolar os 25%." }),
    ];
    expect(removerRedundantes(lista)).toHaveLength(1);
  });

  it("mantém trechos com conteúdo diferente", () => {
    const lista = [
      trecho({ chunkId: "a", texto: "O limite de faltas é de 25 por cento." }),
      trecho({ chunkId: "b", texto: "A Prova P1 acontece em 24 de setembro de 2026." }),
    ];
    expect(removerRedundantes(lista)).toHaveLength(2);
  });

  it("não deduplica entre documentos diferentes", () => {
    // Dois documentos que dizem a mesma coisa são duas fontes, e citar as duas
    // é mais forte do que citar uma.
    const lista = [
      trecho({ chunkId: "a", documentoId: "d1", texto: "mesma frase exata aqui" }),
      trecho({ chunkId: "b", documentoId: "d2", texto: "mesma frase exata aqui" }),
    ];
    expect(removerRedundantes(lista)).toHaveLength(2);
  });

  it("preserva o primeiro de cada grupo redundante", () => {
    const lista = [
      trecho({ chunkId: "primeiro", texto: "texto repetido" }),
      trecho({ chunkId: "segundo", texto: "texto repetido" }),
    ];
    expect(removerRedundantes(lista)[0]!.chunkId).toBe("primeiro");
  });

  it("lista vazia devolve lista vazia", () => {
    expect(removerRedundantes([])).toEqual([]);
  });

  it("um trecho inteiramente contido no outro é redundante em qualquer limiar", () => {
    // A medida é a fração do texto MENOR presente no maior, então um subconjunto
    // estrito dá sempre 1. É o comportamento certo: o trecho curto não
    // acrescenta nada ao contexto que o longo já não traga.
    const lista = [
      trecho({ chunkId: "a", texto: "prova em setembro" }),
      trecho({ chunkId: "b", texto: "prova em setembro na sala" }),
    ];
    expect(removerRedundantes(lista, 0.99)).toHaveLength(1);
    expect(removerRedundantes(lista, 0.5)).toHaveLength(1);
  });

  it("com sobreposição parcial, o limiar decide", () => {
    const lista = [
      trecho({ chunkId: "a", texto: "prova em setembro na sala" }),
      trecho({ chunkId: "b", texto: "prova em outubro no laboratorio" }),
    ];
    expect(removerRedundantes(lista, 0.9)).toHaveLength(2);
    expect(removerRedundantes(lista, 0.3)).toHaveLength(1);
  });

  it("nunca devolve mais itens do que recebeu", () => {
    const lista = Array.from({ length: 10 }, (_, i) => trecho({ chunkId: String(i), texto: `texto ${i % 3}` }));
    expect(removerRedundantes(lista).length).toBeLessThanOrEqual(lista.length);
  });
});
