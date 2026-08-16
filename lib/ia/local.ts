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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palavras sem valor discriminante.
 *
 * A lista tem duas partes, e a segunda é a que importa aqui. Além dos artigos e
 * preposições de sempre, ela remove os INTERROGATIVOS: "quando", "qual",
 * "quanto", "como", "onde", "quem". Praticamente toda pergunta feita ao
 * assistente começa por um deles, e nenhum diz nada sobre qual trecho responde.
 *
 * Sem essa remoção o efeito é mensurável e foi observado na avaliação: uma
 * pergunta fora do material, "como faço para trancar a matrícula", pontuava
 * 0,210 apenas porque "como" aparece em quase todo trecho do enunciado do
 * projeto, ficando ACIMA de perguntas que o material realmente responde. É o
 * mesmo problema que o IDF resolve num TF-IDF clássico; aqui, sem corpus para
 * estimar frequência documental, a lista fixa cumpre o papel.
 */
const VAZIAS = new Set([
  // Artigos, preposições, conjunções e pronomes.
  "a", "as", "o", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos",
  "em", "na", "no", "nas", "nos", "por", "para", "pra", "com", "sem", "sob", "sobre",
  "e", "ou", "que", "se", "ao", "aos", "ate", "apos", "entre", "mais", "menos",
  "eu", "voce", "ele", "ela", "nos", "meu", "minha", "seu", "sua", "este", "esta",
  "esse", "essa", "isso", "aquele", "aquela", "lhe", "me", "te", "ja", "nao", "sim",

  // Interrogativos e verbos de pergunta.
  "quando", "qual", "quais", "quanto", "quanta", "quantos", "quantas", "como",
  "onde", "quem", "porque", "por que", "sera",

  // Verbos auxiliares e de ligação, que aparecem em todo texto.
  "ser", "sao", "foi", "era", "estar", "esta", "estao", "ter", "tem", "tinha",
  "haver", "ha", "fazer", "faco", "faz", "feito", "poder", "pode", "posso",
  "devo", "deve", "dever", "preciso", "precisa", "vai", "vou", "ir",
]);

export function tokenizar(texto: string): string[] {
  const normalizado = normalizarTexto(texto);
  if (!normalizado) return [];
  return normalizado.split(" ").filter((t) => t.length > 0 && !VAZIAS.has(t));
}

/**
 * Reduz a palavra ao radical aproximado, cortando as terminações mais comuns do
 * português. Não é um stemmer linguístico, é o suficiente para "avaliações" e
 * "avaliação" caírem no mesmo token.
 *
 * Substituiu uma versão anterior que indexava trigramas de caracteres. Os
 * trigramas davam a mesma tolerância a flexão, mas multiplicavam por cinco o
 * número de unidades e, em 768 dimensões, a colisão resultante afogava o sinal:
 * na avaliação, perguntas que o material respondia pontuavam MENOS que
 * perguntas fora do material. Radical curto resolve o mesmo problema sem
 * inundar o vetor.
 */
export function radical(palavra: string): string {
  if (palavra.length <= 3) return palavra;

  // Advérbio em "-mente" antes de tudo: "oralmente" vira "oral".
  if (palavra.length > 6 && palavra.endsWith("mente")) return palavra.slice(0, -5);

  // Plurais irregulares do português, na ordem em que precisam ser testados:
  // "avaliacoes" tem que virar "avaliacao" antes de a regra genérica do "s"
  // pegá-lo e devolver "avaliacoe".
  if (palavra.length > 4) {
    if (palavra.endsWith("oes") || palavra.endsWith("aes")) return `${palavra.slice(0, -3)}ao`;
    if (palavra.endsWith("ais")) return `${palavra.slice(0, -3)}al`;
    if (palavra.endsWith("eis")) return `${palavra.slice(0, -3)}el`;
    if (palavra.endsWith("ois")) return `${palavra.slice(0, -3)}ol`;
  }
  if (palavra.length > 3 && palavra.endsWith("ns")) return `${palavra.slice(0, -2)}m`;

  // Plural regular.
  if (palavra.length > 4 && palavra.endsWith("s")) return palavra.slice(0, -1);

  return palavra;
}

