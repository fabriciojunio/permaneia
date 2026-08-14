import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { alunoSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { consumir, identificarCliente, REGRA_ESCRITA } from "@/lib/rate-limit";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "aluno.ler");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const busca = (requisicao.nextUrl.searchParams.get("busca") ?? "").trim().slice(0, 100);

  const alunos = await prisma.aluno.findMany({
    where: {
      anonimizadoEm: null,
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { email: { contains: busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      nome: true,
      email: true,
      curso: true,
      criadoEm: true,
      _count: { select: { matriculas: true } },
    },
    orderBy: { nome: "asc" },
    take: 200,
  });

  return respostaOk({
    alunos: alunos.map((a) => ({
      id: a.id,
      nome: a.nome,
      email: a.email,
      curso: a.curso,
      matriculas: a._count.matriculas,
      criadoEm: a.criadoEm,
    })),
  });
});

export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "aluno.escrever");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const limite = consumir(identificarCliente(requisicao.headers, "escrita"), REGRA_ESCRITA);
  if (!limite.permitido) {
    return respostaDeErro(erro("LIMITE_EXCEDIDO", "Muitas requisições seguidas. Aguarde um instante."));
  }

  const corpo = await requisicao.json().catch(() => null);
  const analisado = alunoSchema.safeParse(corpo);
  if (!analisado.success) {
    return respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  try {
    const aluno = await prisma.aluno.create({
      data: {
        nome: analisado.data.nome,
        email: analisado.data.email,
        curso: analisado.data.curso ?? null,
      },
      select: { id: true, nome: true, email: true, curso: true },
    });

    await registrar({
      acao: "aluno.criado",
      recurso: "aluno",
      recursoId: aluno.id,
      atorId: permissao.valor.usuarioId,
      atorEmail: permissao.valor.email,
    });

    return respostaOk({ aluno }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return respostaDeErro(erro("CONFLITO", "Já existe um aluno com esse e-mail."));
    }
    throw e;
  }
});
