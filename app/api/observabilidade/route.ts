import type { NextRequest } from "next/server";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { resumir } from "@/lib/rag/telemetria";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { DATA_DA_TABELA } from "@/lib/ia/custo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Janela padrão e teto. Mais de um semestre de histórico não cabe numa leitura só. */
const DIAS_PADRAO = 30;
const DIAS_MAXIMO = 180;

/**
 * Telemetria agregada do assistente: latência, degradação, tokens e custo.
 *
 * Fica atrás de `auditoria.ver`, e não de `chat.perguntar`, por dois motivos.
 * O conjunto das perguntas da turma diz mais do que cada pergunta isolada, e
 * custo de operação é informação de quem administra o sistema.
 *
 * A resposta carrega a data da tabela de preço junto com o valor. Número de
 * custo sem a data da tabela que o gerou é número sem validade: o preço do
 * provedor mudou duas vezes em 2026.
 */
export const GET = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = await sessaoAtual();
  const permissao = exigir(sessao, "auditoria.ver");
  if (!permissao.ok) return await respostaDeErro(permissao.erro);

  const pedido = Number(requisicao.nextUrl.searchParams.get("dias"));
  const dias = Number.isFinite(pedido) && pedido > 0 ? Math.min(Math.trunc(pedido), DIAS_MAXIMO) : DIAS_PADRAO;

  const resumo = await resumir(dias);

  return await respostaOk({
    ...resumo,
    dias,
    precoConferidoEm: DATA_DA_TABELA,
    observacao:
      "Custo é estimativa: tokens contados pela API do provedor, multiplicados pela tabela de preço declarada em lib/ia/custo.ts. O projeto roda no tier gratuito, então não há fatura para conferir.",
  });
});
