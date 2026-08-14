import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { sessaoAtual } from "@/lib/auth";
import { exigir, podeVerDadosDoAluno } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { buscarDetalhe, calcularEGravarRisco } from "@/lib/repositorios/matricula";
import { atualizarMatriculaSchema, uuidSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: { id: string } };

export const GET = comTratamentoDeErro(async (_requisicao: NextRequest, { params }: Contexto) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "matricula.ler");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const id = uuidSchema.safeParse(params.id);
  if (!id.success) return respostaDeErro(erro("VALIDACAO", "Identificador de matrícula inválido."));

  const detalhe = await buscarDetalhe(id.data);
  if (!detalhe) return respostaDeErro(erro("NAO_ENCONTRADO", "Matrícula não encontrada."));

  if (!podeVerDadosDoAluno(permissao.valor, detalhe.aluno.id)) {
    return respostaDeErro(erro("PROIBIDO", "Você não tem acesso aos dados desta matrícula."));
  }

  return respostaOk({ matricula: detalhe });
});

/**
 * Atualiza os sinais e recalcula o risco na mesma requisição.
 *
 * Recalcular junto, e não em uma chamada separada, é deliberado: se o
 * recálculo fosse opcional, o painel passaria a exibir um score obsoleto ao
 * lado de dados novos, e ninguém repararia. O custo é uma execução do motor
 * fuzzy, que é aritmética pura e roda em menos de um milissegundo.
 */
export const PATCH = comTratamentoDeErro(async (requisicao: NextRequest, { params }: Contexto) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "matricula.escrever");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const id = uuidSchema.safeParse(params.id);
  if (!id.success) return respostaDeErro(erro("VALIDACAO", "Identificador de matrícula inválido."));

  const corpo = await requisicao.json().catch(() => null);
  const analisado = atualizarMatriculaSchema.safeParse(corpo);
  if (!analisado.success) {
    return respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  const dados: Prisma.MatriculaUpdateInput = {};
  if (analisado.data.frequenciaPercentual !== undefined) {
    dados.frequenciaPercentual = new Prisma.Decimal(analisado.data.frequenciaPercentual);
  }
  if (analisado.data.mediaNotas !== undefined) {
    dados.mediaNotas = new Prisma.Decimal(analisado.data.mediaNotas);
  }
  if (analisado.data.acessosPlataforma !== undefined) {
    dados.acessosPlataforma = analisado.data.acessosPlataforma;
  }

  try {
    await prisma.matricula.update({ where: { id: id.data }, data: dados });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return respostaDeErro(erro("NAO_ENCONTRADO", "Matrícula não encontrada."));
    }
    throw e;
  }

  const risco = await calcularEGravarRisco(id.data);

  await registrar({
    acao: "matricula.atualizada",
    recurso: "matricula",
    recursoId: id.data,
    atorId: permissao.valor.usuarioId,
    atorEmail: permissao.valor.email,
    detalhes: { alterados: Object.keys(analisado.data), novoScore: risco?.score, novaFaixa: risco?.faixa },
  });

  return respostaOk({ matricula: await buscarDetalhe(id.data) });
});
