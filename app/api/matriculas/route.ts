import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { calcularEGravarRisco } from "@/lib/repositorios/matricula";
import { matriculaSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { consumir, identificarCliente, REGRA_ESCRITA } from "@/lib/rate-limit";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = await sessaoAtual();
  const permissao = exigir(sessao, "matricula.escrever");
  if (!permissao.ok) return await respostaDeErro(permissao.erro);

  const limite = consumir(identificarCliente(requisicao.headers, "escrita"), REGRA_ESCRITA);
  if (!limite.permitido) {
    return await respostaDeErro(erro("LIMITE_EXCEDIDO", "Muitas requisições seguidas. Aguarde um instante."));
  }

  const corpo = await requisicao.json().catch(() => null);
  const analisado = matriculaSchema.safeParse(corpo);
  if (!analisado.success) {
    return await respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  const dados = analisado.data;

  try {
    const matricula = await prisma.matricula.create({
      data: {
        alunoId: dados.alunoId,
        disciplinaId: dados.disciplinaId,
        frequenciaPercentual: new Prisma.Decimal(dados.frequenciaPercentual),
        mediaNotas: new Prisma.Decimal(dados.mediaNotas),
        acessosPlataforma: dados.acessosPlataforma,
      },
      select: { id: true },
    });

    // O score já nasce calculado: uma matrícula sem risco no painel seria lida
    // como "aluno tranquilo", que é o erro mais caro que este sistema pode cometer.
    const risco = await calcularEGravarRisco(matricula.id);

    await registrar({
      acao: "matricula.criada",
      recurso: "matricula",
      recursoId: matricula.id,
      atorId: permissao.valor.usuarioId,
      atorEmail: permissao.valor.email,
      detalhes: { score: risco?.score, faixa: risco?.faixa },
    });

    return await respostaOk({ matricula: { id: matricula.id, risco } }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return await respostaDeErro(erro("CONFLITO", "Este aluno já está matriculado nesta disciplina."));
      }
      if (e.code === "P2003") {
        return await respostaDeErro(erro("VALIDACAO", "Aluno ou disciplina não encontrados."));
      }
    }
    throw e;
  }
});
