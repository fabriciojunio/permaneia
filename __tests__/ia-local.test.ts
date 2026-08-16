import { describe, expect, it } from "vitest";
import {
  ProvedorLocal,
  SEM_RESPOSTA_LOCAL,
  embeddingLocal,
  frases,
  hash32,
  normalizarTexto,
  radical,
  responderExtrativo,
  tokenizar,
  unidades,
} from "@/lib/ia/local";
import { DIMENSAO_EMBEDDING, normalizarVetor, validarEmbedding } from "@/lib/ia/provedor";
import { cosseno } from "@/lib/rag/similaridade";

describe("hash32", () => {
  it("é determinístico", () => {
    for (const t of ["prova", "cronograma", "", "ação", "P1"]) {
      expect(hash32(t)).toBe(hash32(t));
    }
  });

  it("devolve inteiro sem sinal de 32 bits", () => {
    for (const t of ["a", "abc", "texto mais longo para testar", "ç"]) {
      const h = hash32(t);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });

  it("textos diferentes tendem a hashes diferentes", () => {
    const hashes = new Set(
      ["prova", "provas", "p1", "p2", "cronograma", "ementa", "aula", "fuzzy"].map(hash32)
    );
    expect(hashes.size).toBe(8);
  });
});

describe("normalizarTexto", () => {
  it.each([
    ["Prova P1", "prova p1"],
    ["AVALIAÇÃO", "avaliacao"],
    ["amanhã", "amanha"],
    ["Inteligência Artificial", "inteligencia artificial"],
    ["  espaços   demais  ", "espacos demais"],
    ["pontuação, vírgula; ponto.", "pontuacao virgula ponto"],
    ["", ""],
    ["óôõáàâãéêíóúüç", "ooo aaaa ee i o u u c".replace(/ /g, "")],
  ])("normaliza %s", (entrada, esperado) => {
    expect(normalizarTexto(entrada)).toBe(esperado);
  });

  it("remove acento para que a forma digitada e a do documento colidam", () => {
    expect(normalizarTexto("Avaliação")).toBe(normalizarTexto("avaliacao"));
    expect(normalizarTexto("amanhã")).toBe(normalizarTexto("amanha"));
  });

  it("preserva números", () => {
    expect(normalizarTexto("P1 em 24/09/2026")).toBe("p1 em 24 09 2026");
  });
});

describe("tokenizar", () => {
  it("descarta palavras vazias", () => {
    expect(tokenizar("a prova de o aluno")).toEqual(["prova", "aluno"]);
  });

  it.each(["quando", "qual", "quanto", "como", "onde", "quem", "quais", "quantas"])(
    "descarta o interrogativo %s",
    (palavra) => {
      expect(tokenizar(palavra)).toEqual([]);
    }
  );

  it("os interrogativos não sobrevivem em uma pergunta completa", () => {
    // Sem isso, "como faço para trancar a matrícula" casava com qualquer trecho
    // que contivesse "como", ficando acima de perguntas realmente respondíveis.
    expect(tokenizar("Quando é a Prova P1?")).toEqual(["prova", "p1"]);
    expect(tokenizar("Como faço para trancar a matrícula?")).toEqual(["trancar", "matricula"]);
  });

  it("devolve lista vazia para texto vazio ou só de palavras vazias", () => {
    expect(tokenizar("")).toEqual([]);
    expect(tokenizar("   ")).toEqual([]);
    expect(tokenizar("de a o em")).toEqual([]);
  });

  it("preserva termos discriminantes", () => {
    expect(tokenizar("cronograma da disciplina de lógica fuzzy")).toContain("fuzzy");
    expect(tokenizar("cronograma da disciplina de lógica fuzzy")).toContain("cronograma");
  });
});

describe("radical", () => {
  it.each([
    ["avaliacoes", "avaliacao"],
    ["avaliacao", "avaliacao"],
    ["oralmente", "oral"],
    ["provas", "prova"],
    ["aulas", "aula"],
    ["materiais", "material"],
    ["papeis", "papel"],
    ["homens", "homem"],
  ])("reduz %s a %s", (palavra, esperado) => {
    expect(radical(palavra)).toBe(esperado);
  });

  it("não mexe em palavras curtas, onde o corte destruiria o sentido", () => {
    for (const p of ["p1", "ia", "sim", "psr"]) {
      expect(radical(p)).toBe(p);
    }
  });

  it.each([
    ["prova", "provas"],
    ["aula", "aulas"],
    ["avaliacao", "avaliacoes"],
    ["material", "materiais"],
    ["nota", "notas"],
    ["documento", "documentos"],
  ])("singular %s e plural %s convergem para o mesmo radical", (singular, plural) => {
    expect(radical(singular)).toBe(radical(plural));
  });

  it("é idempotente: aplicar duas vezes não muda mais nada", () => {
    for (const p of ["provas", "avaliacoes", "materiais", "oralmente", "aula"]) {
      expect(radical(radical(p))).toBe(radical(p));
    }
  });
});

describe("unidades", () => {
  it("gera a palavra, o radical e o bigrama", () => {
    const u = unidades("prova final");
    expect(u).toContain("p:prova");
    expect(u).toContain("p:final");
    expect(u).toContain("r:prova");
    expect(u.some((x) => x.startsWith("b:"))).toBe(true);
  });

  it("emite o radical mesmo quando ele é igual à palavra", () => {
    // Sem isso, singular e plural não teriam nenhuma unidade em comum: um
    // produziria só `p:prova` e o outro `p:provas` mais `r:prova`.
    expect(unidades("prova")).toContain("r:prova");
    expect(unidades("provas")).toContain("r:prova");
  });

  it("não gera bigrama para token único", () => {
    expect(unidades("fuzzy").filter((u) => u.startsWith("b:"))).toHaveLength(0);
  });

  it("não gera unidades para texto sem token discriminante", () => {
    expect(unidades("de a o")).toEqual([]);
  });

  it("não gera trigramas de caracteres", () => {
    // Foram removidos: multiplicavam por cinco as unidades e a colisão
    // resultante em 768 dimensões afogava o sinal da busca.
    expect(unidades("cronograma da disciplina").some((u) => u.startsWith("t:"))).toBe(false);
  });

  it("o bigrama distingue 'prova p1' de uma menção solta a prova", () => {
    const comP1 = unidades("prova p1");
    const soProva = unidades("prova substitutiva");
    const bigramaP1 = comP1.find((u) => u.startsWith("b:"));
    expect(soProva).not.toContain(bigramaP1);
  });
});

describe("embeddingLocal", () => {
  it("sempre devolve a dimensão do contrato", () => {
    for (const t of ["", "prova", "um texto bem mais longo com várias palavras diferentes"]) {
      expect(embeddingLocal(t)).toHaveLength(DIMENSAO_EMBEDDING);
    }
  });

  it("é determinístico entre execuções", () => {
    const a = embeddingLocal("quando é a prova p1");
    const b = embeddingLocal("quando é a prova p1");
    expect(a).toEqual(b);
  });

  it("é normalizado, o que faz o produto escalar valer o cosseno", () => {
    const v = embeddingLocal("cronograma de aulas da disciplina");
    const norma = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norma).toBeCloseTo(1, 6);
  });

  it("texto vazio devolve vetor nulo, sem quebrar", () => {
    const v = embeddingLocal("");
    expect(v).toHaveLength(DIMENSAO_EMBEDDING);
    expect(v.every((x) => x === 0)).toBe(true);
  });

  it("todos os componentes são números finitos", () => {
    for (const x of embeddingLocal("teste de finitude do vetor")) {
      expect(Number.isFinite(x)).toBe(true);
    }
  });

  it("textos iguais têm similaridade 1", () => {
    const t = "o total de faltas não deve extrapolar os 25%";
    expect(cosseno(embeddingLocal(t), embeddingLocal(t))).toBeCloseTo(1, 6);
  });

  it("texto relacionado pontua mais que texto sem relação", () => {
    const pergunta = embeddingLocal("qual o limite de faltas");
    const relevante = embeddingLocal("O total de faltas não deve extrapolar os 25% da carga horária.");
    const irrelevante = embeddingLocal("Geração de imagem, código, áudio ou vídeo com modelos generativos.");
    expect(cosseno(pergunta, relevante)).toBeGreaterThan(cosseno(pergunta, irrelevante));
  });

  it.each([
    ["quando é a prova p1", "24 de setembro de 2026, quinta-feira. Avaliação. Prova P1.", "Materiais: Pathfinding Visualizer e simulador do aspirador."],
    ["quanto vale o quiz", "O Quiz será realizado no horário da aula e compõe 20% da nota.", "Divisão de grupos para o trabalho de conclusão."],
    ["lógica fuzzy", "29 de outubro de 2026, quinta-feira. Aula normal. Lógica Fuzzy.", "06 de agosto de 2026. Apresentação da disciplina."],
  ])("a pergunta %s aproxima o trecho certo", (pergunta, relevante, irrelevante) => {
    const p = embeddingLocal(pergunta);
    expect(cosseno(p, embeddingLocal(relevante))).toBeGreaterThan(cosseno(p, embeddingLocal(irrelevante)));
  });

  it("tolera flexão pelo radical", () => {
    const singular = embeddingLocal("prova de avaliação");
    const plural = embeddingLocal("provas de avaliações");
    expect(cosseno(singular, plural)).toBeGreaterThan(0.3);
  });

  it("acento não muda o vetor", () => {
    expect(embeddingLocal("avaliação")).toEqual(embeddingLocal("avaliacao"));
  });
});

