import type { NextRequest } from "next/server";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/rag/consulta";
import { perguntaSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { consumir, REGRA_RAG } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A geração pode levar alguns segundos; o padrão de 10 s da Vercel é apertado.
export const maxDuration = 60;

export const POST = comTratamentoDeErro(async (requisicao: NextRequest) => {
  const sessao = sessaoAtual();
  const permissao = exigir(sessao, "chat.perguntar");
  if (!permissao.ok) return respostaDeErro(permissao.erro);

  // Limite por usuário, e não por IP: numa sala de aula a turma inteira sai do
  // mesmo IP, e um limite por endereço derrubaria a demonstração ao vivo.
  const limite = consumir(`rag:${permissao.valor.usuarioId}`, REGRA_RAG);
  if (!limite.permitido) {
    const resposta = respostaDeErro(
      erro("LIMITE_EXCEDIDO", "Você fez muitas perguntas seguidas. Aguarde alguns segundos.")
    );
    resposta.headers.set("Retry-After", String(limite.esperarSegundos));
    return resposta;
  }

  const corpo = await requisicao.json().catch(() => null);
  const analisado = perguntaSchema.safeParse(corpo);
  if (!analisado.success) {
    return respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
  }

  const { disciplinaId, pergunta } = analisado.data;

  const disciplina = await prisma.disciplina.findUnique({
    where: { id: disciplinaId },
    select: { id: true, nome: true, _count: { select: { documentos: true } } },
  });
  if (!disciplina) {
    return respostaDeErro(erro("NAO_ENCONTRADO", "Disciplina não encontrada."));
  }
  if (disciplina._count.documentos === 0) {
    // Dizer isso explicitamente evita que o aluno interprete a recusa por falta
    // de contexto como uma falha do assistente.
    return respostaDeErro(
      erro(
        "VALIDACAO",
        "Esta disciplina ainda não tem nenhum documento indexado. Peça à coordenação para enviar a ementa ou o cronograma."
      )
    );
  }

  const resultado = await responder({
    disciplinaId,
    pergunta,
    alunoId: permissao.valor.alunoId,
  });

  return respostaOk({
    resposta: resultado.resposta,
    fontes: resultado.fontes,
    disciplina: { id: disciplina.id, nome: disciplina.nome },
    diagnostico: {
      origemIa: resultado.origemIa,
      similaridadeMaxima: resultado.similaridadeMaxima,
      admitiuNaoSaber: resultado.admitiuNaoSaber,
      respostaFundamentada: resultado.respostaFundamentada,
      duracaoMs: resultado.duracaoMs,
    },
  });
});
