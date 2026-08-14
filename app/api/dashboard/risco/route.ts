import type { NextRequest } from "next/server";
import type { FaixaRisco } from "@prisma/client";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { listarPainelDeRisco, resumoPorFaixa } from "@/lib/repositorios/matricula";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FAIXAS: FaixaRisco[] = ["baixo", "medio", "alto", "critico"];

export const GET = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "dashboard.ver");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const parametros = requisicao.nextUrl.searchParams;

  const disciplinaId = parametros.get("disciplinaId") ?? undefined;
  if (disciplinaId && !/^[0-9a-f-]{36}$/i.test(disciplinaId)) {
    return respostaDeErro(erro("VALIDACAO", "Identificador de disciplina inválido."));
  }

  const faixaBruta = parametros.get("faixaMinima");
  if (faixaBruta && !FAIXAS.includes(faixaBruta as FaixaRisco)) {
    return respostaDeErro(erro("VALIDACAO", `A faixa mínima precisa ser uma de: ${FAIXAS.join(", ")}.`));
  }

  const limite = Number(parametros.get("limite") ?? 100);
  const deslocamento = Number(parametros.get("deslocamento") ?? 0);

  const [painel, resumo] = await Promise.all([
    listarPainelDeRisco({
      disciplinaId,
      faixaMinima: (faixaBruta as FaixaRisco | null) ?? undefined,
      limite: Number.isFinite(limite) ? limite : 100,
      deslocamento: Number.isFinite(deslocamento) ? deslocamento : 0,
    }),
    resumoPorFaixa(disciplinaId),
  ]);

  return respostaOk({ ...painel, resumo });
});
