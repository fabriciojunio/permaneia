import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/auth";
import { avaliarForca, conferirSenha, gerarHash } from "@/lib/senha";
import { assinarSessao, NOME_COOKIE, opcoesCookie, requisicaoEhSegura } from "@/lib/sessao";
import { trocarSenhaSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = sessaoAtual();
  if (!sessao) return respostaDeErro(erro("NAO_AUTORIZADO", "Faça login para continuar."));

  const corpo = await requisicao.json().catch(() => null);
  const analisado = trocarSenhaSchema.safeParse(corpo);
  if (!analisado.success) {
    return respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  const forca = avaliarForca(analisado.data.senhaNova);
  if (!forca.valida) {
    return respostaDeErro(erro("VALIDACAO", "A senha nova não atende à política.", { senhaNova: forca.problemas.join(" ") }));
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { id: true, nome: true, email: true, papel: true, senhaHash: true, versaoSessao: true, alunoId: true },
  });
  if (!usuario) return respostaDeErro(erro("NAO_AUTORIZADO", "Sessão inválida."));

  if (!(await conferirSenha(analisado.data.senhaAtual, usuario.senhaHash))) {
    return respostaDeErro(erro("NAO_AUTORIZADO", "A senha atual não confere.", { senhaAtual: "Senha incorreta." }));
  }

  // Incrementar a versão derruba na hora todos os tokens emitidos antes da
  // troca, que é o comportamento esperado de quem troca a senha por suspeitar
  // que alguém tenha acesso à conta.
  const novaVersao = usuario.versaoSessao + 1;
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      senhaHash: await gerarHash(analisado.data.senhaNova),
      versaoSessao: novaVersao,
      trocarSenha: false,
    },
  });

  await registrar({
    acao: "senha.trocada",
    recurso: "usuario",
    recursoId: usuario.id,
    atorId: usuario.id,
    atorEmail: usuario.email,
  });

  // Emite um cookie novo, senão a própria sessão de quem trocou seria derrubada.
  const token = await assinarSessao({
    usuarioId: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    alunoId: usuario.alunoId ?? undefined,
    vs: novaVersao,
    trocarSenha: false,
  });

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(NOME_COOKIE, token, opcoesCookie(requisicaoEhSegura(requisicao.headers, requisicao.url)));
  return resposta;
});
