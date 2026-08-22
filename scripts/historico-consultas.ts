// Exporta e restaura o histórico de perguntas do assistente.
//
// Existe porque o seed apaga a base inteira, e as perguntas que a turma fez são
// justamente o registro que não se recria: o resto (alunos, matrículas, notas)
// é sintético e determinístico, mas a pergunta que alguém digitou na
// demonstração aconteceu uma vez só.
//
// A restauração casa a disciplina pelo NOME, e não pelo identificador: o seed
// gera identificadores novos a cada execução, e o nome é o que se mantém.
//
// Uso:
//   npx tsx scripts/historico-consultas.ts exportar data/historico-consultas.json
//   npx tsx scripts/historico-consultas.ts restaurar data/historico-consultas.json

import "./_carregar-env";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

type ConsultaExportada = {
  disciplina: string;
  pergunta: string;
  resposta: string;
  fontes: unknown;
  origemIa: string;
  similaridadeMaxima: number | null;
  admitiuNaoSaber: boolean;
  duracaoMs: number | null;
  criadoEm: string;
};

async function exportar(arquivo: string): Promise<void> {
  const consultas = await prisma.consultaRag.findMany({
    orderBy: { criadoEm: "asc" },
    include: { disciplina: { select: { nome: true } } },
  });

  const saida: ConsultaExportada[] = consultas.map((c) => ({
    disciplina: c.disciplina.nome,
    pergunta: c.pergunta,
    resposta: c.resposta,
    fontes: c.fontes,
    origemIa: c.origemIa,
    similaridadeMaxima: c.similaridadeMaxima === null ? null : Number(c.similaridadeMaxima),
    admitiuNaoSaber: c.admitiuNaoSaber,
    duracaoMs: c.duracaoMs,
    criadoEm: c.criadoEm.toISOString(),
  }));

  writeFileSync(arquivo, `${JSON.stringify(saida, null, 2)}\n`, "utf8");
  console.log(`${saida.length} pergunta(s) exportada(s) para ${arquivo}`);
}

async function restaurar(arquivo: string): Promise<void> {
  if (!existsSync(arquivo)) {
    console.log(`Nada a restaurar: ${arquivo} não existe.`);
    return;
  }

  const itens = JSON.parse(readFileSync(arquivo, "utf8")) as ConsultaExportada[];
  const disciplinas = await prisma.disciplina.findMany({ select: { id: true, nome: true } });
  const porNome = new Map(disciplinas.map((d) => [d.nome, d.id]));

  // As perguntas voltam para a conta de demonstração, que é de onde saíram e é
  // a única que tem como vê-las de novo na tela.
  const demo = await prisma.usuario.findUnique({
    where: { email: "aluno@permaneia.exemplo" },
    select: { alunoId: true },
  });

  let restauradas = 0;
  let perdidas = 0;

  for (const item of itens) {
    const disciplinaId = porNome.get(item.disciplina);
    if (!disciplinaId) {
      perdidas += 1;
      continue;
    }

    // A pergunta pode já ter sido restaurada numa execução anterior. Comparar
    // pelo par pergunta e instante evita duplicar a linha a cada tentativa.
    const jaExiste = await prisma.consultaRag.findFirst({
      where: { disciplinaId, pergunta: item.pergunta, criadoEm: new Date(item.criadoEm) },
      select: { id: true },
    });
    if (jaExiste) continue;

    await prisma.consultaRag.create({
      data: {
        alunoId: demo?.alunoId ?? null,
        disciplinaId,
        pergunta: item.pergunta,
        resposta: item.resposta,
        fontes: (item.fontes ?? []) as Prisma.InputJsonValue,
        origemIa: item.origemIa,
        similaridadeMaxima:
          item.similaridadeMaxima === null ? null : new Prisma.Decimal(item.similaridadeMaxima),
        admitiuNaoSaber: item.admitiuNaoSaber,
        duracaoMs: item.duracaoMs,
        criadoEm: new Date(item.criadoEm),
      },
    });
    restauradas += 1;
  }

  console.log(`${restauradas} pergunta(s) restaurada(s).`);
  if (perdidas > 0) {
    console.log(`${perdidas} ficaram de fora: a disciplina delas não existe mais na base.`);
  }
}

async function main(): Promise<void> {
  const [acao, arquivo = "data/historico-consultas.json"] = process.argv.slice(2);

  if (acao === "exportar") return await exportar(arquivo);
  if (acao === "restaurar") return await restaurar(arquivo);

  console.log("Uso: npx tsx scripts/historico-consultas.ts <exportar|restaurar> [arquivo]");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Falhou:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
