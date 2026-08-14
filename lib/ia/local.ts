// Provedor local determinístico.
//
// Não é um modelo de linguagem: é o modo de degradação graciosa do sistema.
// Quando não há GEMINI_API_KEY, quando a cota do tier gratuito acaba no meio da
// apresentação ou quando a rede da sala cai, o PermaneIA continua respondendo,
// só que de forma EXTRATIVA: ele devolve os trechos recuperados do documento,
// citando a origem, sem redigir nada por cima.
//
// Isso é uma escolha de projeto, não uma limitação aceita a contragosto. O
// compromisso do assistente é "não inventar"; um modo que apenas transcreve o
// que está no documento honra esse compromisso de forma ainda mais estrita do
// que o modo generativo. O que se perde é fluência, não confiabilidade.
//
// O embedding usa o truque do hashing sobre n-gramas: sem tabela de vocabulário,
// sem download de modelo, sem dependência, e determinístico entre execuções e
// entre máquinas, o que é exatamente o que os testes precisam.

import {
  DIMENSAO_EMBEDDING,
  normalizarVetor,
  type OpcoesGeracao,
  type ProvedorIA,
  type RespostaGeracao,
} from "./provedor";

/** FNV-1a de 32 bits. Rápido, estável e sem dependência. */
export function hash32(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    // Multiplicação por 16777619 em aritmética de 32 bits sem estourar o double.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Reduz o texto à forma comparável: minúsculas, sem acento e sem pontuação.
 * Remover acento é deliberado; aluno digita "prova p1 e amanha" e o documento
 * traz "amanhã", e essas duas formas precisam colidir no mesmo token.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    // Faixa dos diacríticos combinantes que o NFD separa da letra base.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras sem valor discriminante em português. Mantidas curtas de propósito: lista grande demais derruba recall. */
const VAZIAS = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos",
  "em", "na", "no", "nas", "nos", "por", "para", "pra", "com", "sem", "sob", "sobre",
  "e", "ou", "que", "se", "ao", "aos",
]);

export function tokenizar(texto: string): string[] {
  const normalizado = normalizarTexto(texto);
  if (!normalizado) return [];
  return normalizado.split(" ").filter((t) => t.length > 0 && !VAZIAS.has(t));
}

/**
 * Gera as unidades indexadas de um texto: as palavras, os pares de palavras
 * vizinhas e os trigramas de caracteres de cada palavra. Os trigramas dão
 * tolerância a plural e a flexão verbal, que em português mudam o fim da
 * palavra sem mudar o sentido buscado.
 */
export function unidades(texto: string): string[] {
  const tokens = tokenizar(texto);
  const saida: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const atual = tokens[i]!;
    saida.push(`p:${atual}`);
    const proximo = tokens[i + 1];
    if (proximo) saida.push(`b:${atual}_${proximo}`);
    if (atual.length > 3) {
      for (let j = 0; j + 3 <= atual.length; j += 1) {
        saida.push(`t:${atual.slice(j, j + 3)}`);
      }
    }
  }
  return saida;
}

/**
 * Vetor esparso projetado em `DIMENSAO_EMBEDDING` posições pelo truque do
 * hashing, com sinal derivado de um segundo hash para que colisões tendam a se
 * cancelar em vez de se somar. Frequência entra em escala logarítmica, pelo
 * mesmo motivo do TF-IDF clássico: a décima ocorrência de um termo diz muito
 * menos do que a primeira.
 */
export function embeddingLocal(texto: string): number[] {
  const vetor = new Array<number>(DIMENSAO_EMBEDDING).fill(0);
  const contagem = new Map<string, number>();
  for (const u of unidades(texto)) {
    contagem.set(u, (contagem.get(u) ?? 0) + 1);
  }
  // Peso menor para trigramas: eles existem para tolerar flexão, não para
  // dominar a similaridade de uma palavra longa qualquer.
  for (const [unidade, vezes] of contagem) {
    const indice = hash32(unidade) % DIMENSAO_EMBEDDING;
    const sinal = hash32(`sinal:${unidade}`) % 2 === 0 ? 1 : -1;
    const peso = unidade.startsWith("t:") ? 0.35 : 1;
    vetor[indice] = (vetor[indice] ?? 0) + sinal * peso * (1 + Math.log(vezes));
  }
  return normalizarVetor(vetor);
}

/** Recorta o texto em frases, para a resposta extrativa citar só o que importa. */
export function frases(texto: string): string[] {
  return texto
    .split(/(?<=[.!?;:])\s+|\n+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

/**
 * Resposta extrativa: escolhe, dentro do contexto recebido, as frases com maior
 * sobreposição de termos com a pergunta, e as devolve na ordem original.
 *
 * O prompt que chega aqui já vem montado pela camada de RAG e traz o contexto
 * delimitado por marcadores. Extraímos o contexto e a pergunta desses
 * marcadores em vez de mudar a interface, para que o mesmo prompt sirva aos
 * dois provedores sem ramificação no chamador.
 */
export function responderExtrativo(prompt: string): string {
  const contexto = prompt.match(/<contexto>([\s\S]*?)<\/contexto>/)?.[1]?.trim() ?? "";
  const pergunta = prompt.match(/<pergunta>([\s\S]*?)<\/pergunta>/)?.[1]?.trim() ?? "";

  if (!contexto) {
    return "Não encontrei nada no material desta disciplina que responda a essa pergunta. Vale confirmar com o professor ou com a coordenação.";
  }

  const termosPergunta = new Set(tokenizar(pergunta));
  const candidatas = frases(contexto)
    .map((frase) => {
      const termosFrase = tokenizar(frase);
      let acertos = 0;
      for (const t of new Set(termosFrase)) {
        if (termosPergunta.has(t)) acertos += 1;
      }
      // Normaliza pelo tamanho para não premiar frase longa que só acumula termos.
      const escore = termosFrase.length === 0 ? 0 : acertos / Math.sqrt(termosFrase.length);
      return { frase, escore, acertos };
    })
    .filter((c) => c.acertos > 0)
    .sort((a, b) => b.escore - a.escore)
    .slice(0, 3);

  if (candidatas.length === 0) {
    return "Não encontrei nada no material desta disciplina que responda a essa pergunta. Vale confirmar com o professor ou com a coordenação.";
  }

  const ordemOriginal = frases(contexto);
  const selecionadas = candidatas
    .map((c) => c.frase)
    .sort((a, b) => ordemOriginal.indexOf(a) - ordemOriginal.indexOf(b));

  return [
    "Modo de leitura direta do material (sem geração de texto). Estes são os trechos do documento que respondem à sua pergunta:",
    "",
    ...selecionadas.map((f) => `• ${f}`),
  ].join("\n");
}

export class ProvedorLocal implements ProvedorIA {
  readonly nome = "local" as const;

  disponivel(): boolean {
    // O provedor local é o piso do sistema: está sempre disponível, por definição.
    return true;
  }

  async gerarTexto(prompt: string, _opcoes?: OpcoesGeracao): Promise<RespostaGeracao> {
    return { texto: responderExtrativo(prompt), origem: "local" };
  }

  async gerarEmbedding(texto: string): Promise<number[]> {
    return embeddingLocal(texto);
  }

  async gerarEmbeddings(textos: string[]): Promise<number[][]> {
    return textos.map((t) => embeddingLocal(t));
  }
}
