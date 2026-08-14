import type { NextRequest } from "next/server";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { calcularEGravarRisco } from "@/lib/repositorios/matricula";
import { uuidSchema } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: { id: string } };

/** Roda o sistema fuzzy sobre a matrícula e grava score, faixa e detalhamento. */
export const POST = comTratamentoDeErro(async (_requisicao: NextRequest, { params }: Contexto) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "risco.calcular");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const id = uuidSchema.safeParse(params.id);
  if (!id.success) return respostaDeErro(erro("VALIDACAO", "Identificador de matrícula inválido."));

  const detalhe = await calcularEGravarRisco(id.data);
  if (!detalhe) return respostaDeErro(erro("NAO_ENCONTRADO", "Matrícula não encontrada."));

  await registrar({
    acao: "risco.calculado",
    recurso: "matricula",
    recursoId: id.data,
    atorId: permissao.valor.usuarioId,
    atorEmail: permissao.valor.email,
    detalhes: { score: detalhe.score, faixa: detalhe.faixa, regraDominante: detalhe.regraDominante?.id },
  });

  return respostaOk({ risco: detalhe });
});
