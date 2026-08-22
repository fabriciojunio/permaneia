import { describe, expect, it } from "vitest";
import { AMORTECIMENTO, fundir } from "@/lib/rag/fusao";
import type { TrechoRecuperado } from "@/lib/rag/similaridade";

function trecho(chunkId: string, similaridade = 0.7): TrechoRecuperado {
  return {
    chunkId,
    documentoId: "doc",
    titulo: "Cronograma de aulas",
    referencia: null,
    indice: 0,
    texto: `texto ${chunkId}`,
    similaridade,
  };
}

describe("fusão das duas recuperações", () => {
  it("devolve vazio quando as duas buscas voltam vazias", () => {
    expect(fundir({ vetoriais: [], lexicos: [] })).toEqual([]);
  });

  it("mantém a lista vetorial quando não há acerto léxico", () => {
    const saida = fundir({ vetoriais: [trecho("a"), trecho("b")], lexicos: [] });
    expect(saida.map((t) => t.chunkId)).toEqual(["a", "b"]);
  });

  it("aproveita o acerto léxico quando a busca vetorial não achou nada", () => {
    const saida = fundir({ vetoriais: [], lexicos: [trecho("c")] });
    expect(saida.map((t) => t.chunkId)).toEqual(["c"]);
  });

  it("não repete o trecho que as duas buscas encontraram", () => {
    const saida = fundir({ vetoriais: [trecho("a")], lexicos: [trecho("a")] });
    expect(saida).toHaveLength(1);
  });

  it("põe na frente o trecho que as duas buscas concordam em indicar", () => {
    const saida = fundir({
      vetoriais: [trecho("so-vetorial"), trecho("as-duas")],
      lexicos: [trecho("as-duas"), trecho("so-lexico")],
    });
    expect(saida[0]!.chunkId).toBe("as-duas");
  });

  it("marca a origem de cada trecho", () => {
    const saida = fundir({
      vetoriais: [trecho("v"), trecho("ambos")],
      lexicos: [trecho("ambos"), trecho("l")],
    });
    const porId = new Map(saida.map((t) => [t.chunkId, t.origemRecuperacao]));
    expect(porId.get("v")).toBe("vetorial");
    expect(porId.get("l")).toBe("termos");
    expect(porId.get("ambos")).toBe("ambos");
  });

  it("guarda a maior similaridade quando o trecho vem pelos dois braços", () => {
    const saida = fundir({
      vetoriais: [trecho("x", 0.81)],
      lexicos: [{ ...trecho("x"), similaridade: 0 }],
    });
    expect(saida[0]!.similaridade).toBe(0.81);
  });

  it("respeita o teto de trechos", () => {
    const muitos = ["a", "b", "c", "d", "e"].map((id) => trecho(id));
    expect(fundir({ vetoriais: muitos, lexicos: [], maximo: 3 })).toHaveLength(3);
  });

  it("nunca devolve lista vazia por causa de um teto zerado", () => {
    expect(fundir({ vetoriais: [trecho("a")], lexicos: [], maximo: 0 })).toHaveLength(1);
  });

  it("é determinística: a mesma entrada devolve a mesma ordem", () => {
    const entrada = { vetoriais: [trecho("a"), trecho("b")], lexicos: [trecho("b"), trecho("a")] };
    expect(fundir(entrada).map((t) => t.chunkId)).toEqual(fundir(entrada).map((t) => t.chunkId));
  });

  it("o amortecimento impede que o primeiro colocado decida sozinho", () => {
    // Com o amortecimento em 60, estar em primeiro numa lista vale pouco mais
    // que estar em segundo, que é o que permite a concordância entre as duas
    // buscas superar a preferência de uma delas.
    const primeiroSozinho = 1 / (AMORTECIMENTO + 1);
    const segundoNasDuas = 1 / (AMORTECIMENTO + 2) + 1 / (AMORTECIMENTO + 2);
    expect(segundoNasDuas).toBeGreaterThan(primeiroSozinho);
  });
});
