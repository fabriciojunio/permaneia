// Formatação para exibição. Português do Brasil em tudo que o usuário lê.

const LOCALE = "pt-BR";

/** Score de 0 a 1 como percentual inteiro. "0,72" na tela vira "72%". */
export function formatarScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return "—";
  return `${Math.round(score * 100)}%`;
}

export function formatarPercentual(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  return `${valor.toLocaleString(LOCALE, { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function formatarNota(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  return valor.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatarNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  return valor.toLocaleString(LOCALE);
}

/** Data e hora no fuso de São Paulo, que é o fuso da instituição. */
export function formatarDataHora(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString(LOCALE, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarData(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleDateString(LOCALE, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Primeiro nome, para saudação. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** Iniciais para o avatar da lista. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

/** Corta o texto sem quebrar palavra ao meio, para a prévia da citação. */
export function resumir(texto: string, maximo = 220): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= maximo) return limpo;
  const cortado = limpo.slice(0, maximo);
  const ultimoEspaco = cortado.lastIndexOf(" ");
  return `${(ultimoEspaco > maximo * 0.6 ? cortado.slice(0, ultimoEspaco) : cortado).trimEnd()}…`;
}

/**
 * Nome legível do papel.
 *
 * O banco guarda o valor sem acento, porque é um enum do Postgres; a interface
 * é lida por pessoas e mostra "Coordenação".
 */
export const ROTULO_PAPEL: Record<string, string> = {
  aluno: "Aluno",
  coordenacao: "Coordenação",
  admin: "Administração",
};

export function rotuloPapel(papel: string): string {
  return ROTULO_PAPEL[papel] ?? papel;
}

/** Plural simples, para contagens na interface. */
export function pluralizar(quantidade: number, singular: string, plural: string): string {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? singular : plural}`;
}
