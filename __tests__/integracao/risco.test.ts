// Integração do painel de risco, com Postgres de verdade.
//
// Cobre o que os unitários não alcançam: a conversão entre o Decimal do Prisma
// e o number do domínio, a persistência do detalhamento em JSONB, e a ordenação
// do painel, que é a funcionalidade em si.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  buscarDetalhe,
  calcularEGravarRisco,
  listarPainelDeRisco,
  recalcularTodas,
  resumoPorFaixa,
} from "@/lib/repositorios/matricula";
import { calcularRiscoEvasao } from "@/lib/fuzzy/risco";

const PERFIS = [
  { nome: "Critico", frequencia: 18, media: 2.1, acessos: 1, faixaEsperada: "critico" },
  { nome: "Desengajando", frequencia: 34, media: 8.6, acessos: 2, faixaEsperada: "alto" },
  { nome: "Mediano", frequencia: 68, media: 5.6, acessos: 11, faixaEsperada: "medio" },
  { nome: "Saudavel", frequencia: 96, media: 9.1, acessos: 34, faixaEsperada: "baixo" },
] as const;

let disciplinaId = "";
const matriculas = new Map<string, string>();

beforeAll(async () => {
  const marca = `RiscoIntegracao-${Date.now()}`;
  const disciplina = await prisma.disciplina.create({
    data: { nome: marca, professor: "Teste", periodo: "2026-2" },
  });
  disciplinaId = disciplina.id;

  for (const perfil of PERFIS) {
    const aluno = await prisma.aluno.create({
      data: {
        nome: `${perfil.nome} Sintetico`,
        email: `${perfil.nome.toLowerCase()}.${Date.now()}@aluno.permaneia.exemplo`,
        curso: "Ciência da Computação",
      },
    });
    const matricula = await prisma.matricula.create({
      data: {
        alunoId: aluno.id,
        disciplinaId,
        frequenciaPercentual: perfil.frequencia,
        mediaNotas: perfil.media,
        acessosPlataforma: perfil.acessos,
      },
    });
    matriculas.set(perfil.nome, matricula.id);
  }
});

afterAll(async () => {
  const alunos = await prisma.matricula.findMany({ where: { disciplinaId }, select: { alunoId: true } });
  await prisma.disciplina.delete({ where: { id: disciplinaId } });
  await prisma.aluno.deleteMany({ where: { id: { in: alunos.map((a) => a.alunoId) } } });
  await prisma.$disconnect();
});

