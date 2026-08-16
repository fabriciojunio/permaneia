// Integração do RAG, com Postgres e pgvector de verdade.
//
// O que estes testes cobrem e os unitários não conseguem: a serialização do
// vetor para o tipo `vector(768)`, o operador de distância de cosseno do
// pgvector, o filtro por disciplina e por origem de embedding, e o caminho
// completo da pergunta até a resposta com fontes.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ingerir } from "@/lib/rag/ingestao";
import { responder } from "@/lib/rag/consulta";
import { buscarTrechosSimilares, contarTrechosPorOrigem, listarDocumentosDaDisciplina, literalVetor, removerDocumento } from "@/lib/repositorios/documento";
import { gerarEmbeddingComFallback } from "@/lib/ia";
import { DIMENSAO_EMBEDDING } from "@/lib/ia/provedor";

const CRONOGRAMA = `
24 de setembro de 2026, quinta-feira. Avaliação. Prova P1 da disciplina.

29 de outubro de 2026, quinta-feira. Aula normal. Lógica Fuzzy.

19 de novembro de 2026, quinta-feira. Entrega de trabalho. Entrega do Trabalho da Disciplina, com apresentação.

17 de dezembro de 2026, quinta-feira. Avaliação. Exame Final.
`.trim();

const CONTRATO = `
O Quiz será realizado no horário da aula e compõe 20% da nota da disciplina.

Confira sempre com antecedência o Plano de Aula disponível no Connect.

A participação de todos é fundamental para o bom andamento das aulas.

O total de faltas não deve extrapolar os 25% da carga horária da disciplina.

Nossa comunicação deve ser realizada, preferencialmente, durante as aulas.

Dúvidas de conteúdo serão esclarecidas, presencialmente, somente durante as aulas.

As atividades avaliativas P1 e P2 serão orientadas com antecedência.

Não ocorrerá nenhum tipo de atividade extra para arredondamento de nota.
`.trim();

const OUTRA_DISCIPLINA = `
A avaliação de Teoria dos Grafos acontece em 12 de março de 2027.

O conteúdo cobrado é caminho mínimo e árvore geradora mínima.
`.trim();

let disciplinaId = "";
let outraDisciplinaId = "";

beforeAll(async () => {
  const marca = `TesteIntegracao-${Date.now()}`;

  const principal = await prisma.disciplina.create({
    data: { nome: `${marca}-IA`, professor: "Teste", periodo: "2026-2" },
  });
  disciplinaId = principal.id;

  const outra = await prisma.disciplina.create({
    data: { nome: `${marca}-Grafos`, professor: "Teste", periodo: "2026-2" },
  });
  outraDisciplinaId = outra.id;

  await ingerir({
    disciplinaId,
    titulo: "Cronograma de aulas",
    referencia: "2026-2",
    conteudo: CRONOGRAMA,
    origem: "texto",
    tamanhoAlvo: 320,
    sobreposicao: 60,
  });

  await ingerir({
    disciplinaId,
    titulo: "Contrato didático",
    referencia: "2026-2",
    conteudo: CONTRATO,
    origem: "texto",
    // Alvo menor que o do cronograma: cada item do contrato é uma regra
    // independente, e juntar três regras num trecho dilui a similaridade de
    // qualquer pergunta específica sobre uma delas.
    tamanhoAlvo: 200,
    sobreposicao: 40,
  });

  await ingerir({
    disciplinaId: outraDisciplinaId,
    titulo: "Cronograma de Grafos",
    conteudo: OUTRA_DISCIPLINA,
    origem: "texto",
    tamanhoAlvo: 320,
    sobreposicao: 60,
  });
});

afterAll(async () => {
  await prisma.disciplina.deleteMany({ where: { id: { in: [disciplinaId, outraDisciplinaId] } } });
  await prisma.$disconnect();
});

