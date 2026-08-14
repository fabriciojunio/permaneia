// Acesso às matrículas e ao painel de risco.

import { Prisma, type FaixaRisco } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularRiscoEvasao, type DetalheRisco } from "@/lib/fuzzy/risco";

/** O Prisma devolve Decimal; a lógica de domínio trabalha com number. */
function paraNumero(valor: Prisma.Decimal | number | null): number {
  if (valor === null) return 0;
  return typeof valor === "number" ? valor : Number(valor);
}

export type LinhaPainel = {
  matriculaId: string;
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  curso: string | null;
  disciplinaId: string;
  disciplinaNome: string;
  frequenciaPercentual: number;
  mediaNotas: number;
  acessosPlataforma: number;
  scoreRisco: number | null;
  faixaRisco: FaixaRisco | null;
  calculadoEm: Date | null;
};

/**
 * Painel de risco, ordenado do mais crítico para o menos.
 *
 * A ordenação é a funcionalidade: a coordenação abre a tela e trabalha de cima
 * para baixo. Matrícula sem score calculado vai para o fim, e não para o
 * começo, porque "ainda não calculado" não é o mesmo que "sem risco" e também
 * não é uma emergência.
 */
export async function listarPainelDeRisco(filtros: {
  disciplinaId?: string;
  faixaMinima?: FaixaRisco;
  limite?: number;
  deslocamento?: number;
} = {}): Promise<{ linhas: LinhaPainel[]; total: number }> {
  const ondeBase: Prisma.MatriculaWhereInput = {};
  if (filtros.disciplinaId) ondeBase.disciplinaId = filtros.disciplinaId;

  const ordem: FaixaRisco[] = ["baixo", "medio", "alto", "critico"];
  if (filtros.faixaMinima) {
    const aceitas = ordem.slice(ordem.indexOf(filtros.faixaMinima));
    ondeBase.faixaRisco = { in: aceitas };
  }

  const limite = Math.min(200, Math.max(1, filtros.limite ?? 100));
  const deslocamento = Math.max(0, filtros.deslocamento ?? 0);

  const [registros, total] = await Promise.all([
    prisma.matricula.findMany({
      where: ondeBase,
      include: {
        aluno: { select: { id: true, nome: true, email: true, curso: true } },
        disciplina: { select: { id: true, nome: true } },
      },
      orderBy: [{ scoreRisco: { sort: "desc", nulls: "last" } }, { atualizadoEm: "desc" }],
      take: limite,
      skip: deslocamento,
    }),
    prisma.matricula.count({ where: ondeBase }),
  ]);

  return {
    total,
    linhas: registros.map((m) => ({
      matriculaId: m.id,
      alunoId: m.aluno.id,
      alunoNome: m.aluno.nome,
      alunoEmail: m.aluno.email,
      curso: m.aluno.curso,
      disciplinaId: m.disciplina.id,
      disciplinaNome: m.disciplina.nome,
      frequenciaPercentual: paraNumero(m.frequenciaPercentual),
      mediaNotas: paraNumero(m.mediaNotas),
      acessosPlataforma: m.acessosPlataforma,
      scoreRisco: m.scoreRisco === null ? null : paraNumero(m.scoreRisco),
      faixaRisco: m.faixaRisco,
      calculadoEm: m.calculadoEm,
    })),
  };
}

/**
 * Roda o sistema fuzzy sobre a matrícula e persiste score, faixa e o
 * detalhamento completo. O detalhamento é gravado junto porque a tela de
 * explicação precisa mostrar exatamente as regras que produziram AQUELE score,
 * e recalcular na leitura mostraria as regras de agora, com dados que podem já
 * ter mudado.
 */
export async function calcularEGravarRisco(matriculaId: string): Promise<DetalheRisco | null> {
  const matricula = await prisma.matricula.findUnique({ where: { id: matriculaId } });
  if (!matricula) return null;

  const detalhe = calcularRiscoEvasao({
    frequenciaPercentual: paraNumero(matricula.frequenciaPercentual),
    mediaNotas: paraNumero(matricula.mediaNotas),
    acessosPlataforma: matricula.acessosPlataforma,
  });

  await prisma.matricula.update({
    where: { id: matriculaId },
    data: {
      scoreRisco: new Prisma.Decimal(detalhe.score),
      faixaRisco: detalhe.faixa,
      scoreDetalhes: detalhe as unknown as Prisma.InputJsonValue,
      calculadoEm: new Date(),
    },
  });

  return detalhe;
}

/** Recalcula todas as matrículas. Usado depois de mudar a calibração das regras. */
export async function recalcularTodas(): Promise<{ processadas: number; porFaixa: Record<string, number> }> {
  const matriculas = await prisma.matricula.findMany({ select: { id: true } });
  const porFaixa: Record<string, number> = { baixo: 0, medio: 0, alto: 0, critico: 0 };

  for (const { id } of matriculas) {
    const detalhe = await calcularEGravarRisco(id);
    if (detalhe) porFaixa[detalhe.faixa] = (porFaixa[detalhe.faixa] ?? 0) + 1;
  }

  return { processadas: matriculas.length, porFaixa };
}

/** Resumo por faixa, para os cartões do topo do painel. */
export async function resumoPorFaixa(disciplinaId?: string): Promise<Record<string, number>> {
  const grupos = await prisma.matricula.groupBy({
    by: ["faixaRisco"],
    where: disciplinaId ? { disciplinaId } : {},
    _count: { _all: true },
  });

  const saida: Record<string, number> = { baixo: 0, medio: 0, alto: 0, critico: 0, semCalculo: 0 };
  for (const g of grupos) {
    if (g.faixaRisco === null) saida.semCalculo = g._count._all;
    else saida[g.faixaRisco] = g._count._all;
  }
  return saida;
}

export async function buscarDetalhe(matriculaId: string) {
  const m = await prisma.matricula.findUnique({
    where: { id: matriculaId },
    include: {
      aluno: { select: { id: true, nome: true, email: true, curso: true } },
      disciplina: { select: { id: true, nome: true, professor: true, periodo: true } },
    },
  });
  if (!m) return null;

  return {
    matriculaId: m.id,
    aluno: m.aluno,
    disciplina: m.disciplina,
    sinais: {
      frequenciaPercentual: paraNumero(m.frequenciaPercentual),
      mediaNotas: paraNumero(m.mediaNotas),
      acessosPlataforma: m.acessosPlataforma,
    },
    scoreRisco: m.scoreRisco === null ? null : paraNumero(m.scoreRisco),
    faixaRisco: m.faixaRisco,
    detalhes: m.scoreDetalhes as unknown as DetalheRisco | null,
    calculadoEm: m.calculadoEm,
  };
}
