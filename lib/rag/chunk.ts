// Divisão de documentos em trechos indexáveis.
//
// O tamanho do trecho é o parâmetro que mais afeta a qualidade do RAG e quase
// nunca é explicado. Trecho grande demais dilui o assunto e a busca por
// similaridade deixa de discriminar; trecho pequeno demais corta a informação
// ao meio, e a resposta "quando é a Prova P1" recupera o trecho que diz "Prova
// P1" sem a data que estava na linha seguinte.
//
// A sobreposição existe justamente por causa desse segundo caso: repetir o fim
// de um trecho no começo do próximo garante que uma informação que atravessa a
// fronteira apareça inteira em pelo menos um dos dois.

/** Alvo de tamanho do trecho, em caracteres. Cerca de 500 tokens em português. */
export const TAMANHO_ALVO = 2000;
/** Sobreposição entre trechos vizinhos, em caracteres. */
export const SOBREPOSICAO = 200;
/** Abaixo disto o trecho não carrega informação suficiente para ser indexado sozinho. */
export const TAMANHO_MINIMO = 80;

export type Trecho = {
  indice: number;
  texto: string;
};

/**
 * Normaliza o texto extraído de PDF: o parser devolve quebras de linha no meio
 * de frases, espaços duplicados e linhas em branco em excesso. Sem essa
 * limpeza, o trecho fica cheio de ruído que atrapalha tanto o embedding quanto
 * a leitura da citação na tela.
 */
export function limparTexto(bruto: string): string {
  return bruto
    .replace(/\r\n?/g, "\n")
    // Hifenização de fim de linha, comum em PDF: "avalia-\nção" vira "avaliação".
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2")
    // Quebra simples dentro de um parágrafo vira espaço; quebra dupla é separador real.
    .replace(/([^\n])\n(?!\n)/g, "$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .split("\n")
    .map((linha) => linha.trim())
    .join("\n")
    .trim();
}

/**
 * Quebra o texto em unidades que não devem ser cortadas ao meio: primeiro por
 * parágrafo, e um parágrafo grande demais por frase. Só se uma frase sozinha
 * ultrapassar o alvo é que ela é cortada na força bruta.
 */
export function unidadesAtomicas(texto: string, alvo = TAMANHO_ALVO): string[] {
  const paragrafos = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const saida: string[] = [];

  for (const paragrafo of paragrafos) {
    if (paragrafo.length <= alvo) {
      saida.push(paragrafo);
      continue;
    }
    // Divide por fim de frase, mantendo o pontuador na frase que termina.
    const frases = paragrafo.split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean);
    for (const frase of frases) {
      if (frase.length <= alvo) {
        saida.push(frase);
        continue;
      }
      for (let i = 0; i < frase.length; i += alvo) {
        saida.push(frase.slice(i, i + alvo));
      }
    }
  }

  return saida;
}

/**
 * Divide o texto em trechos de aproximadamente `alvo` caracteres, respeitando
 * fronteiras de parágrafo e frase, com `sobreposicao` caracteres repetidos
 * entre trechos vizinhos.
 */
export function dividirEmTrechos(
  bruto: string,
  alvo = TAMANHO_ALVO,
  sobreposicao = SOBREPOSICAO
): Trecho[] {
  if (alvo <= 0) throw new Error("O tamanho alvo do trecho deve ser maior que zero.");
  if (sobreposicao < 0) throw new Error("A sobreposição não pode ser negativa.");
  if (sobreposicao >= alvo) {
    // Sem esta guarda, a sobreposição consumiria o trecho inteiro e o laço
    // nunca avançaria.
    throw new Error("A sobreposição precisa ser menor que o tamanho alvo do trecho.");
  }

  const texto = limparTexto(bruto);
  if (texto.length === 0) return [];

  const unidades = unidadesAtomicas(texto, alvo);
  const trechos: string[] = [];
  let atual = "";

  for (const unidade of unidades) {
    const candidato = atual.length === 0 ? unidade : `${atual}\n\n${unidade}`;
    if (candidato.length <= alvo) {
      atual = candidato;
      continue;
    }
    if (atual.length > 0) trechos.push(atual);
    // Recomeça o trecho carregando a cauda do anterior, que é a sobreposição.
    const cauda = sobreposicao > 0 ? recortarCauda(atual, sobreposicao) : "";
    atual = cauda.length > 0 ? `${cauda}\n\n${unidade}` : unidade;
  }

  if (atual.length > 0) trechos.push(atual);

  // Um último trecho muito curto costuma ser sobra de rodapé; junta ao anterior
  // em vez de indexar isoladamente, onde ele só produziria ruído.
  if (trechos.length > 1) {
    const ultimo = trechos[trechos.length - 1]!;
    if (ultimo.length < TAMANHO_MINIMO) {
      trechos[trechos.length - 2] = `${trechos[trechos.length - 2]!}\n\n${ultimo}`;
      trechos.pop();
    }
  }

  return trechos
    .map((texto, indice) => ({ indice, texto: texto.trim() }))
    .filter((t) => t.texto.length > 0);
}

/** Últimos `n` caracteres do texto, começando numa fronteira de palavra para não cortar termo ao meio. */
export function recortarCauda(texto: string, n: number): string {
  if (n <= 0 || texto.length === 0) return "";
  if (texto.length <= n) return texto;
  const bruto = texto.slice(texto.length - n);
  const espaco = bruto.indexOf(" ");
  return espaco === -1 ? bruto : bruto.slice(espaco + 1);
}
