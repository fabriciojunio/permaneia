import { NextResponse } from "next/server";
import { NOME_COOKIE } from "@/lib/sessao";
import { sessaoAtual } from "@/lib/auth";
import { comTratamentoDeErro } from "@/lib/observabilidade";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = comTratamentoDeErro(async () => {
  const sessao = await sessaoAtual();
  if (sessao) {
    await registrar({
      acao: "logout",
      recurso: "usuario",
      recursoId: sessao.usuarioId,
      atorId: sessao.usuarioId,
      atorEmail: sessao.email,
    });
  }

  const resposta = NextResponse.json({ ok: true });
  // maxAge 0 apaga o cookie no navegador. O token em si continua válido até
  // expirar; para invalidá-lo de imediato é preciso incrementar a versão da
  // sessão, o que a troca de senha e a desativação da conta fazem.
  resposta.cookies.set(NOME_COOKIE, "", { maxAge: 0, path: "/" });
  return resposta;
});
