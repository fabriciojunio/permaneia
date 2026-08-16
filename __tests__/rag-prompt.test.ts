import { describe, expect, it } from "vitest";
import {
  INSTRUCAO_SISTEMA,
  RESPOSTA_SEM_CONTEXTO,
  admitiuNaoSaber,
  citaAlgumaFonte,
  formatarTrecho,
  montarPrompt,
} from "@/lib/rag/prompt";
import { responderExtrativo } from "@/lib/ia/local";
import type { TrechoRecuperado } from "@/lib/rag/similaridade";

function trecho(parcial: Partial<TrechoRecuperado> = {}): TrechoRecuperado {
  return {
    chunkId: "c1",
    documentoId: "d1",
    titulo: "Cronograma de aulas",
    referencia: "2026-2",
    indice: 0,
    texto: "24 de setembro de 2026, quinta-feira. Avaliação. Prova P1.",
    similaridade: 0.4,
    ...parcial,
  };
}

describe("INSTRUCAO_SISTEMA", () => {
  it.each([
    ["apenas o contexto", /APENAS com informação presente no contexto/i],
    ["admitir que não sabe", /não encontrou/i],
    ["citar a fonte", /cite/i],
    ["transcrever números críticos", /transcreva exatamente/i],
    ["responder em português", /português do Brasil/i],
  ])("exige %s", (_nome, padrao) => {
    expect(INSTRUCAO_SISTEMA).toMatch(padrao);
  });

  it("proíbe usar conhecimento próprio sobre a disciplina", () => {
    expect(INSTRUCAO_SISTEMA).toMatch(/não tem permissão para usar conhecimento próprio/i);
  });

  it("diz explicitamente para nunca inventar data de prova", () => {
    // É a garantia mais importante do sistema: um aluno que perde a avaliação
    // por causa de uma data errada é o pior resultado possível.
    expect(INSTRUCAO_SISTEMA).toMatch(/nunca invente uma data de prova/i);
  });

  it("é longa o bastante para carregar as regras, sem ser um romance", () => {
    expect(INSTRUCAO_SISTEMA.length).toBeGreaterThan(800);
    expect(INSTRUCAO_SISTEMA.length).toBeLessThan(4000);
  });
});

describe("formatarTrecho", () => {
  it("cola o título ao conteúdo, para o modelo saber de onde veio", () => {
    const f = formatarTrecho(trecho());
    expect(f).toContain("[Cronograma de aulas");
    expect(f).toContain("Prova P1");
  });

  it("inclui a referência quando existe", () => {
    expect(formatarTrecho(trecho({ referencia: "versão de agosto" }))).toContain("(versão de agosto)");
  });

  it("omite os parênteses quando não há referência", () => {
    expect(formatarTrecho(trecho({ referencia: null }))).not.toContain("()");
  });

  it("a referência é o campo que permite perceber ementa desatualizada", () => {
    // O maior risco do RAG neste domínio não é inventar uma data, é repetir com
    // confiança a data certa do semestre passado.
    const f = formatarTrecho(trecho({ referencia: "2025-1" }));
    expect(f).toContain("2025-1");
  });
});

