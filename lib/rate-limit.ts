// Limitação de taxa por janela deslizante, em memória.
//
// Limite honesto sobre o alcance: em ambiente serverless cada instância tem a
// própria memória, então isto não é um limite global exato. Ele resolve o que
// precisa resolver neste projeto, que é conter o custo e a cota do tier
// gratuito do Gemini contra um laço acidental ou um abuso ingênuo, e frear
// tentativa de força bruta no login. Um limite global exigiria Redis, que
// custaria dinheiro e sairia do escopo de um projeto sem orçamento.
//
// Ver ADR 006.

export type Regra = {
  /** Requisições permitidas na janela. */
  limite: number;
  /** Tamanho da janela em milissegundos. */
  janelaMs: number;
};

/** Login: apertado, porque o alvo é adivinhação de senha. */
export const REGRA_LOGIN: Regra = { limite: 5, janelaMs: 60_000 };
/** Pergunta ao assistente: cada uma consome cota do Gemini. */
export const REGRA_RAG: Regra = { limite: 20, janelaMs: 60_000 };
/** Ingestão de documento: operação cara, feita por coordenação, e rara. */
export const REGRA_UPLOAD: Regra = { limite: 10, janelaMs: 300_000 };
/** Escrita comum na API. */
export const REGRA_ESCRITA: Regra = { limite: 60, janelaMs: 60_000 };

type Registro = { marcas: number[] };

const memoria = new Map<string, Registro>();

/** Teto de chaves distintas guardadas, para que a memória não cresça sem limite sob ataque com IPs variados. */
const MAXIMO_CHAVES = 10_000;

export type VeredictoLimite = {
  permitido: boolean;
  restantes: number;
  /** Segundos até a próxima tentativa ser aceita. Vai no header Retry-After. */
  esperarSegundos: number;
};

/**
 * Registra uma tentativa e decide se ela passa.
 *
 * `agora` é parâmetro para que o teste controle o tempo sem relógio falso
 * global, que interferiria em outras suítes rodando em paralelo.
 */
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
 * Identifica o cliente para fins de limite.
 *
 * Atrás da Vercel, x-forwarded-for é confiável porque a plataforma o reescreve.
 * Em self-host sem proxy, o cabeçalho é controlado pelo cliente e confiar nele
 * daria a qualquer um um limite infinito, bastando variar o valor. Por isso a
 * confiança é configurável e o primeiro endereço da lista é o que vale.
 */
export function identificarCliente(cabecalhos: Headers, sufixo = ""): string {
  const confia = process.env.RATE_LIMIT_CONFIA_PROXY !== "false";
  const encaminhado = confia ? cabecalhos.get("x-forwarded-for") : null;
  const ip = encaminhado?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip") || "desconhecido";
  return sufixo ? `${ip}:${sufixo}` : ip;
}