describe("frases", () => {
  it("separa por pontuação de fim de frase", () => {
    expect(frases("Primeira. Segunda! Terceira?")).toEqual(["Primeira.", "Segunda!", "Terceira?"]);
  });

  it("separa por quebra de linha", () => {
    expect(frases("linha um\nlinha dois")).toEqual(["linha um", "linha dois"]);
  });

  it("descarta segmentos vazios", () => {
    expect(frases("   ")).toEqual([]);
    expect(frases("")).toEqual([]);
  });
});

describe("responderExtrativo", () => {
  const prompt = (contexto: string, pergunta: string) =>
    `<contexto>\n${contexto}\n</contexto>\n\n<pergunta>\n${pergunta}\n</pergunta>`;

  it("devolve o trecho inteiro, e não frases soltas", () => {
    // Uma versão anterior selecionava frase a frase e, para "quando é a Prova
    // P1", devolvia "Avaliação. Prova P1" sem a data que estava na frase
    // anterior. Recortar abaixo da unidade de informação quebra a informação.
    const contexto = "[Cronograma]\n24 de setembro de 2026, quinta-feira. Avaliação. Prova P1.";
    const r = responderExtrativo(prompt(contexto, "Quando é a Prova P1?"));
    expect(r).toContain("24 de setembro");
    expect(r).toContain("Prova P1");
  });

  it("declara que é leitura direta, sem geração de texto", () => {
    const r = responderExtrativo(prompt("[Doc]\nQualquer conteúdo sobre prova.", "prova"));
    expect(r).toMatch(/leitura direta/i);
  });

  it("sem contexto, admite que não encontrou", () => {
    expect(responderExtrativo(prompt("", "qualquer coisa"))).toBe(SEM_RESPOSTA_LOCAL);
  });

  it("com prompt sem os marcadores, admite que não encontrou", () => {
    expect(responderExtrativo("texto solto sem marcador")).toBe(SEM_RESPOSTA_LOCAL);
  });

  it("prefere os blocos com termos em comum com a pergunta", () => {
    const contexto = [
      "[A]\nMateriais de apoio e vídeos sobre agentes inteligentes.",
      "[B]\nO total de faltas não deve extrapolar os 25% da carga horária.",
    ].join("\n\n---\n\n");
    const r = responderExtrativo(prompt(contexto, "Qual o limite de faltas?"));
    expect(r).toContain("25%");
  });

  it("devolve no máximo dois blocos, para não despejar o documento inteiro", () => {
    const contexto = Array.from({ length: 6 }, (_, i) => `[Doc ${i}]\nprova prova prova ${i}`).join("\n\n---\n\n");
    const r = responderExtrativo(prompt(contexto, "prova"));
    const blocos = r.split("\n\n").filter((b) => b.startsWith("[Doc"));
    expect(blocos.length).toBeLessThanOrEqual(2);
  });

  it("sem nenhum termo em comum, ainda devolve o trecho mais similar recuperado", () => {
    // A busca vetorial já filtrou por relevância; devolver nada aqui
    // descartaria um resultado que passou pelo limiar.
    const contexto = "[Doc]\nConteúdo institucional qualquer.";
    const r = responderExtrativo(prompt(contexto, "xyzabc"));
    expect(r).toContain("Conteúdo institucional");
  });

  it("a resposta nunca inventa conteúdo fora do contexto", () => {
    const contexto = "[Cronograma]\n29 de outubro de 2026. Lógica Fuzzy.";
    const r = responderExtrativo(prompt(contexto, "Quando é lógica fuzzy?"));
    const semCabecalho = r.split("\n").slice(2).join("\n");
    expect(contexto).toContain(semCabecalho.trim());
  });
});

