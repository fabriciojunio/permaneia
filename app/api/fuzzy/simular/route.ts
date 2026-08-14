import type { NextRequest } from "next/server";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { calcularRiscoEvasao, compararComCriterioPorNota } from "@/lib/fuzzy/risco";
import { BASE_DE_REGRAS } from "@/lib/fuzzy/regras";
import { ENGAJAMENTO, FREQUENCIA, NOTAS, RISCO } from "@/lib/fuzzy/variaveis";
import { sinaisSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descreve o sistema fuzzy: variáveis, conjuntos e base de regras.
 *
 * Existe para a tela de simulação e para a apresentação: dá para abrir esta
 * rota ao vivo e mostrar que os conjuntos e as 27 regras são exatamente os que
 * estão no relatório, sem depender de um slide que pode estar desatualizado.
 */
export const GET = comTratamentoDeErro(async () => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "disciplina.ler");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const descrever = (v: typeof FREQUENCIA | typeof NOTAS | typeof ENGAJAMENTO | typeof RISCO) => ({
    nome: v.nome,
    descricao: v.descricao,
    universo: { minimo: v.minimo, maximo: v.maximo },
    termos: v.termos.map((t) => ({ rotulo: t.rotulo, forma: t.forma })),
  });

  return respostaOk({
    entradas: [descrever(FREQUENCIA), descrever(NOTAS), descrever(ENGAJAMENTO)],
    saida: descrever(RISCO),
    regras: BASE_DE_REGRAS.map((r) => ({
      id: r.id,
      se: r.se,
      entao: r.entao,
      destaque: r.destaque === true,
      porque: r.porque,
    })),
    metodo: {
      conectivo: "mínimo (norma T de Mamdani)",
      implicacao: "recorte por mínimo",
      agregacao: "máximo",
      defuzzificacao: "centroide",
    },
  });
});

/** Simula o risco para valores arbitrários, sem tocar em nenhuma matrícula. */
export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "risco.calcular");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  const corpo = await requisicao.json().catch(() => null);
  const analisado = sinaisSchema.safeParse(corpo);
  if (!analisado.success) {
    return respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  return respostaOk({
    risco: calcularRiscoEvasao(analisado.data),
    comparacao: compararComCriterioPorNota(analisado.data),
  });
});
