import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { disciplinaSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { consumir, identificarCliente, REGRA_ESCRITA } from "@/lib/rate-limit";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = comTratamentoDeErro(async () => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "disciplina.ler");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const disciplinas = await prisma.disciplina.findMany({
    select: {
      id: true,
      nome: true,
      professor: true,
      periodo: true,
      criadoEm: true,
      _count: { select: { documentos: true, matriculas: true } },
    },
    orderBy: [{ periodo: "desc" }, { nome: "asc" }],
  });

  return respostaOk({
    disciplinas: disciplinas.map((d) => ({
      id: d.id,
      nome: d.nome,
      professor: d.professor,
      periodo: d.periodo,
      documentos: d._count.documentos,
      matriculas: d._count.matriculas,
      criadoEm: d.criadoEm,
    })),
  });
});

export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "disciplina.escrever");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const limite = consumir(identificarCliente(requisicao.headers, "escrita"), REGRA_ESCRITA);
  if (!limite.permitido) {
    return respostaDeErro(erro("LIMITE_EXCEDIDO", "Muitas requisições seguidas. Aguarde um instante."));
  }

  const corpo = await requisicao.json().catch(() => null);
  const analisado = disciplinaSchema.safeParse(corpo);
  if (!analisado.success) {
    return respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  try {
    const disciplina = await prisma.disciplina.create({
      data: {
        nome: analisado.data.nome,
        professor: analisado.data.professor ?? null,
        periodo: analisado.data.periodo ?? null,
      },
      select: { id: true, nome: true, professor: true, periodo: true },
    });

    await registrar({
      acao: "disciplina.criada",
      recurso: "disciplina",
      recursoId: disciplina.id,
      atorId: permissao.valor.usuarioId,
      atorEmail: permissao.valor.email,
      detalhes: { nome: disciplina.nome, periodo: disciplina.periodo },
    });

    return respostaOk({ disciplina }, 201);
  } catch (e) {
    // A chave única é (nome, periodo): a mesma disciplina pode existir em
    // semestres diferentes, mas não duas vezes no mesmo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return respostaDeErro(erro("CONFLITO", "Já existe uma disciplina com esse nome neste período."));
    }
    throw e;
  }
});
