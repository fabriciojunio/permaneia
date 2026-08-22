import { describe, expect, it } from "vitest";
import {
  acertosConfiaveis,
  buscarPorTermos,
  COBERTURA_MINIMA,
  termosDaPergunta,
  type DocumentoLexico,
} from "@/lib/rag/lexico";

const CRONOGRAMA: DocumentoLexico[] = [
  { chunkId: "p1", texto: "24 de setembro de 2026, quinta-feira. Avaliação. Prova P1." },
  { chunkId: "p2", texto: "26 de novembro de 2026, quinta-feira. Avaliação. Avaliação P2." },
  { chunkId: "fuzzy", texto: "29 de outubro de 2026, quinta-feira. Aula normal. Lógica Fuzzy." },
  { chunkId: "faltas", texto: "O total de faltas não deve extrapolar os 25% da carga horária." },
  { chunkId: "quiz", texto: "O Quiz será realizado no horário da aula e compõe 20% da nota." },
];

describe("termos da pergunta", () => {
  it("descarta palavra vazia e interrogativo", () => {
    expect(termosDaPergunta("Quando é a prova?")).toEqual(["prova"]);
  });

  it("normaliza acento, para que o aluno possa digitar sem ele", () => {
    expect(termosDaPergunta("avaliacao")).toEqual(termosDaPergunta("avaliação"));
  });

  it("reduz plural ao mesmo termo do singular", () => {
    expect(termosDaPergunta("avaliações")).toEqual(termosDaPergunta("avaliação"));
  });

  it("não repete o mesmo termo", () => {
    expect(termosDaPergunta("prova prova prova")).toEqual(["prova"]);
  });

  it("devolve lista vazia para pergunta só de palavras vazias", () => {
    expect(termosDaPergunta("o que é isso")).toEqual([]);
  });
});

describe("busca por termos", () => {
  it("acha o trecho que contém a palavra decisiva da pergunta", () => {
    const acertos = buscarPorTermos("quando vai ser a prova", CRONOGRAMA);
    expect(acertos.map((a) => a.chunkId)).toContain("p1");
  });

  it("ignora trecho sem nenhum termo em comum", () => {
    const acertos = buscarPorTermos("lógica fuzzy", CRONOGRAMA);
    expect(acertos.map((a) => a.chunkId)).not.toContain("faltas");
  });

  it("devolve vazio quando o material não fala do assunto", () => {
    expect(buscarPorTermos("mensalidade do curso", CRONOGRAMA)).toEqual([]);
  });

  it("devolve vazio para pergunta sem termo de conteúdo", () => {
    expect(buscarPorTermos("como é que é", CRONOGRAMA)).toEqual([]);
  });

  it("devolve vazio quando não há documento algum", () => {
    expect(buscarPorTermos("prova", [])).toEqual([]);
  });

  it("põe na frente o trecho com mais termos da pergunta", () => {
    const acertos = buscarPorTermos("lógica fuzzy", CRONOGRAMA);
    expect(acertos[0]!.chunkId).toBe("fuzzy");
  });

  it("mede a cobertura como fração dos termos da pergunta", () => {
    const acertos = buscarPorTermos("prova de lógica fuzzy", CRONOGRAMA);
    const fuzzy = acertos.find((a) => a.chunkId === "fuzzy")!;
    // "logica" e "fuzzy" casam, "prova" não: dois de três.
    expect(fuzzy.cobertura).toBeCloseTo(2 / 3, 2);
  });

  it("premia o termo raro sobre o termo que está em todo trecho", () => {
    const acertos = buscarPorTermos("aula fuzzy", CRONOGRAMA);
    expect(acertos[0]!.chunkId).toBe("fuzzy");
  });

  it("é determinística: a mesma pergunta devolve a mesma ordem", () => {
    const a = buscarPorTermos("prova avaliação", CRONOGRAMA).map((x) => x.chunkId);
    const b = buscarPorTermos("prova avaliação", CRONOGRAMA).map((x) => x.chunkId);
    expect(a).toEqual(b);
  });
});

describe("acertos confiáveis", () => {
  it("corta o acerto que casou só um termo de vários", () => {
    // "curso" não aparece; "valor" e "mensalidade" também não. Nada passa.
    expect(acertosConfiaveis(buscarPorTermos("valor da mensalidade do curso", CRONOGRAMA))).toEqual([]);
  });

  it("mantém o acerto que cobre a pergunta inteira", () => {
    const confiaveis = acertosConfiaveis(buscarPorTermos("lógica fuzzy", CRONOGRAMA));
    expect(confiaveis.map((a) => a.chunkId)).toEqual(["fuzzy"]);
  });

  it("respeita o piso de cobertura informado", () => {
    const todos = buscarPorTermos("prova de lógica fuzzy", CRONOGRAMA);
    expect(acertosConfiaveis(todos, 1).length).toBeLessThan(acertosConfiaveis(todos, 0.1).length);
  });

  it("o piso padrão exige metade dos termos", () => {
    expect(COBERTURA_MINIMA).toBe(0.5);
  });
});
