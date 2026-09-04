// Rastro distribuído no formato do W3C.
//
// O sistema já correlacionava requisições por um x-request-id próprio, e isso
// resolve o caso de alguém relatar um erro: com o identificador na tela, a
// linha aparece no log. O que não resolve é o caso de o pedido atravessar mais
// de um processo, que é o que acontece toda vez que a página chama a API e a
// API chama o Gemini.
//
// O `traceparent` do W3C é o mesmo campo que a Vercel, o Gemini e qualquer
// coletor de telemetria entendem sem tradução no meio. Adotá-lo em vez de
// inventar outro nome é o que deixa o rastro atravessar a fronteira do
// processo no dia em que houver um coletor do outro lado.
//
// Hoje o destino é o log estruturado, e não um painel de rastros: um trecho
// aqui é uma linha com nome, duração e o par traceId/spanId. Ver
// docs/adr/010-rastro-distribuido.md, que registra por que parou nesse ponto.
//
// Este módulo é PURO de propósito: nada de async_hooks, nada de next/headers.
// O middleware roda no runtime de borda, onde importar `node:async_hooks`
// quebra o build. O contexto por requisição vive em lib/rastro-ativo.ts, que
// só é importado de dentro do runtime Node.

/** O nome do campo no W3C. Vale para cabeçalho HTTP e para atributo de fila. */
export const CAMPO_RASTRO = "traceparent";

export type Rastro = {
  /** Identifica o pedido inteiro. Sobrevive à travessia de processos. */
  readonly traceId: string;
  /** Identifica este trecho de trabalho dentro do pedido. */
  readonly spanId: string;
  /** Quem pediu, quando este trecho nasceu da continuação de outro. */
  readonly paiSpanId?: string;
  /** "01" quando o rastro deve ser gravado; "00" quando foi amostrado fora. */
  readonly flags: string;
};

const TRACE_ID_ZERO = "0".repeat(32);
const SPAN_ID_ZERO = "0".repeat(16);

// A especificação fixa o formato exato: quatro campos separados por hífen, em
// minúsculas. Aceitar maiúscula seria gentileza que quebra a comparação do
// outro lado, onde o identificador vira chave de índice.
const FORMATO = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

function hexAleatorio(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Lê o cabeçalho recebido, ou devolve nulo quando ele não serve.
 *
 * Nulo é o caso normal e não erro: navegador não manda `traceparent` sozinho, e
 * a maioria das requisições chega sem nada. Quem chama trata isso abrindo um
 * rastro novo.
 *
 * O identificador todo em zero é recusado porque a especificação o reserva para
 * "sem rastro": aceitá-lo agruparia num só balde requisições de origens
 * diferentes, que é exatamente o contrário do que o campo existe para fazer.
 */
export function analisarRastro(cabecalho: string | null | undefined): Rastro | null {
  if (!cabecalho) return null;

  const partes = FORMATO.exec(cabecalho.trim());
  if (!partes) return null;

  const versao = partes[1] ?? "";
  const traceId = partes[2] ?? "";
  const spanId = partes[3] ?? "";
  const flags = partes[4] ?? "";

  // "ff" é a única versão que a especificação declara inválida. As demais são
  // aceitas de propósito: uma versão futura mantém os quatro primeiros campos
  // no mesmo lugar, e recusá-la só desligaria o rastro sem ganho nenhum.
  if (versao === "ff") return null;
  if (traceId === TRACE_ID_ZERO || spanId === SPAN_ID_ZERO) return null;

  return { traceId, spanId, flags };
}

/**
 * Abre um trecho, continuando o rastro que chegou ou começando um do zero.
 *
 * O trecho novo é sempre filho, e nunca a continuação do mesmo identificador:
 * quem chamou e quem atendeu são trabalhos separados, com duração própria, e
 * reaproveitar o spanId apagaria a fronteira entre os dois.
 */
export function abrirRastro(paiCabecalho?: string | null): Rastro {
  const pai = analisarRastro(paiCabecalho);
  return {
    traceId: pai?.traceId ?? hexAleatorio(16),
    spanId: hexAleatorio(8),
    ...(pai ? { paiSpanId: pai.spanId } : {}),
    // Sem amostragem: o volume aqui é de trabalho de faculdade, e descartar
    // rastro para economizar só faria falta justamente no dia da falha rara.
    flags: pai?.flags ?? "01",
  };
}

/** O valor que vai no cabeçalho de saída, para quem for chamado adiante. */
export function paraCabecalho(rastro: Rastro): string {
  return `00-${rastro.traceId}-${rastro.spanId}-${rastro.flags}`;
}

/**
 * O identificador curto que aparece para o usuário e no envelope de erro.
 *
 * É o traceId, e não um UUID separado: com dois identificadores a pessoa lê um
 * na tela e o log guarda o outro, e a busca não acha nada. Um só, no formato do
 * padrão, serve para os dois lados.
 */
export function idDeCorrelacao(rastro: Rastro): string {
  return rastro.traceId;
}