describe("calcularEGravarRisco", () => {
  it.each(PERFIS)("o perfil $nome é gravado na faixa $faixaEsperada", async (perfil) => {
    const detalhe = await calcularEGravarRisco(matriculas.get(perfil.nome)!);
    expect(detalhe).not.toBeNull();
    expect(detalhe!.faixa).toBe(perfil.faixaEsperada);
  });

  it("o score gravado bate com o cálculo puro do domínio", async () => {
    const perfil = PERFIS[0]!;
    const detalhe = await calcularEGravarRisco(matriculas.get(perfil.nome)!);
    const esperado = calcularRiscoEvasao({
      frequenciaPercentual: perfil.frequencia,
      mediaNotas: perfil.media,
      acessosPlataforma: perfil.acessos,
    });
    expect(detalhe!.score).toBe(esperado.score);
  });

  it("persiste score, faixa, detalhamento e momento do cálculo", async () => {
    const id = matriculas.get("Desengajando")!;
    await calcularEGravarRisco(id);
    const gravado = await prisma.matricula.findUnique({ where: { id } });
    expect(gravado!.scoreRisco).not.toBeNull();
    expect(gravado!.faixaRisco).toBe("alto");
    expect(gravado!.scoreDetalhes).not.toBeNull();
    expect(gravado!.calculadoEm).not.toBeNull();
  });

  it("o detalhamento guardado traz as regras que produziram AQUELE score", async () => {
    // Recalcular na leitura mostraria as regras de agora, com dados que podem
    // já ter mudado desde o cálculo.
    const id = matriculas.get("Critico")!;
    await calcularEGravarRisco(id);
    const detalhe = await buscarDetalhe(id);
    expect(detalhe!.detalhes!.regrasDisparadas.length).toBeGreaterThan(0);
    expect(detalhe!.detalhes!.acaoSugerida.length).toBeGreaterThan(10);
  });

  it("o Decimal do banco volta como number utilizável", async () => {
    const detalhe = await buscarDetalhe(matriculas.get("Mediano")!);
    expect(typeof detalhe!.sinais.frequenciaPercentual).toBe("number");
    expect(typeof detalhe!.sinais.mediaNotas).toBe("number");
    expect(typeof detalhe!.scoreRisco).toBe("number");
  });

  it("matrícula inexistente devolve null em vez de lançar", async () => {
    expect(await calcularEGravarRisco("00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await buscarDetalhe("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("o score cabe na precisão da coluna, que é de três casas", async () => {
    const detalhe = await calcularEGravarRisco(matriculas.get("Saudavel")!);
    expect(String(detalhe!.score).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});

describe("listarPainelDeRisco", () => {
  beforeAll(async () => {
    await recalcularTodas();
  });

  it("ordena do mais crítico para o menos, que é a funcionalidade", async () => {
    const { linhas } = await listarPainelDeRisco({ disciplinaId });
    const scores = linhas.map((l) => l.scoreRisco ?? -1);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!);
    }
  });

  it("o aluno em situação crítica aparece no topo", async () => {
    const { linhas } = await listarPainelDeRisco({ disciplinaId });
    expect(linhas[0]!.alunoNome).toContain("Critico");
  });

  it("traz nome, e-mail, curso e disciplina de cada linha", async () => {
    const { linhas } = await listarPainelDeRisco({ disciplinaId });
    for (const l of linhas) {
      expect(l.alunoNome.length).toBeGreaterThan(0);
      expect(l.alunoEmail).toContain("@");
      expect(l.disciplinaNome.length).toBeGreaterThan(0);
    }
  });

  it("filtra por disciplina", async () => {
    const { linhas } = await listarPainelDeRisco({ disciplinaId });
    for (const l of linhas) expect(l.disciplinaId).toBe(disciplinaId);
  });

  it.each(["alto", "critico"] as const)("filtra por faixa mínima %s", async (faixa) => {
    const ordem = { baixo: 0, medio: 1, alto: 2, critico: 3 };
    const { linhas } = await listarPainelDeRisco({ disciplinaId, faixaMinima: faixa });
    for (const l of linhas) {
      expect(ordem[l.faixaRisco!]).toBeGreaterThanOrEqual(ordem[faixa]);
    }
  });

  it("respeita o limite de linhas", async () => {
    const { linhas } = await listarPainelDeRisco({ disciplinaId, limite: 2 });
    expect(linhas).toHaveLength(2);
  });

  it("o total conta todas as matrículas, e não só a página", async () => {
    const { linhas, total } = await listarPainelDeRisco({ disciplinaId, limite: 1 });
    expect(linhas).toHaveLength(1);
    expect(total).toBe(PERFIS.length);
  });

  it("o deslocamento pagina sem repetir linha", async () => {
    const primeira = await listarPainelDeRisco({ disciplinaId, limite: 2, deslocamento: 0 });
    const segunda = await listarPainelDeRisco({ disciplinaId, limite: 2, deslocamento: 2 });
    const ids = new Set([...primeira.linhas, ...segunda.linhas].map((l) => l.matriculaId));
    expect(ids.size).toBe(4);
  });

  it("prende o limite numa faixa sã", async () => {
    const { linhas } = await listarPainelDeRisco({ disciplinaId, limite: 99999 });
    expect(linhas.length).toBeLessThanOrEqual(200);
  });

  it("matrícula sem cálculo vai para o fim, e não para o começo", async () => {
    // "Ainda não calculado" não é o mesmo que "sem risco", e também não é uma
    // emergência que mereça o topo da lista.
    const aluno = await prisma.aluno.create({
      data: { nome: "Sem Calculo", email: `semcalculo.${Date.now()}@aluno.permaneia.exemplo` },
    });
    const matricula = await prisma.matricula.create({
      data: { alunoId: aluno.id, disciplinaId, frequenciaPercentual: 50, mediaNotas: 5, acessosPlataforma: 5 },
    });

    const { linhas } = await listarPainelDeRisco({ disciplinaId });
    expect(linhas[linhas.length - 1]!.matriculaId).toBe(matricula.id);

    await prisma.matricula.delete({ where: { id: matricula.id } });
    await prisma.aluno.delete({ where: { id: aluno.id } });
  });
});

describe("resumoPorFaixa", () => {
  it("conta as matrículas em cada faixa", async () => {
    await recalcularTodas();
    const resumo = await resumoPorFaixa(disciplinaId);
    expect(resumo.critico).toBeGreaterThanOrEqual(1);
    expect(resumo.alto).toBeGreaterThanOrEqual(1);
    expect(resumo.medio).toBeGreaterThanOrEqual(1);
    expect(resumo.baixo).toBeGreaterThanOrEqual(1);
  });

  it("a soma do resumo bate com o total do painel", async () => {
    const resumo = await resumoPorFaixa(disciplinaId);
    const { total } = await listarPainelDeRisco({ disciplinaId });
    const soma = resumo.baixo + resumo.medio + resumo.alto + resumo.critico + resumo.semCalculo;
    expect(soma).toBe(total);
  });

  it("traz todas as chaves mesmo quando alguma faixa está vazia", async () => {
    const resumo = await resumoPorFaixa(disciplinaId);
    for (const chave of ["baixo", "medio", "alto", "critico", "semCalculo"]) {
      expect(resumo).toHaveProperty(chave);
    }
  });
});

describe("recalcularTodas", () => {
  it("processa todas as matrículas e devolve a distribuição", async () => {
    const r = await recalcularTodas();
    expect(r.processadas).toBeGreaterThanOrEqual(PERFIS.length);
    expect(Object.keys(r.porFaixa).sort()).toEqual(["alto", "baixo", "critico", "medio"]);
  });

  it("é idempotente: rodar duas vezes produz os mesmos scores", async () => {
    await recalcularTodas();
    const primeiro = (await listarPainelDeRisco({ disciplinaId })).linhas.map((l) => l.scoreRisco);
    await recalcularTodas();
    const segundo = (await listarPainelDeRisco({ disciplinaId })).linhas.map((l) => l.scoreRisco);
    expect(segundo).toEqual(primeiro);
  });
});

describe("integridade referencial", () => {
  it("apagar o aluno apaga a matrícula em cascata", async () => {
    const aluno = await prisma.aluno.create({
      data: { nome: "Cascata", email: `cascata.${Date.now()}@aluno.permaneia.exemplo` },
    });
    const matricula = await prisma.matricula.create({
      data: { alunoId: aluno.id, disciplinaId, frequenciaPercentual: 50, mediaNotas: 5, acessosPlataforma: 5 },
    });

    await prisma.aluno.delete({ where: { id: aluno.id } });
    expect(await prisma.matricula.findUnique({ where: { id: matricula.id } })).toBeNull();
  });

  it("não permite matricular o mesmo aluno duas vezes na mesma disciplina", async () => {
    const aluno = await prisma.aluno.create({
      data: { nome: "Duplicado", email: `duplicado.${Date.now()}@aluno.permaneia.exemplo` },
    });
    await prisma.matricula.create({
      data: { alunoId: aluno.id, disciplinaId, frequenciaPercentual: 50, mediaNotas: 5, acessosPlataforma: 5 },
    });

    await expect(
      prisma.matricula.create({
        data: { alunoId: aluno.id, disciplinaId, frequenciaPercentual: 60, mediaNotas: 6, acessosPlataforma: 6 },
      })
    ).rejects.toThrow();

    await prisma.aluno.delete({ where: { id: aluno.id } });
  });

  it("não permite duas disciplinas com mesmo nome no mesmo período", async () => {
    const nome = `Unica-${Date.now()}`;
    await prisma.disciplina.create({ data: { nome, periodo: "2026-2" } });
    await expect(prisma.disciplina.create({ data: { nome, periodo: "2026-2" } })).rejects.toThrow();
    // A mesma disciplina em outro período é legítima.
    await expect(prisma.disciplina.create({ data: { nome, periodo: "2027-1" } })).resolves.toBeDefined();
    await prisma.disciplina.deleteMany({ where: { nome } });
  });

  it("não permite dois alunos com o mesmo e-mail", async () => {
    const email = `unico.${Date.now()}@aluno.permaneia.exemplo`;
    const aluno = await prisma.aluno.create({ data: { nome: "Primeiro", email } });
    await expect(prisma.aluno.create({ data: { nome: "Segundo", email } })).rejects.toThrow();
    await prisma.aluno.delete({ where: { id: aluno.id } });
  });
});