describe("montarPrompt", () => {
  const trechos = [trecho(), trecho({ chunkId: "c2", titulo: "Contrato didático", texto: "Limite de 25% de faltas." })];

  it("inclui os marcadores de contexto e pergunta", () => {
    const p = montarPrompt("Quando é a P1?", trechos);
    expect(p).toContain("<contexto>");
    expect(p).toContain("</contexto>");
    expect(p).toContain("<pergunta>");
    expect(p).toContain("</pergunta>");
  });

  it("os marcadores são o contrato entre a camada de RAG e o provedor local", () => {
    // Trocar essas etiquetas quebra o modo de degradação em silêncio: o
    // provedor local deixa de encontrar o contexto e passa a responder que não
    // sabe para tudo.
    const p = montarPrompt("Quando é a P1?", trechos);
    const extraido = responderExtrativo(p);
    expect(extraido).toContain("24 de setembro");
  });

  it("inclui o texto de todos os trechos", () => {
    const p = montarPrompt("qualquer", trechos);
    expect(p).toContain("Prova P1");
    expect(p).toContain("25% de faltas");
  });

  it("separa os trechos por uma linha de três hifens", () => {
    expect(montarPrompt("q", trechos)).toContain("\n---\n");
  });

  it("inclui a pergunta com espaços das bordas removidos", () => {
    expect(montarPrompt("   Quando é a P1?   ", trechos)).toContain("<pergunta>\nQuando é a P1?\n</pergunta>");
  });

  it("com lista vazia continua produzindo prompt bem formado", () => {
    const p = montarPrompt("qualquer", []);
    expect(p).toContain("<contexto>");
    expect(p).toContain("<pergunta>");
  });

  it("repete ao final a instrução de citar a fonte", () => {
    expect(montarPrompt("q", trechos)).toMatch(/citando o documento de origem/i);
  });
});

describe("citaAlgumaFonte", () => {
  const trechos = [trecho({ titulo: "Cronograma de aulas" })];

  it("reconhece a citação pelo título do documento", () => {
    expect(citaAlgumaFonte("A prova é em 24 de setembro [Cronograma de aulas].", trechos)).toBe(true);
  });

  it("ignora diferença de caixa", () => {
    expect(citaAlgumaFonte("conforme o cronograma de aulas", trechos)).toBe(true);
  });

  it("é falso quando a resposta não aponta documento algum", () => {
    // Terceira barreira contra alucinação: uma resposta que afirma sem apontar
    // de onde tirou não deve ser apresentada como fundamentada.
    expect(citaAlgumaFonte("A prova é em 24 de setembro.", trechos)).toBe(false);
  });

  it("é falso quando não há trecho nenhum", () => {
    expect(citaAlgumaFonte("qualquer coisa [Cronograma de aulas]", [])).toBe(false);
  });

  it("basta citar um dos documentos fornecidos", () => {
    const dois = [trecho({ titulo: "Cronograma" }), trecho({ chunkId: "c2", titulo: "Contrato didático" })];
    expect(citaAlgumaFonte("segundo o Contrato didático, o limite é 25%", dois)).toBe(true);
  });
});

describe("admitiuNaoSaber", () => {
  it.each([
    "Não encontrei essa informação no material.",
    "nao encontrei nada sobre isso",
    "Isso não consta no cronograma.",
    "A informação não está no material da disciplina.",
    "Não localizei essa data.",
  ])("reconhece a recusa em %s", (texto) => {
    expect(admitiuNaoSaber(texto)).toBe(true);
  });

  it.each([
    "A Prova P1 é em 24 de setembro de 2026.",
    "O limite de faltas é de 25%.",
    "O quiz vale 20% da nota.",
  ])("não confunde resposta afirmativa com recusa: %s", (texto) => {
    expect(admitiuNaoSaber(texto)).toBe(false);
  });

  it("reconhece a recusa padrão do sistema", () => {
    expect(admitiuNaoSaber(RESPOSTA_SEM_CONTEXTO)).toBe(true);
  });

  it("tolera texto sem acento, que é como o aluno costuma digitar", () => {
    expect(admitiuNaoSaber("nao esta no material")).toBe(true);
  });
});

describe("RESPOSTA_SEM_CONTEXTO", () => {
  it("orienta a confirmar com o professor ou a coordenação", () => {
    expect(RESPOSTA_SEM_CONTEXTO).toMatch(/professor|coordenação/i);
  });

  it("sugere que o documento pode não ter sido enviado ainda", () => {
    // Sem isso o aluno atribui a falha ao assistente, e não à ausência do
    // material, e para de usar.
    expect(RESPOSTA_SEM_CONTEXTO).toMatch(/documento/i);
  });

  it("não promete nem sugere uma resposta provável", () => {
    expect(RESPOSTA_SEM_CONTEXTO).not.toMatch(/provavelmente|talvez|acredito/i);
  });
});
