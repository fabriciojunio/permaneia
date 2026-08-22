import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quantas perguntas a tela recupera. Cabe numa rolagem e não pesa na consulta. */
const LIMITE = 30;

/**
 * As últimas perguntas de quem está pedindo.
 *
 * Existe porque a conversa vivia só na memória do navegador: bastava atualizar a
 * página, trocar de disciplina ou fechar a aba para o histórico sumir, e numa
 * demonstração ao vivo isso significa perder o que acabou de ser mostrado. As
 * consultas já eram gravadas em consultas_rag desde o começo; o que faltava era
 * uma porta para lê-las de volta.
 *
 * O recorte é por autor, e não por disciplina: pergunta de aluno revela dúvida
 * de aluno, e ninguém além dele precisa vê-la para o sistema funcionar. Quem
 * não tem aluno vinculado à conta, caso do papel administrativo, vê apenas as
 * consultas que não pertencem a nenhum aluno, que são as suas próprias.
 */
export const GET = comTratamentoDeErro(async () => {
  const sessao = await sessaoAtual();
  const permissao = exigir(sessao, "chat.perguntar");
  if (!permissao.ok) return await respostaDeErro(permissao.erro);

  const alunoId = permissao.valor.alunoId ?? null;

  const consultas = await prisma.consultaRag.findMany({
    where: { alunoId },
    orderBy: { criadoEm: "desc" },
    take: LIMITE,
    select: {
      id: true,
      pergunta: true,
      resposta: true,
      fontes: true,
      origemIa: true,
      similaridadeMaxima: true,
      admitiuNaoSaber: true,
      duracaoMs: true,
      criadoEm: true,
      disciplina: { select: { id: true, nome: true } },
    },
  });

  return await respostaOk({
    // Da mais antiga para a mais recente: é a ordem em que a conversa é lida.
    consultas: consultas.reverse().map((c) => ({
      id: c.id,
      pergunta: c.pergunta,
      resposta: c.resposta,
      fontes: c.fontes,
      origemIa: c.origemIa,
      similaridadeMaxima: c.similaridadeMaxima === null ? 0 : Number(c.similaridadeMaxima),
      admitiuNaoSaber: c.admitiuNaoSaber,
      duracaoMs: c.duracaoMs ?? 0,
      criadoEm: c.criadoEm,
      disciplina: c.disciplina,
    })),
  });
});
