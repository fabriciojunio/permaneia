import { sessaoAtual } from "@/lib/auth";
import { permissoesDe } from "@/lib/acesso";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quem está logado e o que pode fazer. A interface usa isto para esconder o que não é permitido. */
export const GET = comTratamentoDeErro(async () => {
  const sessao = sessaoAtual();
  if (!sessao) return respostaDeErro(erro("NAO_AUTORIZADO", "Sessão não encontrada."));

  return respostaOk({
    usuario: {
      nome: sessao.nome,
      email: sessao.email,
      papel: sessao.papel,
      alunoId: sessao.alunoId ?? null,
    },
    permissoes: permissoesDe(sessao.papel),
  });
});
