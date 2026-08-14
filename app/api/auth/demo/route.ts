import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assinarSessao, NOME_COOKIE, opcoesCookie } from "@/lib/sessao";
import { MODO_DEMO, CONTAS_DEMO } from "@/lib/demo";
import { comTratamentoDeErro, respostaDeErro } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { consumir, identificarCliente, REGRA_LOGIN } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada de vitrine, só no modo demonstração.
 *
 * Com o modo desligado a rota responde 404, e não 403: um 403 confirmaria que
 * a rota existe e que há uma porta de entrada alternativa para procurar.
 */
export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  if (!MODO_DEMO) {
    return NextResponse.json({ erro: { codigo: "NAO_ENCONTRADO", mensagem: "Não encontrado." } }, { status: 404 });
  }

  const limite = consumir(identificarCliente(requisicao.headers, "demo"), REGRA_LOGIN);
  if (!limite.permitido) {
    return respostaDeErro(erro("LIMITE_EXCEDIDO", "Muitas tentativas seguidas. Aguarde um instante."));
  }

  const corpo = (await requisicao.json().catch(() => null)) as { papel?: string } | null;
  const escolhido = CONTAS_DEMO.find((c) => c.papel === corpo?.papel) ?? CONTAS_DEMO[0]!;

  const usuario = await prisma.usuario.findUnique({
    where: { email: escolhido.email },
    select: { id: true, nome: true, email: true, papel: true, versaoSessao: true, alunoId: true, ativo: true },
  });

  if (!usuario || !usuario.ativo) {
    return respostaDeErro(
      erro("INDISPONIVEL", "A base de demonstração ainda não foi carregada. Rode o seed de dados sintéticos.")
    );
  }

  const token = await assinarSessao({
    usuarioId: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    alunoId: usuario.alunoId ?? undefined,
    vs: usuario.versaoSessao,
    trocarSenha: false,
  });

  const resposta = NextResponse.json({
    usuario: { nome: usuario.nome, email: usuario.email, papel: usuario.papel },
  });
  resposta.cookies.set(NOME_COOKIE, token, opcoesCookie());
  return resposta;
});
