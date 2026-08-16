// Janela deslizante em memória. Em ambiente serverless cada instância tem a
// própria memória, então NÃO é um limite global exato: contém laço acidental e
// força bruta ingênua, e protege a cota do tier gratuito. Ver ADR 006.

export type Regra = {
  /** Requisições permitidas na janela. */
  limite: number;
  /** Tamanho da janela em milissegundos. */
  janelaMs: number;
};

/**
 * Configurável porque numa instituição uma sala inteira sai pelo mesmo IP: cinco
 * por minuto protegem contra adivinhação e derrubam uma turma no laboratório.
 */
function doAmbiente(variavel: string, padrao: number): number {
  const bruto = Number(process.env[variavel]);
  if (!Number.isFinite(bruto) || bruto < 1) return padrao;
  return Math.trunc(bruto);
}

/** Login: apertado, porque o alvo é adivinhação de senha. */
export const REGRA_LOGIN: Regra = {
  limite: doAmbiente("RATE_LIMIT_LOGIN", 5),
  janelaMs: 60_000,
};
/** Pergunta ao assistente: cada uma consome cota do Gemini. */
export const REGRA_RAG: Regra = { limite: 20, janelaMs: 60_000 };
/** Ingestão de documento: operação cara, feita por coordenação, e rara. */
export const REGRA_UPLOAD: Regra = { limite: 10, janelaMs: 300_000 };
/** Escrita comum na API. */
export const REGRA_ESCRITA: Regra = { limite: 60, janelaMs: 60_000 };

type Registro = { marcas: number[] };

const memoria = new Map<string, Registro>();

/** Teto de chaves, para a memória não crescer sob ataque com IPs variados. */
const MAXIMO_CHAVES = 10_000;

export type VeredictoLimite = {
  permitido: boolean;
  restantes: number;
  /** Segundos até a próxima tentativa ser aceita. Vai no header Retry-After. */
  esperarSegundos: number;
};

/** `agora` é parâmetro para o teste controlar o tempo sem relógio falso global. */
export function consumir(chave: string, regra: Regra, agora = Date.now()): VeredictoLimite {
  const inicioJanela = agora - regra.janelaMs;
  const registro = memoria.get(chave) ?? { marcas: [] };

  // Descarta o que saiu da janela antes de contar.
  const dentro = registro.marcas.filter((m) => m > inicioJanela);

  if (dentro.length >= regra.limite) {
    const maisAntiga = dentro[0]!;
    const esperar = Math.max(1, Math.ceil((maisAntiga + regra.janelaMs - agora) / 1000));
    memoria.set(chave, { marcas: dentro });
    return { permitido: false, restantes: 0, esperarSegundos: esperar };
  }

  dentro.push(agora);
  memoria.set(chave, { marcas: dentro });

  if (memoria.size > MAXIMO_CHAVES) limparExpirados(agora);

  return { permitido: true, restantes: regra.limite - dentro.length, esperarSegundos: 0 };
}

/** Remove chaves cuja marca mais recente já é antiga o bastante para não afetar nenhuma regra. */
export function limparExpirados(agora = Date.now(), horizonteMs = 600_000): number {
  let removidas = 0;
  for (const [chave, registro] of memoria) {
    const ultima = registro.marcas[registro.marcas.length - 1] ?? 0;
    if (ultima < agora - horizonteMs) {
      memoria.delete(chave);
      removidas += 1;
    }
  }
  return removidas;
}

/** Zera o estado. Existe para os testes; não use em código de produção. */
export function zerarLimites(): void {
  memoria.clear();
}

/**
 * Atrás da Vercel o x-forwarded-for é confiável porque a plataforma o reescreve.
 * Sem proxy, o cabeçalho é do cliente e confiar nele daria limite infinito a
 * quem variasse o valor. Por isso a confiança é configurável.
 */
export function identificarCliente(cabecalhos: Headers, sufixo = ""): string {
  const confia = process.env.RATE_LIMIT_CONFIA_PROXY !== "false";
  const encaminhado = confia ? cabecalhos.get("x-forwarded-for") : null;
  const ip = encaminhado?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip") || "desconhecido";
  return sufixo ? `${ip}:${sufixo}` : ip;
}