/**
 * Unidades indexadas de um texto: a palavra, o radical dela e o par de palavras
 * vizinhas. O bigrama é o que distingue "prova p1" de uma menção solta a
 * "prova", que é justamente o tipo de pergunta que o assistente mais recebe.
 */
export function unidades(texto: string): string[] {
  const tokens = tokenizar(texto);
  const saida: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const atual = tokens[i]!;
    saida.push(`p:${atual}`);

    // O radical é emitido SEMPRE, inclusive quando é igual à palavra. Emitir só
    // quando difere parecia economia, e quebrava justamente o caso que o
    // radical existe para resolver: "prova" produziria apenas `p:prova` e
    // "provas" apenas `p:provas` mais `r:prova`, sem nenhuma unidade em comum
    // entre as duas formas.
    saida.push(`r:${radical(atual)}`);

    const proximo = tokens[i + 1];
    if (proximo) saida.push(`b:${radical(atual)}_${radical(proximo)}`);
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
  // O radical vale menos que a palavra inteira: ele existe para tolerar flexão,
  // e não para empatar com a correspondência exata.
  for (const [unidade, vezes] of contagem) {
    const indice = hash32(unidade) % DIMENSAO_EMBEDDING;
    const sinal = hash32(`sinal:${unidade}`) % 2 === 0 ? 1 : -1;
    const peso = unidade.startsWith("r:") ? 0.5 : 1;
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

export const SEM_RESPOSTA_LOCAL =
  "Não encontrei essa informação no material desta disciplina. Vale confirmar diretamente com o professor ou com a coordenação.";

/**
 * Resposta extrativa: devolve, literalmente, os trechos recuperados que mais se
 * aproximam da pergunta.
 *
 * Devolve o TRECHO INTEIRO, e não as frases que casam com a pergunta. Uma
 * versão anterior selecionava frase a frase e falhava de um jeito instrutivo:
 * para "quando é a Prova P1", o cronograma quebra em duas frases separadas,
 * "24 de setembro de 2026, quinta-feira" e "Avaliação. Prova P1". A seleção por
 * sobreposição de termos escolhia a segunda, que casa com a pergunta, e
 * descartava a primeira, que tem a resposta. O aluno recebia a confirmação de
 * que a prova existe, sem a data.
 *
 * A lição vale além deste código: recortar abaixo da unidade em que a
 * informação foi escrita quebra a informação. O trecho já é a unidade
 * escolhida na ingestão, e é nela que a resposta está inteira.
 *
 * O prompt que chega aqui vem montado pela camada de RAG, com o contexto
 * delimitado por marcadores. Lemos o contexto desses marcadores em vez de mudar
 * a interface, para que o mesmo prompt sirva aos dois provedores.
 */
export function responderExtrativo(prompt: string): string {
  const contexto = prompt.match(/<contexto>([\s\S]*?)<\/contexto>/)?.[1]?.trim() ?? "";
  const pergunta = prompt.match(/<pergunta>([\s\S]*?)<\/pergunta>/)?.[1]?.trim() ?? "";

  if (!contexto) return SEM_RESPOSTA_LOCAL;

  // A camada de RAG separa os trechos por uma linha de três hifens.
  const blocos = contexto
    .split(/\n\s*---\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocos.length === 0) return SEM_RESPOSTA_LOCAL;

  const termosPergunta = new Set(tokenizar(pergunta));
  const pontuados = blocos.map((bloco) => {
    const termosBloco = new Set(tokenizar(bloco));
    let acertos = 0;
    for (const t of termosPergunta) if (termosBloco.has(t)) acertos += 1;
    return { bloco, acertos };
  });

  // A ordem em que os blocos chegaram já é a da similaridade vetorial. A
  // contagem de termos exatos serve de desempate, sem reordenar tudo: ela não
  // tem visão semântica nenhuma e não deve sobrepor a busca vetorial.
  const escolhidos = pontuados.some((p) => p.acertos > 0)
    ? pontuados.filter((p) => p.acertos > 0).slice(0, 2)
    : pontuados.slice(0, 1);

  return [
    "Leitura direta do material, sem geração de texto. Copio abaixo os trechos do documento que respondem à sua pergunta:",
    ...escolhidos.map((p) => p.bloco),
  ].join("\n\n");
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
