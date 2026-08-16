// JWT em cookie HttpOnly. Sessão em banco custaria uma consulta por requisição
// em ambiente serverless. O preço do JWT é a revogação, resolvida pelo campo
// `vs`: trocar a senha incrementa a versão e derruba os tokens anteriores.

import { SignJWT, jwtVerify } from "jose";

export const NOME_COOKIE = "permaneia_sessao";
export const DURACAO_SEGUNDOS = 60 * 60 * 8; // Uma jornada de estudo, não um mês.

export type Papel = "aluno" | "coordenacao" | "admin";

export type Sessao = {
  usuarioId: string;
  email: string;
  nome: string;
  papel: Papel;
  /** Id do registro de aluno, presente apenas para o papel "aluno". */
  alunoId?: string;
  /** Versão da sessão, para revogação imediata. */
  vs: number;
  trocarSenha?: boolean;
  exp?: number;
};

function segredo(): Uint8Array {
  const bruto = process.env.SESSION_SECRET;
  if (!bruto || bruto.length < 32) {
    // Segredo curto torna a falsificação do cookie viável por força bruta.
    throw new Error("SESSION_SECRET ausente ou com menos de 32 caracteres.");
  }
  return new TextEncoder().encode(bruto);
}

export async function assinarSessao(dados: Omit<Sessao, "exp">): Promise<string> {
  return new SignJWT({ ...dados })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("permaneia")
    .setAudience("permaneia")
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(segredo());
}

/** Verifica assinatura, emissor, público e validade. Devolve null em qualquer falha. */
export async function verificarSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo(), {
      issuer: "permaneia",
      audience: "permaneia",
      algorithms: ["HS256"],
    });

    const papel = payload.papel;
    if (papel !== "aluno" && papel !== "coordenacao" && papel !== "admin") return null;
    if (typeof payload.usuarioId !== "string" || typeof payload.email !== "string") return null;

    return {
      usuarioId: payload.usuarioId,
      email: payload.email,
      nome: typeof payload.nome === "string" ? payload.nome : "",
      papel,
      alunoId: typeof payload.alunoId === "string" ? payload.alunoId : undefined,
      vs: typeof payload.vs === "number" ? payload.vs : 0,
      trocarSenha: payload.trocarSenha === true,
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
    };
  } catch {
    // Expirado, assinatura inválida ou formato quebrado: tudo é "sem sessão".
    return null;
  }
}

/**
 * Atrás de proxy quem carrega essa informação é o x-forwarded-proto: a conexão
 * entre o proxy e a função é interna e aparece como http.
 */
export function requisicaoEhSegura(cabecalhos: Headers, url?: string): boolean {
  const encaminhado = cabecalhos.get("x-forwarded-proto");
  if (encaminhado) return encaminhado.split(",")[0]?.trim() === "https";
  if (url) {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * `secure` acompanha o protocolo da requisição, e não o NODE_ENV: um cookie
 * Secure é descartado em silêncio pelo navegador em http, e amarrá-lo ao
 * NODE_ENV fazia o build de produção servido em http aceitar o login e perder a
 * sessão logo depois, sem nada nos logs.
 */
export function opcoesCookie(conexaoSegura: boolean): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    // "strict" faria o cookie não acompanhar link externo, jogando o usuário
    // de volta no login.
    sameSite: "lax",
    secure: conexaoSegura,
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  };
}
