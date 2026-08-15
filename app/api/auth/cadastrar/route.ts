import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { avaliarForca, gerarHash } from "@/lib/senha";
import { assinarSessao, NOME_COOKIE, opcoesCookie } from "@/lib/sessao";
import { cadastroSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { consumir, identificarCliente } from "@/lib/rate-limit";
import { registrar } from "@/lib/auditoria";
import { dominioPermitido, DOMINIOS_PERMITIDOS } from "@/lib/cadastro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cadastro é mais apertado que login: 3 contas por hora por origem. */
const REGRA_CADASTRO = { limite: 3, janelaMs: 60 * 60 * 1000 };

/**
 * Cria uma conta de aluno.
 *
 * Três decisões de segurança valem registro:
 *
 *   1. o papel nunca vem do formulário. Toda conta criada aqui é `aluno`.
 *      Coordenação e administração são criadas por quem já é administrador,
 *      porque o painel de risco expõe dado de toda a instituição.
 *   2. a resposta é a mesma para e-mail novo e e-mail já cadastrado. Um erro
 *      "esse e-mail já existe" transforma o cadastro em um oráculo que confirma
 *      quem tem conta no sistema.
 *   3. o registro de Aluno é criado na mesma transação da conta. Uma conta sem
 *      aluno vinculado renderizaria um chat sem histórico e um painel sem
 *      matrícula, sem nenhum erro visível.
 */
export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const limite = consumir(identificarCliente(requisicao.headers, "cadastro"), REGRA_CADASTRO);
  if (!limite.permitido) {
    const resposta = respostaDeErro(
      erro("LIMITE_EXCEDIDO", "Muitos cadastros a partir desta conexão. Tente novamente mais tarde.")
    );
    resposta.headers.set("Retry-After", String(limite.esperarSegundos));
    return resposta;
  }

  const corpo = await requisicao.json().catch(() => null);
  const analisado = cadastroSchema.safeParse(corpo);
  if (!analisado.success) {
    return respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  const { nome, email, curso, senha } = analisado.data;

  if (!dominioPermitido(email)) {
    return respostaDeErro(
      erro("VALIDACAO", "Este cadastro aceita apenas e-mails institucionais.", {
        email: `Use um e-mail de um destes domínios: ${DOMINIOS_PERMITIDOS.join(", ")}.`,
      })
    );
  }

  const forca = avaliarForca(senha);
  if (!forca.valida) {
    return respostaDeErro(
      erro("VALIDACAO", "A senha não atende à política.", { senha: forca.problemas.join(" ") })
    );
  }

  const senhaHash = await gerarHash(senha);

  let criado: { id: string; nome: string; email: string; alunoId: string } | null = null;
  try {
    criado = await prisma.$transaction(async (tx) => {
      const aluno = await tx.aluno.create({
        data: { nome, email, curso: curso ?? null },
        select: { id: true },
      });
      const usuario = await tx.usuario.create({
        data: { nome, email, senhaHash, papel: "aluno", alunoId: aluno.id },
        select: { id: true, nome: true, email: true },
      });
      return { ...usuario, alunoId: aluno.id };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // E-mail já cadastrado. A resposta é idêntica à de sucesso, sem cookie:
      // quem realmente é dono do endereço já tem conta e sabe disso.
      await registrar({ acao: "usuario.criado", recurso: "usuario", atorEmail: email, detalhes: { duplicado: true } });
      return NextResponse.json({
        ok: true,
        mensagem: "Se este e-mail ainda não tiver conta, ela foi criada. Tente entrar com sua senha.",
        autenticado: false,
      });
    }
    throw e;
  }

  await registrar({
    acao: "usuario.criado",
    recurso: "usuario",
    recursoId: criado.id,
    atorId: criado.id,
    atorEmail: criado.email,
    detalhes: { papel: "aluno", origem: "cadastro publico" },
  });

  const token = await assinarSessao({
    usuarioId: criado.id,
    email: criado.email,
    nome: criado.nome,
    papel: "aluno",
    alunoId: criado.alunoId,
    vs: 0,
    trocarSenha: false,
  });

  const resposta = NextResponse.json({
    ok: true,
    mensagem: "Conta criada.",
    autenticado: true,
    usuario: { nome: criado.nome, email: criado.email, papel: "aluno" },
  });
  resposta.cookies.set(NOME_COOKIE, token, opcoesCookie());
  return resposta;
});
