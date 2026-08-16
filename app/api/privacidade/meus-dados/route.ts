import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Portabilidade: devolve tudo que o sistema guarda sobre quem está pedindo.
 *
 * É o artigo 18 da LGPD implementado, e não apenas descrito na política. Os
 * dados desta instalação são sintéticos, mas o direito precisa funcionar de
 * verdade para que o sistema possa um dia receber dados reais.
 */
export const GET = comTratamentoDeErro(async () => {
  const sessao = await sessaoAtual();
  const permissao = exigir(sessao, "privacidade.propriosDados");
  if (!permissao.ok) return await respostaDeErro(permissao.erro);

  const { usuarioId, alunoId, email } = permissao.valor;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true, email: true, papel: true, criadoEm: true, ultimoAcesso: true },
  });

  const aluno = alunoId
    ? await prisma.aluno.findUnique({
        where: { id: alunoId },
        select: {
          nome: true,
          email: true,
          curso: true,
          criadoEm: true,
          matriculas: {
            select: {
              frequenciaPercentual: true,
              mediaNotas: true,
              acessosPlataforma: true,
              scoreRisco: true,
              faixaRisco: true,
              calculadoEm: true,
              disciplina: { select: { nome: true, periodo: true } },
            },
          },
        },
      })
    : null;

  const consultas = alunoId
    ? await prisma.consultaRag.findMany({
        where: { alunoId },
        select: { pergunta: true, resposta: true, criadoEm: true, disciplina: { select: { nome: true } } },
        orderBy: { criadoEm: "desc" },
        take: 500,
      })
    : [];

  await registrar({
    acao: "dados.exportados",
    recurso: "usuario",
    recursoId: usuarioId,
    atorId: usuarioId,
    atorEmail: email,
  });

  return await respostaOk({
    geradoEm: new Date().toISOString(),
    aviso:
      "Esta instalação usa exclusivamente dados sintéticos, gerados para fins acadêmicos. Nenhum dado corresponde a uma pessoa real.",
    conta: usuario,
    aluno,
    consultasAoAssistente: consultas,
  });
});
