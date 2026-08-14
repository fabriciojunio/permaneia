// Log estruturado em JSON, uma linha por evento.
//
// JSON e não texto livre porque o destino é a saída de log da Vercel, onde
// filtrar por campo só funciona se o campo existir. A saída passa por
// console.error inclusive para os níveis mais baixos: é o único console que
// sobrevive ao `removeConsole` do build de produção (ver next.config.mjs).

export type NivelLog = "debug" | "info" | "warn" | "error";

const ORDEM: Record<NivelLog, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function nivelMinimo(): number {
  const configurado = (process.env.LOG_NIVEL as NivelLog | undefined) ?? undefined;
  if (configurado && configurado in ORDEM) return ORDEM[configurado];
  if (process.env.NODE_ENV === "test") return ORDEM.error;
  return process.env.NODE_ENV === "production" ? ORDEM.info : ORDEM.debug;
}

/** Campos que nunca podem chegar ao log, mesmo que alguém os passe por engano. */
const PROIBIDOS = new Set([
  "senha",
  "senhahash",
  "password",
  "token",
  "authorization",
  "cookie",
  "gemini_api_key",
  "apikey",
  "session_secret",
  "database_url",
]);

/**
 * Remove campos sensíveis em qualquer profundidade. Vale a pena mesmo com
 * disciplina de código: o vazamento típico não vem de alguém logar a senha de
 * propósito, e sim de logar um objeto inteiro que por acaso a contém.
 */
export function limparContexto(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 6) return "[profundo demais]";
  if (valor === null || valor === undefined) return valor;
  if (valor instanceof Error) return { nome: valor.name, mensagem: valor.message };
  if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => limparContexto(v, profundidade + 1));
  if (typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = PROIBIDOS.has(chave.toLowerCase()) ? "[oculto]" : limparContexto(v, profundidade + 1);
    }
    return saida;
  }
  return valor;
}

function emitir(nivel: NivelLog, mensagem: string, contexto?: Record<string, unknown>): void {
  if (ORDEM[nivel] < nivelMinimo()) return;
  const linha = {
    nivel,
    mensagem,
    momento: new Date().toISOString(),
    ...(contexto ? { contexto: limparContexto(contexto) } : {}),
  };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(linha));
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => emitir("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => emitir("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emitir("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => emitir("error", m, c),
};
