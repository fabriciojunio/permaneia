// Modo de degradação do sistema: sem chave de API, sem cota ou sem rede, o
// assistente continua respondendo, só que transcrevendo os trechos recuperados
// em vez de redigir. Transcrever honra o compromisso de não inventar de forma
// mais estrita que o modo generativo.
//
// O embedding usa hashing sobre n-gramas: sem vocabulário, sem dependência e
// determinístico, que é o que os testes precisam.

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

/** Aluno digita "amanha" e o documento traz "amanhã": as formas precisam colidir. */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Os interrogativos entram junto com artigos e preposições: quase toda pergunta
 * começa por um deles e nenhum diz qual trecho responde. Sem removê-los, "como
 * faço para trancar a matrícula" pontuava 0,210 e ficava acima de perguntas que
 * o material responde. Ver docs/AVALIACAO-RAG.md.
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
 * Radical aproximado, o bastante para "avaliações" e "avaliação" caírem no mesmo
 * token. Substituiu trigramas de caracteres, que davam a mesma tolerância mas
 * multiplicavam as unidades por cinco e afogavam o sinal em 768 dimensões.
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

/** Palavra, radical e bigrama. O bigrama distingue "prova p1" de "prova" solto. */
export function unidades(texto: string): string[] {
  const tokens = tokenizar(texto);
  const saida: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const atual = tokens[i]!;
    saida.push(`p:${atual}`);

    // Sempre, inclusive quando igual à palavra: senão "prova" e "provas" não
    // teriam nenhuma unidade em comum.
    saida.push(`r:${radical(atual)}`);

    const proximo = tokens[i + 1];
    if (proximo) saida.push(`b:${radical(atual)}_${radical(proximo)}`);
  }
  return saida;
}

/**
 * Vetor esparso projetado por hashing, com sinal de um segundo hash para que
 * colisões se cancelem em vez de se somar. Frequência em escala logarítmica.
 */
export function embeddingLocal(texto: string): number[] {
  const vetor = new Array<number>(DIMENSAO_EMBEDDING).fill(0);
  const contagem = new Map<string, number>();
  for (const u of unidades(texto)) {
    contagem.set(u, (contagem.get(u) ?? 0) + 1);
  }
  // Radical pesa menos: tolera flexão sem empatar com a correspondência exata.
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
 * Devolve o trecho INTEIRO, e não as frases que casam com a pergunta. Selecionar
 * frase a frase escolhia "Avaliação. Prova P1" e descartava "24 de setembro de
 * 2026", que vinha antes: o aluno recebia a confirmação de que a prova existe,
 * sem a data. Recortar abaixo da unidade de ingestão quebra a informação.
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

  // Os blocos já chegam ordenados por similaridade; a contagem de termos exatos
  // só desempata.
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

  /** Piso do sistema: disponível por definição. */
  disponivel(): boolean {
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
