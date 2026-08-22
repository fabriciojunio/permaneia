// Consulta do RAG: da pergunta do aluno até a resposta com fontes citadas.
//
// O fluxo tem sete passos, e a ordem importa:
//
//   1. gera o vetor da pergunta
//   2. busca em dois braços DENTRO da disciplina: vizinhança vetorial e
//      casamento de termos, fundidos por posição
//   3. descarta o que não passa do limiar de relevância nem do piso de cobertura
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
import {
  buscarTrechosDoDocumento,
  buscarTrechosSimilares,
  listarTrechosDaDisciplina,
} from "@/lib/repositorios/documento";
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
import { acertosConfiaveis, buscarPorTermos } from "./lexico";
import { fundir, type OrigemRecuperacao, type TrechoFundido } from "./fusao";
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
/**
 * Recuperação mais larga para pergunta de enumeração. Com 8 candidatos, um
 * documento verboso ocupa a lista inteira e os outros nem chegam ao filtro de
 * relevância: no modo de leitura direta, "quais são os temas das aulas" trazia
 * oito trechos do contrato didático e o cronograma ficava de fora.
 */
export const K_RECUPERACAO_ABRANGENTE = 20;
/**
 * Quantos trechos, no máximo, entram no contexto enviado ao modelo.
 *
 * Subiu de quatro para seis quando o cronograma passou a ter uma aula por
 * trecho: "quando vai ser a prova" tem quatro respostas certas no calendário
 * (P1, P2, substitutiva e exame) e um contexto de quatro trechos não cabia as
 * quatro mais o que a busca trouxe junto.
 */
export const K_CONTEXTO = 6;
/**
 * Teto de trechos quando a pergunta abre o documento inteiro.
 *
 * Subiu para 45 quando os documentos passaram a ter um trecho por parágrafo: o
 * cronograma sozinho tem 21, e com o teto anterior a última aula do semestre
 * caía fora do contexto sempre que outro documento entrava na frente. A
 * resposta parecia completa e terminava em 10 de dezembro.
 */
export const K_DOCUMENTO_INTEIRO = 45;

export type FonteCitada = {
  titulo: string;
  referencia: string | null;
  similaridade: number;
  trecho: string;
  /** Por qual braço da busca o trecho chegou. A tela mostra, e a defesa explica. */
  origemRecuperacao: OrigemRecuperacao;
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
  /** Data de referência da conversa. Injetada nos testes para não depender do relógio. */
  hoje?: Date;
};

