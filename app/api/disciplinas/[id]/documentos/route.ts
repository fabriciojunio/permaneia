import type { NextRequest } from "next/server";
import { sessaoAtual } from "@/lib/auth";
import { exigir } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { ingerir } from "@/lib/rag/ingestao";
import { extrairTextoDePdf, TAMANHO_MAXIMO_PDF } from "@/lib/rag/pdf";
import { listarDocumentosDaDisciplina } from "@/lib/repositorios/documento";
import { documentoTextoSchema, uuidSchema, camposComErro } from "@/lib/validacoes";
import { comTratamentoDeErro, respostaDeErro, respostaOk } from "@/lib/observabilidade";
import { erro } from "@/lib/resultado";
import { consumir, identificarCliente, REGRA_UPLOAD } from "@/lib/rate-limit";
import { registrar } from "@/lib/auditoria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ingestão gera embeddings de todos os trechos; um cronograma inteiro leva tempo.
export const maxDuration = 120;

// Next 15: os parâmetros da rota dinâmica chegam como Promise.
type Contexto = { params: Promise<{ id: string }> };

export const GET = comTratamentoDeErro(async (_requisicao: NextRequest, { params }: Contexto) => {
  const { id: idBruto } = await params;
  const sessao = await sessaoAtual();
  const permissao = exigir(sessao, "disciplina.ler");
  if (!permissao.ok) return await respostaDeErro(permissao.erro);

  const id = uuidSchema.safeParse(idBruto);
  if (!id.success) return await respostaDeErro(erro("VALIDACAO", "Identificador de disciplina inválido."));

  return await respostaOk({ documentos: await listarDocumentosDaDisciplina(id.data) });
});

/**
 * Ingestão de documento. Aceita duas formas de envio:
 *
 *   multipart/form-data  com um PDF, que é o caminho normal da coordenação
 *   application/json     com texto puro, usado pelos scripts e pelos testes
 *
 * As duas convergem para o mesmo pipeline de ingestão.
 */
export const POST = comTratamentoDeErro(async (requisicao: NextRequest, { params }: Contexto) => {
  const { id: idBruto } = await params;
  const sessao = await sessaoAtual();
  const permissao = exigir(sessao, "documento.ingerir");
  if (!permissao.ok) return await respostaDeErro(permissao.erro);

  const limite = consumir(identificarCliente(requisicao.headers, "upload"), REGRA_UPLOAD);
  if (!limite.permitido) {
    return await respostaDeErro(erro("LIMITE_EXCEDIDO", "Muitos envios seguidos. Aguarde alguns minutos."));
  }

  const id = uuidSchema.safeParse(idBruto);
  if (!id.success) return await respostaDeErro(erro("VALIDACAO", "Identificador de disciplina inválido."));

  const disciplina = await prisma.disciplina.findUnique({ where: { id: id.data }, select: { id: true, nome: true } });
  if (!disciplina) return await respostaDeErro(erro("NAO_ENCONTRADO", "Disciplina não encontrada."));

  const tipo = requisicao.headers.get("content-type") ?? "";

  let titulo: string;
  let referencia: string | undefined;
  let conteudo: string;
  let origem: "upload" | "texto";

  if (tipo.includes("multipart/form-data")) {
    const formulario = await requisicao.formData();
    const arquivo = formulario.get("arquivo");
    if (!(arquivo instanceof File)) {
      return await respostaDeErro(erro("VALIDACAO", "Envie o arquivo no campo \"arquivo\"."));
    }
    if (arquivo.size > TAMANHO_MAXIMO_PDF) {
      return await respostaDeErro(
        erro("VALIDACAO", `O arquivo passa do limite de ${TAMANHO_MAXIMO_PDF / 1024 / 1024} MB.`)
      );
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    try {
      const extraido = await extrairTextoDePdf(bytes);
      conteudo = extraido.texto;
    } catch (e) {
      return await respostaDeErro(erro("VALIDACAO", (e as Error).message));
    }

    titulo = String(formulario.get("titulo") ?? arquivo.name.replace(/\.pdf$/i, "")).trim().slice(0, 200);
    const refBruta = formulario.get("referencia");
    referencia = refBruta ? String(refBruta).trim().slice(0, 120) : undefined;
    origem = "upload";

    if (!titulo) return await respostaDeErro(erro("VALIDACAO", "Informe o título do documento."));
  } else {
    const corpo = await requisicao.json().catch(() => null);
    const analisado = documentoTextoSchema.safeParse(corpo);
    if (!analisado.success) {
      return await respostaDeErro(erro("VALIDACAO", "Confira os campos.", camposComErro(analisado.error)));
    }
    titulo = analisado.data.titulo;
    referencia = analisado.data.referencia;
    conteudo = analisado.data.conteudo;
    origem = "texto";
  }

  let resultado;
  try {
    resultado = await ingerir({
      disciplinaId: disciplina.id,
      titulo,
      referencia,
      conteudo,
      origem,
    });
  } catch (e) {
    return await respostaDeErro(erro("VALIDACAO", (e as Error).message));
  }

  await registrar({
    acao: "documento.ingerido",
    recurso: "documento",
    recursoId: resultado.documentoId,
    atorId: permissao.valor.usuarioId,
    atorEmail: permissao.valor.email,
    detalhes: {
      disciplina: disciplina.nome,
      titulo: resultado.titulo,
      trechos: resultado.trechos,
      origemEmbedding: resultado.origemEmbedding,
    },
  });

  return await respostaOk({ documento: resultado }, 201);
});
