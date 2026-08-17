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
import { buscarTrechosDoDocumento, buscarTrechosSimilares } from "@/lib/repositorios/documento";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  INSTRUCAO_SISTEMA,
  RESPOSTA_SEM_CONTEXTO,
  admitiuNaoSaber,
  citaAlgumaFonte,
  montarPrompt,
} from "./prompt";
import { avaliarPergunta, type CategoriaBloqueio } from "./guardrails";
import { perguntaAbrangente } from "./abrangencia";
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
/** Teto de trechos quando a pergunta abre o documento inteiro. */
export const K_DOCUMENTO_INTEIRO = 30;

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
  /** Preenchido quando a pergunta foi barrada antes de chegar ao provedor. */
  bloqueada?: CategoriaBloqueio;
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

/**
 * Abre inteiros, e em ordem, todos os documentos que contribuíram algum trecho
 * relevante.
 *
 * Abrir só o documento do trecho campeão seria mais barato e é o que a primeira
 * versão fazia, mas amarra a resposta a uma decisão que a busca não é confiável
 * o bastante para tomar: numa pergunta de enumeração o campeão frequentemente é
 * um quase-acerto de outro documento, e o cronograma inteiro ficava de fora por
 * centésimos de similaridade. Os documentos entram na ordem do melhor trecho de
 * cada um, e a similaridade medida é preservada nos trechos que a busca de fato
 * pontuou, porque é ela que a tela mostra e o registro guarda.
 */
async function documentosRelevantesInteiros(
  relevantes: TrechoRecuperado[]
): Promise<TrechoRecuperado[]> {
  const medidas = new Map(relevantes.map((t) => [t.chunkId, t.similaridade]));

  const ordemDosDocumentos: string[] = [];
  for (const t of relevantes) {
    if (!ordemDosDocumentos.includes(t.documentoId)) ordemDosDocumentos.push(t.documentoId);
  }

  const saida: TrechoRecuperado[] = [];
  for (const documentoId of ordemDosDocumentos) {
    if (saida.length >= K_DOCUMENTO_INTEIRO) break;

    const trechos = await buscarTrechosDoDocumento(
      documentoId,
      K_DOCUMENTO_INTEIRO - saida.length
    );
    for (const t of trechos) {
      saida.push({ ...t, similaridade: medidas.get(t.chunkId) ?? t.similaridade });
    }
  }

  return saida.length > 0 ? saida : relevantes.slice(0, K_CONTEXTO);
}

export async function responder(opcoes: OpcoesConsulta): Promise<RespostaRag> {
  const inicio = Date.now();

  // 0. Barreiras de entrada, antes de qualquer chamada externa.
  //
  // Vem primeiro de propósito: uma tentativa de injeção de prompt ou um pedido
  // ilícito não deve consumir cota do provedor, não deve entrar no índice de
  // consultas como se fosse dúvida legítima, e não deve receber a resposta
  // educada de "não encontrei no material", que soa como se a pergunta fosse
  // aceitável e só faltasse o documento.
  const veredicto = avaliarPergunta(opcoes.pergunta);
  if (!veredicto.permitida) {
    logger.warn("Pergunta bloqueada pelas barreiras de entrada", {
      categoria: veredicto.categoria,
      disciplinaId: opcoes.disciplinaId,
    });
    return {
      resposta: veredicto.mensagem!,
      fontes: [],
      origemIa: "local",
      similaridadeMaxima: 0,
      admitiuNaoSaber: true,
      respostaFundamentada: true,
      bloqueada: veredicto.categoria,
      duracaoMs: Date.now() - inicio,
    };
  }

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

  // 5. Contexto.
  //
  // Pergunta pontual leva os trechos mais próximos. Pergunta de enumeração leva
  // o documento que melhor casou, inteiro e em ordem, porque a resposta certa
  // para "qual é o conteúdo das aulas" é a lista toda e não a aula que ficou em
  // primeiro no ranking.
  const abrangente = perguntaAbrangente(opcoes.pergunta);
  const contexto = abrangente
    ? await documentosRelevantesInteiros(relevantes)
    : removerRedundantes(relevantes).slice(0, K_CONTEXTO);

  const prompt = montarPrompt(opcoes.pergunta, contexto);

  // 6. Geração, com degradação para o modo extrativo.
  const geracao = await gerarTextoComFallback(prompt, {
    sistema: INSTRUCAO_SISTEMA,
    // Teto largo porque os modelos atuais gastam tokens de raciocínio dentro
    // deste mesmo limite. Ver o comentário em lib/ia/gemini.ts. A pergunta
    // abrangente pede mais espaço porque a resposta certa é uma lista com uma
    // linha por aula, e cortar no meio devolveria um cronograma incompleto.
    maxTokens: abrangente ? 3000 : 1500,
    temperatura: 0.15,
  });

  // 7. Verificação posterior, e substituição quando ela falha.
  //
  // O modo local transcreve o documento, então é fundamentado por construção.
  // Para o modo generativo, exigimos que a resposta ou cite um dos documentos
  // fornecidos, ou admita não saber. Uma resposta que não faz nenhum dos dois
  // é texto solto: pode ser o modelo divagando, pode ser efeito de uma
  // instrução embutida no material. Em qualquer caso ela não tem apoio, e
  // apresentá-la ao aluno como se tivesse seria o pior desfecho do sistema.
  const admitiu = admitiuNaoSaber(geracao.valor);
  const fundamentada = geracao.origem === "local" || admitiu || citaAlgumaFonte(geracao.valor, contexto);

  let textoFinal = geracao.valor;
  if (!fundamentada) {
    logger.warn("Resposta do RAG descartada por não se apoiar no contexto", {
      disciplinaId: opcoes.disciplinaId,
      similaridadeMaxima: maxSimilaridade,
      origemIa: geracao.origem,
    });
    textoFinal = RESPOSTA_SEM_CONTEXTO;
  }

  const resultado: RespostaRag = {
    resposta: textoFinal,
    // A lista de fontes é da tela, não do modelo: trinta trechos do mesmo
    // documento não ajudam o aluno a conferir nada.
    fontes: contexto.slice(0, K_CONTEXTO).map(paraFonte),
    origemIa: geracao.origem,
    similaridadeMaxima: maxSimilaridade,
    // Reflete o texto EFETIVAMENTE devolvido, e não o que o modelo produziu:
    // quando a resposta é descartada, o que o aluno lê é uma admissão.
    admitiuNaoSaber: admitiuNaoSaber(textoFinal),
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
