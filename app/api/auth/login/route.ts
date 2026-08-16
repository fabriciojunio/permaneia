import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { conferirSenha } from "@/lib/senha";
import { assinarSessao, NOME_COOKIE, opcoesCookie, requisicaoEhSegura } from "@/lib/sessao";
import { loginSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { consumir, identificarCliente, REGRA_LOGIN } from "@/lib/rate-limit";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mensagem única para usuário inexistente e senha errada.
 *
 * Diferenciar as duas entregaria de graça uma lista de e-mails válidos da
 * instituição, que é justamente o insumo de um ataque de força bruta dirigido.
 */
const CREDENCIAL_INVALIDA = "E-mail ou senha incorretos.";

export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const limite = consumir(identificarCliente(requisicao.headers, "login"), REGRA_LOGIN);
  if (!limite.permitido) {
    const resposta = await respostaDeErro(
      erro("LIMITE_EXCEDIDO", "Muitas tentativas seguidas. Aguarde um instante e tente de novo.")
    );
    resposta.headers.set("Retry-After", String(limite.esperarSegundos));
    return resposta;
  }

  const corpo = await requisicao.json().catch(() => null);
  const analisado = loginSchema.safeParse(corpo);
  if (!analisado.success) {
    return await respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  const { email, senha } = analisado.data;
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: {
      id: true,
      nome: true,
      email: true,
      senhaHash: true,
      papel: true,
      ativo: true,
      versaoSessao: true,
      trocarSenha: true,
      alunoId: true,
    },
  });

  // Confere a senha mesmo quando o usuário não existe, contra um hash descartável.
  // Sem isso, a diferença de tempo entre os dois caminhos revelaria quais
  // e-mails estão cadastrados, mesmo com a mensagem de erro idêntica.
  const hashParaComparar = usuario?.senhaHash ?? "$2a$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalidoinval";
  const senhaConfere = await conferirSenha(senha, hashParaComparar);

  if (!usuario || !senhaConfere || !usuario.ativo) {
    await registrar({ acao: "login.falha", recurso: "usuario", atorEmail: email });
    return await respostaDeErro(erro("NAO_AUTORIZADO", CREDENCIAL_INVALIDA));
  }

  const token = await assinarSessao({
    usuarioId: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    alunoId: usuario.alunoId ?? undefined,
    vs: usuario.versaoSessao,
    trocarSenha: usuario.trocarSenha,
  });

  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcesso: new Date() } });
  await registrar({
    acao: "login.sucesso",
    recurso: "usuario",
    recursoId: usuario.id,
    atorId: usuario.id,
    atorEmail: usuario.email,
  });

  const resposta = NextResponse.json({
    usuario: {
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      trocarSenha: usuario.trocarSenha,
    },
  });
  resposta.cookies.set(NOME_COOKIE, token, opcoesCookie(requisicaoEhSegura(requisicao.headers, requisicao.url)));
  return resposta;
});