function paraFonte(t: TrechoRecuperado & { origemRecuperacao?: OrigemRecuperacao }): FonteCitada {
  return {
    titulo: t.titulo,
    referencia: t.referencia,
    similaridade: t.similaridade,
    origemRecuperacao: t.origemRecuperacao ?? "vetorial",
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
  relevantes: TrechoFundido[]
): Promise<Array<TrechoRecuperado & { origemRecuperacao?: OrigemRecuperacao }>> {
  const medidas = new Map(relevantes.map((t) => [t.chunkId, t.similaridade]));
  const origens = new Map(relevantes.map((t) => [t.chunkId, t.origemRecuperacao]));

  // Ordem dos documentos: pela melhor similaridade medida em cada um.
  //
  // Duas alternativas foram testadas e descartadas. Ordenar pela posição do
  // trecho campeão deixava o cronograma para trás por centésimos numa pergunta
  // de enumeração. Ordenar pelo NÚMERO de trechos relevantes foi pior: um
  // documento longo e genericamente parecido com a pergunta, como a lista de
  // materiais, casa com nove trechos e passa à frente do cronograma, que casa
  // com dois porque a pergunta não repete o texto de cada aula. A similaridade
  // do melhor trecho é o sinal que resistiu aos dois casos.
  const melhorSimilaridade = new Map<string, number>();
  const melhorPosicao = new Map<string, number>();
  relevantes.forEach((t, posicao) => {
    const atual = melhorSimilaridade.get(t.documentoId) ?? -1;
    if (t.similaridade > atual) melhorSimilaridade.set(t.documentoId, t.similaridade);
    if (!melhorPosicao.has(t.documentoId)) melhorPosicao.set(t.documentoId, posicao);
  });

  const ordemDosDocumentos = [...melhorSimilaridade.keys()].sort((a, b) => {
    const diferenca = melhorSimilaridade.get(b)! - melhorSimilaridade.get(a)!;
    if (diferenca !== 0) return diferenca;
    return melhorPosicao.get(a)! - melhorPosicao.get(b)!;
  });

  const saida: Array<TrechoRecuperado & { origemRecuperacao?: OrigemRecuperacao }> = [];
  for (const documentoId of ordemDosDocumentos) {
    const restante = K_DOCUMENTO_INTEIRO - saida.length;
    if (restante <= 0) break;

    const trechos = await buscarTrechosDoDocumento(documentoId, K_DOCUMENTO_INTEIRO);

    // Documento que não cabe inteiro fica de fora, a menos que seja o primeiro.
    // Entrar pela metade é o pior dos mundos numa enumeração: a resposta sai
    // com cara de lista completa e para no meio do semestre, e quem lê não tem
    // como saber que faltou.
    if (trechos.length > restante && saida.length > 0) continue;

    for (const t of trechos.slice(0, restante)) {
      saida.push({
        ...t,
        similaridade: medidas.get(t.chunkId) ?? t.similaridade,
        ...(origens.has(t.chunkId) ? { origemRecuperacao: origens.get(t.chunkId) } : {}),
      });
    }
  }

  return saida.length > 0 ? saida : relevantes.slice(0, K_CONTEXTO);
}

/**
 * Uma fonte por documento, e só então as sobras.
 *
 * A lista de fontes é da tela, não do modelo: ela existe para o aluno conferir
 * de onde saiu a resposta. Cortar os primeiros trechos do contexto não serve a
 * isso quando a pergunta abre documentos inteiros, porque os seis primeiros
 * trechos costumam ser todos do mesmo documento, e a resposta que ele está lendo
 * cita outro. Mostrar um representante de cada documento diz a verdade sobre o
 * que foi consultado.
 */
function fontesRepresentativas(
  contexto: Array<TrechoRecuperado & { origemRecuperacao?: OrigemRecuperacao }>,
  maximo: number
): FonteCitada[] {
  const vistos = new Set<string>();
  const escolhidos: Array<TrechoRecuperado & { origemRecuperacao?: OrigemRecuperacao }> = [];

  for (const trecho of contexto) {
    if (vistos.has(trecho.documentoId)) continue;
    vistos.add(trecho.documentoId);
    escolhidos.push(trecho);
    if (escolhidos.length >= maximo) break;
  }

  // Sobrou espaço: completa com os melhores trechos ainda não escolhidos.
  if (escolhidos.length < maximo) {
    for (const trecho of contexto) {
      if (escolhidos.includes(trecho)) continue;
      escolhidos.push(trecho);
      if (escolhidos.length >= maximo) break;
    }
  }

  return escolhidos.map(paraFonte);
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

  // A classe da pergunta é decidida antes da busca: ela muda a largura da
  // recuperação, e não só o corte do contexto.
  const abrangente = perguntaAbrangente(opcoes.pergunta);

  // 1. Vetor da pergunta.
  const embedding = await gerarEmbeddingComFallback(opcoes.pergunta);

  // O limiar depende do provedor que gerou o vetor: os dois espaços têm
  // geometrias diferentes e um número só desligaria o assistente num deles.
  const limiar = opcoes.limiar ?? limiarDoProvedor(embedding.origem);

  // 2. Recuperação em dois braços.
  //
  // O vetorial acha o que é PARECIDO com a pergunta; o léxico acha o que
  // CONTÉM as palavras dela. Os dois erram, e erram de formas diferentes: o
  // primeiro perde o termo decisivo de uma pergunta curta, o segundo perde a
  // paráfrase. Rodar os dois e fundir por posição cobre a falha de cada um, e
  // mantém o assistente de pé quando o provedor externo cai e os vetores da
  // pergunta deixam de conversar com os do índice.
  const k = abrangente ? K_RECUPERACAO_ABRANGENTE : K_RECUPERACAO;

  const [candidatos, catalogo] = await Promise.all([
    buscarTrechosSimilares(opcoes.disciplinaId, embedding.valor, embedding.origem, k),
    listarTrechosDaDisciplina(opcoes.disciplinaId),
  ]);

  const maxSimilaridade = similaridadeMaxima(candidatos);

  // 3 e 4. Filtro de relevância e recusa honesta.
  //
  // Cada braço tem seu próprio critério de corte, e nenhum deles é opcional: é
  // o par deles que impede o assistente de responder com material que não fala
  // do assunto perguntado.
  const vetoriais = filtrarRelevantes(candidatos, limiar);

  const medidos = new Map(candidatos.map((c) => [c.chunkId, c.similaridade]));
  const porChunk = new Map(catalogo.map((t) => [t.chunkId, t]));
  const lexicos = acertosConfiaveis(buscarPorTermos(opcoes.pergunta, catalogo))
    .slice(0, k)
    .map((acerto) => {
      const trecho = porChunk.get(acerto.chunkId)!;
      // Preserva a similaridade medida quando a busca vetorial também viu o
      // trecho, ainda que abaixo do limiar: é o número que a tela mostra.
      return { ...trecho, similaridade: medidos.get(acerto.chunkId) ?? trecho.similaridade };
    });

  const relevantes = fundir({ vetoriais, lexicos, maximo: k });
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
  const contexto = abrangente
    ? await documentosRelevantesInteiros(relevantes)
    : removerRedundantes(relevantes).slice(0, K_CONTEXTO);

  const prompt = montarPrompt(opcoes.pergunta, contexto, opcoes.hoje);

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
    fontes: fontesRepresentativas(contexto, K_CONTEXTO),
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
