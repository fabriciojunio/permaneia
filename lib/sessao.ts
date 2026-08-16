// Sessão em JWT assinado (HS256), guardado em cookie HttpOnly.
//
// Por que JWT e não sessão em banco: a aplicação roda em funções serverless na
// Vercel, sem memória compartilhada entre invocações. Uma sessão em banco
// custaria uma consulta a cada requisição, inclusive nas de leitura.
//
// O preço do JWT é a revogação: um token válido continua válido até expirar.
// O campo `vs` (versão da sessão) resolve isso, e o middleware o compara com a
// versão gravada no usuário. Trocar a senha ou desativar a conta incrementa a
// versão e derruba todos os tokens emitidos antes, na hora.

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
    // Falhar aqui é melhor do que assinar com um segredo fraco: um segredo
    // curto torna a falsificação do cookie viável por força bruta.
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
    // Token expirado, assinatura inválida, formato quebrado: tudo é "sem sessão".
    return null;
  }
}

/**
 * A conexão que originou a requisição é HTTPS?
 *
 * Atrás de um proxy, como na Vercel, quem carrega essa informação é o
 * x-forwarded-proto: a conexão entre o proxy e a função é interna e aparece
 * como http, mesmo com o usuário navegando em https.
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
 * Opções do cookie de sessão.
 *
 * O atributo `secure` acompanha o PROTOCOLO DA REQUISIÇÃO, e não o NODE_ENV.
 * A diferença não é cosmética: um cookie marcado como Secure é simplesmente
 * descartado pelo navegador em conexão http, sem erro nenhum. Amarrar isso ao
 * NODE_ENV fazia o build de produção servido em http, que é exatamente o caso
 * dos testes E2E e de qualquer instalação local, aceitar o login e perder a
 * sessão em seguida, sem nada nos logs indicando o motivo.
 *
 * Em produção de verdade a requisição chega por https e o cookie continua
 * Secure, que é o comportamento desejado.
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
    // "lax" e não "strict": com "strict" o cookie não acompanha a navegação
    // vinda de um link externo e o usuário cairia no login logo após entrar.
    sameSite: "lax",
    secure: conexaoSegura,
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  };
}