describe("ProvedorLocal", () => {
  const provedor = new ProvedorLocal();

  it("se identifica como local", () => {
    expect(provedor.nome).toBe("local");
  });

  it("está sempre disponível, porque é o piso do sistema", () => {
    expect(provedor.disponivel()).toBe(true);
  });

  it("gera texto marcando a origem local", async () => {
    const r = await provedor.gerarTexto("<contexto>\n[A]\nprova\n</contexto>\n<pergunta>\nprova\n</pergunta>");
    expect(r.origem).toBe("local");
    expect(r.texto.length).toBeGreaterThan(0);
  });

  it("gera embedding com a dimensão do contrato", async () => {
    expect(await provedor.gerarEmbedding("teste")).toHaveLength(DIMENSAO_EMBEDDING);
  });

  it("gera lote de embeddings preservando a ordem", async () => {
    const textos = ["primeiro", "segundo", "terceiro"];
    const vetores = await provedor.gerarEmbeddings(textos);
    expect(vetores).toHaveLength(3);
    for (let i = 0; i < textos.length; i += 1) {
      expect(vetores[i]).toEqual(await provedor.gerarEmbedding(textos[i]!));
    }
  });

  it("lote vazio devolve lista vazia", async () => {
    expect(await provedor.gerarEmbeddings([])).toEqual([]);
  });
});

describe("normalizarVetor e validarEmbedding", () => {
  it("normaliza para norma 1", () => {
    const v = normalizarVetor([3, 4]);
    expect(Math.sqrt(v[0]! ** 2 + v[1]! ** 2)).toBeCloseTo(1, 10);
  });

  it("vetor nulo permanece nulo, sem divisão por zero", () => {
    expect(normalizarVetor([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("aceita embedding com a dimensão correta", () => {
    const v = new Array(DIMENSAO_EMBEDDING).fill(0.1);
    expect(() => validarEmbedding(v, "local")).not.toThrow();
  });

  it("rejeita embedding com dimensão errada, que corromperia a busca em silêncio", () => {
    expect(() => validarEmbedding([1, 2, 3], "gemini")).toThrow(/dimensões/);
  });

  it("rejeita embedding com valor não numérico", () => {
    const v = new Array(DIMENSAO_EMBEDDING).fill(0.1);
    v[10] = Number.NaN;
    expect(() => validarEmbedding(v, "gemini")).toThrow(/não numérico/);
  });
});
