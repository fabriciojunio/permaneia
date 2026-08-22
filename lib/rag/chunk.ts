// O tamanho do trecho é o parâmetro que mais afeta a qualidade do RAG: grande
// demais dilui o assunto e a busca deixa de discriminar, pequeno demais corta a
// informação ao meio. A sobreposição existe para o segundo caso, garantindo que
// o que atravessa a fronteira apareça inteiro em um dos dois trechos.

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

/** O parser de PDF devolve quebra no meio de frase e espaço duplicado. */
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

/** Parágrafo, depois frase, e só então corte bruto. */
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
    // Sem esta guarda o laço nunca avançaria.
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

  // Último trecho curto costuma ser sobra de rodapé e só produziria ruído.
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

/**
 * Prefere começar depois de um fim de frase, caindo para fronteira de palavra.
 * O trecho é mostrado literalmente como citação, e começar em "de 2026,
 * quinta-feira" parece erro do sistema mesmo sendo recorte correto.
 */
export function recortarCauda(texto: string, n: number): string {
  if (n <= 0 || texto.length === 0) return "";
  if (texto.length <= n) return texto;

  const bruto = texto.slice(texto.length - n);

  const fimDeFrase = bruto.search(/[.!?]\s+\S/);
  if (fimDeFrase !== -1) {
    const depois = bruto.slice(fimDeFrase + 1).replace(/^\s+/, "");
    // Só vale se sobrar conteúdo suficiente para dar contexto.
    if (depois.length >= n * 0.4) return depois;
  }

  const espaco = bruto.indexOf(" ");
  return espaco === -1 ? bruto : bruto.slice(espaco + 1);
}

/**
 * Divisão por unidade de informação, para documento que é lista de fatos.
 *
 * Existe por um defeito real, e não por gosto de configuração. O cronograma tem
 * uma aula por parágrafo, no formato "24 de setembro de 2026, quinta-feira.
 * Avaliação. Prova P1.". A divisão por tamanho empacotava duas aulas por trecho
 * e, pior, começava o trecho seguinte no meio de uma entrada por causa da
 * sobreposição: o trecho abria em "Aula normal. Finalização das médias." e a
 * data dessa aula tinha ficado no trecho anterior. Quem lesse aquele trecho
 * sozinho, modelo ou aluno, casava o tema com a data errada.
 *
 * Aqui cada parágrafo vira um trecho, sem sobreposição, e cada trecho carrega o
 * título do documento e a seção em que está. O custo é ter mais vetores; o
 * ganho é que todo trecho responde sozinho, que é o que a busca precisa.
 */
/**
 * Piso de tamanho da unidade, bem abaixo do usado na divisão por tamanho.
 *
 * Uma linha do cronograma como "10 de setembro de 2026, quinta-feira. Aula
 * normal. Tira-dúvidas pontuais." tem 72 caracteres e é uma unidade completa de
 * informação. Com o piso de 80 ela era colada na aula seguinte, e duas aulas
 * voltavam a dividir o mesmo vetor.
 */
export const MINIMO_UNIDADE = 45;

export function dividirPorUnidade(bruto: string, maximo = 1200, minimo = MINIMO_UNIDADE): Trecho[] {
  const texto = limparTexto(bruto);
  if (texto.length === 0) return [];

  const blocos = texto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  let titulo = "";
  let secao = "";
  const partes: string[] = [];
  // Acumula parágrafo curto demais para valer sozinho: linhas de metadado como
  // "Professor: Fulano" não são unidade de informação, são cabeçalho da que vem.
  let pendente = "";

  const contexto = (): string => [titulo, secao].filter(Boolean).join(" — ");

  const emitir = (corpo: string): void => {
    const prefixo = contexto();
    for (const parte of partirSeGrande(corpo, maximo)) {
      partes.push(prefixo ? `${prefixo}\n${parte}` : parte);
    }
  };

  for (const bloco of blocos) {
    const cabecalho = bloco.match(/^(#{1,6})\s+(.+)$/);
    if (cabecalho) {
      if (pendente) {
        emitir(pendente);
        pendente = "";
      }
      const nivel = cabecalho[1]!.length;
      const rotulo = cabecalho[2]!.trim();
      if (nivel === 1) {
        titulo = rotulo;
        secao = "";
      } else {
        secao = rotulo;
      }
      continue;
    }

    const junto = pendente ? `${pendente} ${bloco}` : bloco;
    if (junto.length < minimo) {
      pendente = junto;
      continue;
    }
    emitir(junto);
    pendente = "";
  }

  if (pendente) emitir(pendente);

  return partes.map((texto, indice) => ({ indice, texto: texto.trim() })).filter((t) => t.texto.length > 0);
}

/** Parágrafo maior que o teto cai por fronteira de frase, nunca no meio dela. */
function partirSeGrande(paragrafo: string, maximo: number): string[] {
  if (paragrafo.length <= maximo) return [paragrafo];

  const frases = paragrafo.split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean);
  const saida: string[] = [];
  let atual = "";

  for (const frase of frases) {
    const candidato = atual ? `${atual} ${frase}` : frase;
    if (candidato.length <= maximo) {
      atual = candidato;
      continue;
    }
    if (atual) saida.push(atual);
    atual = frase.length <= maximo ? frase : frase.slice(0, maximo);
  }
  if (atual) saida.push(atual);

  return saida;
}