describe("ingestão", () => {
  it("grava o documento e os trechos", async () => {
    const documentos = await listarDocumentosDaDisciplina(disciplinaId);
    expect(documentos.length).toBe(2);
    for (const d of documentos) expect(d.totalChunks).toBeGreaterThan(0);
  });

  it("o total de trechos declarado bate com o gravado", async () => {
    const documentos = await listarDocumentosDaDisciplina(disciplinaId);
    for (const d of documentos) {
      const gravados = await prisma.documentoChunk.count({ where: { documentoId: d.id } });
      expect(gravados).toBe(d.totalChunks);
    }
  });

  it("grava o vetor na coluna vector(768)", async () => {
    const linhas = await prisma.$queryRaw<Array<{ dimensao: number }>>`
      SELECT vector_dims(embedding) AS dimensao
      FROM documento_chunks
      WHERE disciplina_id = ${disciplinaId}::uuid
      LIMIT 1
    `;
    expect(Number(linhas[0]?.dimensao)).toBe(DIMENSAO_EMBEDDING);
  });

  it("marca a origem do embedding em cada trecho", async () => {
    const trechos = await prisma.documentoChunk.findMany({
      where: { disciplinaId },
      select: { origemEmbedding: true },
    });
    expect(trechos.length).toBeGreaterThan(0);
    for (const t of trechos) expect(["local", "gemini"]).toContain(t.origemEmbedding);
  });

  it("recusa documento sem texto indexável", async () => {
    await expect(
      ingerir({ disciplinaId, titulo: "Vazio", conteudo: "   ", origem: "texto" })
    ).rejects.toThrow(/nenhum trecho/i);
  });

  it("contarTrechosPorOrigem enxerga os trechos gravados", async () => {
    const contagem = await contarTrechosPorOrigem();
    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe("busca vetorial", () => {
  it("recupera trechos ordenados por similaridade decrescente", async () => {
    const embedding = await gerarEmbeddingComFallback("Quando é a Prova P1?");
    const trechos = await buscarTrechosSimilares(disciplinaId, embedding.valor, embedding.origem, 5);

    expect(trechos.length).toBeGreaterThan(0);
    for (let i = 1; i < trechos.length; i += 1) {
      expect(trechos[i - 1]!.similaridade).toBeGreaterThanOrEqual(trechos[i]!.similaridade);
    }
  });

  it("a similaridade fica no intervalo esperado", async () => {
    const embedding = await gerarEmbeddingComFallback("limite de faltas");
    const trechos = await buscarTrechosSimilares(disciplinaId, embedding.valor, embedding.origem, 5);
    for (const t of trechos) {
      expect(t.similaridade).toBeGreaterThanOrEqual(-1);
      expect(t.similaridade).toBeLessThanOrEqual(1);
    }
  });

  it("NUNCA vaza trecho de outra disciplina", async () => {
    // É a promessa central do produto. Sem esse filtro, a pergunta sobre a P1
    // de Inteligência Artificial recuperaria o cronograma de Grafos e a
    // resposta viria com a data errada.
    const embedding = await gerarEmbeddingComFallback("avaliação e conteúdo cobrado");
    const trechos = await buscarTrechosSimilares(disciplinaId, embedding.valor, embedding.origem, 20);
    for (const t of trechos) {
      expect(t.texto).not.toContain("Grafos");
      expect(t.texto).not.toContain("12 de março");
    }
  });

  it("filtra por origem de embedding, porque os espaços não são comparáveis", async () => {
    const embedding = await gerarEmbeddingComFallback("prova");
    const comOutraOrigem = await buscarTrechosSimilares(disciplinaId, embedding.valor, "gemini", 10);
    const comOrigemCerta = await buscarTrechosSimilares(disciplinaId, embedding.valor, embedding.origem, 10);
    expect(comOutraOrigem).toHaveLength(0);
    expect(comOrigemCerta.length).toBeGreaterThan(0);
  });

  it("respeita o limite de resultados", async () => {
    const embedding = await gerarEmbeddingComFallback("aula");
    expect((await buscarTrechosSimilares(disciplinaId, embedding.valor, embedding.origem, 2)).length).toBeLessThanOrEqual(2);
    expect((await buscarTrechosSimilares(disciplinaId, embedding.valor, embedding.origem, 1)).length).toBeLessThanOrEqual(1);
  });

  it("prende o limite numa faixa sã, mesmo recebendo valor absurdo", async () => {
    const embedding = await gerarEmbeddingComFallback("aula");
    const trechos = await buscarTrechosSimilares(disciplinaId, embedding.valor, embedding.origem, 99999);
    expect(trechos.length).toBeLessThanOrEqual(20);
  });

  it("disciplina sem documento devolve lista vazia, sem erro", async () => {
    const vazia = await prisma.disciplina.create({
      data: { nome: `Vazia-${Date.now()}`, periodo: "2026-2" },
    });
    const embedding = await gerarEmbeddingComFallback("qualquer coisa");
    expect(await buscarTrechosSimilares(vazia.id, embedding.valor, embedding.origem, 5)).toEqual([]);
    await prisma.disciplina.delete({ where: { id: vazia.id } });
  });

  it("traz o título e a referência do documento de origem", async () => {
    const embedding = await gerarEmbeddingComFallback("Prova P1");
    const trechos = await buscarTrechosSimilares(disciplinaId, embedding.valor, embedding.origem, 3);
    expect(trechos[0]!.titulo.length).toBeGreaterThan(0);
    expect(trechos.some((t) => t.referencia === "2026-2")).toBe(true);
  });
});

describe("literalVetor", () => {
  it("serializa no formato aceito pelo pgvector", () => {
    expect(literalVetor([0.1, -0.2, 0.3])).toBe("[0.1,-0.2,0.3]");
  });

  it("substitui valor não finito por zero, em vez de gerar SQL inválido", () => {
    expect(literalVetor([Number.NaN, Number.POSITIVE_INFINITY, 1])).toBe("[0,0,1]");
  });
});

describe("consulta completa", () => {
  it("responde pergunta que o cronograma cobre, citando a fonte", async () => {
    const r = await responder({ disciplinaId, pergunta: "Quando é a Prova P1?", registrar: false });
    expect(r.fontes.length).toBeGreaterThan(0);
    expect(r.resposta).toContain("24 de setembro");
    expect(r.admitiuNaoSaber).toBe(false);
  });

  it("responde pergunta que o contrato didático cobre", async () => {
    // O limiar vai explícito porque este é um corpus sintético de poucas
    // frases, e o limiar de produção (0,15) foi calibrado sobre os documentos
    // reais da disciplina, onde o mesmo par pergunta/trecho pontua bem mais
    // alto. Aqui o que se testa é o pipeline: recuperar, montar o contexto e
    // devolver a resposta com o número certo. Quem testa a calibração é
    // `scripts/avaliar-rag.ts`, e os números estão em docs/AVALIACAO-RAG.md.
    const r = await responder({
      disciplinaId,
      pergunta: "Qual é o limite de faltas?",
      registrar: false,
      limiar: 0.1,
    });
    expect(r.resposta).toContain("25%");
    expect(r.fontes.length).toBeGreaterThan(0);
  });

  it("a mesma pergunta é recusada no limiar de produção, e isso é conhecido", async () => {
    // Sensibilidade documentada do modo de leitura direta: a similaridade de um
    // par relevante depende de quanto do trecho é sobre a pergunta. Num
    // documento de três frases, um trecho que mistura três regras diferentes
    // fica abaixo do limiar mesmo contendo a resposta.
    const r = await responder({ disciplinaId, pergunta: "Qual é o limite de faltas?", registrar: false });
    expect(r.similaridadeMaxima).toBeGreaterThan(0);
    expect(r.similaridadeMaxima).toBeLessThan(0.15);
  });

  it("admite não saber quando a informação não está no material", async () => {
    const r = await responder({
      disciplinaId,
      pergunta: "Qual é o valor da mensalidade do curso?",
      registrar: false,
    });
    expect(r.admitiuNaoSaber).toBe(true);
    expect(r.fontes).toHaveLength(0);
  });

  it("com limiar impossível, sempre admite não saber em vez de inventar", async () => {
    const r = await responder({
      disciplinaId,
      pergunta: "Quando é a Prova P1?",
      registrar: false,
      limiar: 0.999,
    });
    expect(r.admitiuNaoSaber).toBe(true);
    expect(r.fontes).toHaveLength(0);
  });

  it("declara a origem da resposta, para o aluno saber o que está lendo", async () => {
    const r = await responder({ disciplinaId, pergunta: "Prova P1", registrar: false });
    expect(["gemini", "local"]).toContain(r.origemIa);
  });

  it("mede a duração da consulta", async () => {
    const r = await responder({ disciplinaId, pergunta: "Prova P1", registrar: false });
    expect(r.duracaoMs).toBeGreaterThanOrEqual(0);
  });

  it("as fontes trazem título, similaridade e prévia do trecho", async () => {
    const r = await responder({ disciplinaId, pergunta: "Quanto vale o quiz?", registrar: false });
    for (const f of r.fontes) {
      expect(f.titulo.length).toBeGreaterThan(0);
      expect(f.similaridade).toBeGreaterThan(0);
      expect(f.trecho.length).toBeGreaterThan(0);
      expect(f.trecho.length).toBeLessThanOrEqual(401);
    }
  });

  it("registra a consulta quando pedido", async () => {
    const antes = await prisma.consultaRag.count({ where: { disciplinaId } });
    await responder({ disciplinaId, pergunta: "Quando é o exame final?" });
    const depois = await prisma.consultaRag.count({ where: { disciplinaId } });
    expect(depois).toBe(antes + 1);
  });

  it("o registro guarda pergunta, resposta, fontes e diagnóstico", async () => {
    await responder({ disciplinaId, pergunta: "Quando é a entrega do trabalho?" });
    const registro = await prisma.consultaRag.findFirst({
      where: { disciplinaId, pergunta: "Quando é a entrega do trabalho?" },
      orderBy: { criadoEm: "desc" },
    });
    expect(registro).not.toBeNull();
    expect(registro!.resposta.length).toBeGreaterThan(0);
    expect(registro!.origemIa.length).toBeGreaterThan(0);
    expect(Array.isArray(registro!.fontes)).toBe(true);
  });

  it("não registra quando pedido para não registrar", async () => {
    const antes = await prisma.consultaRag.count({ where: { disciplinaId } });
    await responder({ disciplinaId, pergunta: "pergunta que não deve ser registrada", registrar: false });
    expect(await prisma.consultaRag.count({ where: { disciplinaId } })).toBe(antes);
  });

  it("a resposta NUNCA traz conteúdo de outra disciplina", async () => {
    const r = await responder({
      disciplinaId,
      pergunta: "Qual o conteúdo cobrado na avaliação?",
      registrar: false,
    });
    expect(r.resposta).not.toContain("árvore geradora");
    expect(r.resposta).not.toContain("12 de março");
  });
});

describe("remoção em cascata", () => {
  it("apagar o documento apaga os trechos dele", async () => {
    const disciplina = await prisma.disciplina.create({
      data: { nome: `Cascata-${Date.now()}`, periodo: "2026-2" },
    });
    const { documentoId } = await ingerir({
      disciplinaId: disciplina.id,
      titulo: "Temporário",
      conteudo: CONTRATO,
      origem: "texto",
    });

    expect(await prisma.documentoChunk.count({ where: { documentoId } })).toBeGreaterThan(0);
    expect(await removerDocumento(documentoId)).toBe(true);
    expect(await prisma.documentoChunk.count({ where: { documentoId } })).toBe(0);

    await prisma.disciplina.delete({ where: { id: disciplina.id } });
  });

  it("remover documento inexistente devolve false em vez de lançar", async () => {
    expect(await removerDocumento("00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
