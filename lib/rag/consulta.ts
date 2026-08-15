// Consulta do RAG: da pergunta do aluno até a resposta com fontes citadas.
//
// O fluxo tem sete passos, e a ordem importa:
//
//   1. gera o vetor da pergunta
//   2. busca os trechos mais próximos DENTRO da disciplina
//   3. descarta o que não passa do limiar de relevância
//   4. se não sobrou nada, responde que não sabe e para aqui
//   5. remove trechos redundantes e monta o prompt com o contexto
//   6. chama o provedor de IA, com fallback para o modo extrativo
//   7. confere se a resposta cita alguma fonte, registra e devolve
//
// O passo 4 é o que diferencia este sistema de um chatbot com um PDF colado no
// prompt: sem contexto relevante, ele não tenta. E o passo 7 é o que
// diferencia de confiar cegamente na instrução dada ao modelo.

import { gerarEmbeddingComFallback, gerarTextoComFallback } from "@/lib/ia";
import type { OrigemResposta } from "@/lib/ia/provedor";
import { buscarTrechosSimilares } from "@/lib/repositorios/documento";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  INSTRUCAO_SISTEMA,
  RESPOSTA_SEM_CONTEXTO,
  admitiuNaoSaber,
  citaAlgumaFonte,
  montarPrompt,
} from "./prompt";
import {
  filtrarRelevantes,
  limiarDoProvedor,
  removerRedundantes,
  similaridadeMaxima,
  type TrechoRecuperado,
} from "./similaridade";

/** Quantos trechos são recuperados do banco antes da filtragem. */
export const K_RECUPERACAO = 8;
/** Quantos trechos, no máximo, entram no contexto enviado ao modelo. */
export const K_CONTEXTO = 4;

export type FonteCitada = {
  titulo: string;
  referencia: string | null;
  similaridade: number;
  trecho: string;
};

export type RespostaRag = {
  resposta: string;
  fontes: FonteCitada[];
  origemIa: OrigemResposta;
  similaridadeMaxima: number;
  admitiuNaoSaber: boolean;
  /** Falso quando o modelo respondeu sem apontar documento algum. A interface avisa. */
  respostaFundamentada: boolean;
  duracaoMs: number;
  motivoFallback?: string;
};

export type OpcoesConsulta = {
  disciplinaId: string;
  pergunta: string;
  alunoId?: string;
  /** Desliga a gravação em consultas_rag. Usado pelos scripts de avaliação. */
  registrar?: boolean;
  limiar?: number;
};

function paraFonte(t: TrechoRecuperado): FonteCitada {
  return {
    titulo: t.titulo,
    referencia: t.referencia,
    similaridade: t.similaridade,
    // Prévia curta: a tela mostra de onde veio a informação, não o documento inteiro.
    trecho: t.texto.length > 400 ? `${t.texto.slice(0, 400).trimEnd()}…` : t.texto,
  };
}

export async function responder(opcoes: OpcoesConsulta): Promise<RespostaRag> {
  const inicio = Date.now();

  // 1. Vetor da pergunta.
  const embedding = await gerarEmbeddingComFallback(opcoes.pergunta);

  // O limiar depende do provedor que gerou o vetor: os dois espaços têm
  // geometrias diferentes e um número só desligaria o assistente num deles.
  const limiar = opcoes.limiar ?? limiarDoProvedor(embedding.origem);

  // 2. Busca vetorial, restrita à disciplina e ao mesmo espaço de embedding.
  const candidatos = await buscarTrechosSimilares(
    opcoes.disciplinaId,
    embedding.valor,
    embedding.origem,
    K_RECUPERACAO
  );

  const maxSimilaridade = similaridadeMaxima(candidatos);

  // 3 e 4. Filtro de relevância e recusa honesta.
  const relevantes = filtrarRelevantes(candidatos, limiar);
  if (relevantes.length === 0) {
    const resultado: RespostaRag = {
      resposta: RESPOSTA_SEM_CONTEXTO,
      fontes: [],
      origemIa: embedding.origem,
      similaridadeMaxima: maxSimilaridade,
      admitiuNaoSaber: true,
      respostaFundamentada: true,
      duracaoMs: Date.now() - inicio,
      ...(embedding.motivoFallback ? { motivoFallback: embedding.motivoFallback } : {}),
    };
    if (opcoes.registrar !== false) await gravarConsulta(opcoes, resultado);
    return resultado;
  }

  // 5. Contexto enxuto.
  const contexto = removerRedundantes(relevantes).slice(0, K_CONTEXTO);
  const prompt = montarPrompt(opcoes.pergunta, contexto);

  // 6. Geração, com degradação para o modo extrativo.
  const geracao = await gerarTextoComFallback(prompt, {
    sistema: INSTRUCAO_SISTEMA,
    maxTokens: 700,
    temperatura: 0.15,
  });

  // 7. Verificação posterior da citação.
  const fundamentada = geracao.origem === "local" || citaAlgumaFonte(geracao.valor, contexto);
  if (!fundamentada) {
    logger.warn("Resposta do RAG sem citação de fonte", {
      disciplinaId: opcoes.disciplinaId,
      similaridadeMaxima: maxSimilaridade,
    });
  }

  const resultado: RespostaRag = {
    resposta: geracao.valor,
    fontes: contexto.map(paraFonte),
    origemIa: geracao.origem,
    similaridadeMaxima: maxSimilaridade,
    admitiuNaoSaber: admitiuNaoSaber(geracao.valor),
    respostaFundamentada: fundamentada,
    duracaoMs: Date.now() - inicio,
    ...(geracao.motivoFallback ? { motivoFallback: geracao.motivoFallback } : {}),
  };

  if (opcoes.registrar !== false) await gravarConsulta(opcoes, resultado);
  return resultado;
}

/**
 * Registra a consulta. Falha aqui não derruba a resposta: o aluno já tem o que
 * pediu, e perder uma linha de telemetria não justifica devolver erro.
 */
async function gravarConsulta(opcoes: OpcoesConsulta, resultado: RespostaRag): Promise<void> {
  try {
    await prisma.consultaRag.create({
      data: {
        alunoId: opcoes.alunoId ?? null,
        disciplinaId: opcoes.disciplinaId,
        pergunta: opcoes.pergunta,
        resposta: resultado.resposta,
        fontes: resultado.fontes as unknown as object,
        origemIa: resultado.origemIa,
        similaridadeMaxima: resultado.similaridadeMaxima,
        admitiuNaoSaber: resultado.admitiuNaoSaber,
        duracaoMs: resultado.duracaoMs,
      },
    });
  } catch (e) {
    logger.error("Falha ao registrar consulta do RAG", { detalhe: (e as Error).message });
  }
}
