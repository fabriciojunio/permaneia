import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NOME_COOKIE, verificarSessao } from "@/lib/sessao";
import { validarOrigem } from "@/lib/csrf";
import { podeVerPagina } from "@/lib/acesso";
import { MODO_DEMO } from "@/lib/demo";

// Rotas abertas. A entrada da demonstração só entra na lista quando o modo está
// ligado; fora dele a própria rota responde 404.
const PUBLICAS = [
  "/",
  "/login",
  "/cadastro",
  "/api/auth/login",
  "/api/auth/cadastrar",
  "/api/health",
  ...(MODO_DEMO ? ["/api/auth/demo"] : []),
];

function ehPublica(caminho: string): boolean {
  if (caminho === "/") return true;
  return PUBLICAS.some((p) => p !== "/" && (caminho === p || caminho.startsWith(`${p}/`)));
}

/**
 * Cabeçalhos de segurança das respostas emitidas pelo próprio middleware
 * (401, 403, redirecionamento). Os cabeçalhos de página, incluindo a CSP, são
 * definidos em next.config.mjs, que é a fonte canônica; repeti-los aqui só
 * abriria espaço para as duas listas divergirem.
 */
function comCabecalhos(resposta: NextResponse, idRequisicao: string): NextResponse {
  resposta.headers.set("X-Request-ID", idRequisicao);
  resposta.headers.set("X-Frame-Options", "DENY");
  resposta.headers.set("X-Content-Type-Options", "nosniff");
  resposta.headers.set("X-XSS-Protection", "0");
  resposta.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  resposta.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  resposta.headers.delete("X-Powered-By");
  return resposta;
}

/** API recebe 401 em JSON, para o cliente tratar; página vai para o login. */
function semSessao(requisicao: NextRequest, idRequisicao: string, limparCookie: boolean): NextResponse {
  const ehApi = requisicao.nextUrl.pathname.startsWith("/api/");
  const resposta = ehApi
    ? NextResponse.json(
        { erro: { codigo: "NAO_AUTORIZADO", mensagem: "Sessão expirada. Entre novamente.", idRequisicao } },
        { status: 401 }
      )
    : NextResponse.redirect(new URL("/login", requisicao.url));
  if (limparCookie) resposta.cookies.set(NOME_COOKIE, "", { maxAge: 0, path: "/" });
  return comCabecalhos(resposta, idRequisicao);
}

export async function middleware(requisicao: NextRequest) {
  const idRequisicao = crypto.randomUUID();
  const { pathname } = requisicao.nextUrl;

  // CVE-2025-29927: a versão em uso já corrige o desvio de middleware, mas
  // nenhum cliente legítimo envia este cabeçalho, então recusá-lo elimina a
  // classe inteira de ataque em vez de depender só da correção da biblioteca.
  if (requisicao.headers.has("x-middleware-subrequest")) {
    return comCabecalhos(
      NextResponse.json({ erro: { codigo: "VALIDACAO", mensagem: "Requisição inválida." } }, { status: 400 }),
      idRequisicao
    );
  }

  // Anti-CSRF antes de tudo, para valer inclusive no login, que é público.
  const host = requisicao.headers.get("x-forwarded-host") ?? requisicao.headers.get("host");
  const veredicto = validarOrigem(
    requisicao.method,
    pathname.startsWith("/api/"),
    requisicao.headers.get("origin"),
    requisicao.headers.get("referer"),
    host
  );
  if (!veredicto.permitido) {
    return comCabecalhos(
      NextResponse.json(
        { erro: { codigo: "PROIBIDO", mensagem: veredicto.motivo ?? "Origem não permitida.", idRequisicao } },
        { status: veredicto.status }
      ),
      idRequisicao
    );
  }

  if (ehPublica(pathname)) {
    const cabecalhos = new Headers(requisicao.headers);
    cabecalhos.set("x-request-id", idRequisicao);
    return comCabecalhos(NextResponse.next({ request: { headers: cabecalhos } }), idRequisicao);
  }

  const token = requisicao.cookies.get(NOME_COOKIE)?.value;
  if (!token) return semSessao(requisicao, idRequisicao, false);

  const sessao = await verificarSessao(token);
  if (!sessao) return semSessao(requisicao, idRequisicao, true);

  // Senha pendente bloqueia tudo, menos a própria troca e as rotas de sessão.
  if (sessao.trocarSenha) {
    const liberado =
      pathname === "/trocar-senha" || pathname.startsWith("/api/auth/") || pathname === "/api/health";
    if (!liberado) {
      const resposta = pathname.startsWith("/api/")
        ? NextResponse.json(
            { erro: { codigo: "PROIBIDO", mensagem: "Troque sua senha para continuar.", idRequisicao } },
            { status: 403 }
          )
        : NextResponse.redirect(new URL("/trocar-senha", requisicao.url));
      return comCabecalhos(resposta, idRequisicao);
    }
  }

  // Defesa de borda por papel. A proteção que de fato conta está em cada rota.
  if (!pathname.startsWith("/api/") && !podeVerPagina(pathname, sessao.papel)) {
    return comCabecalhos(NextResponse.redirect(new URL("/inicio", requisicao.url)), idRequisicao);
  }

  const cabecalhos = new Headers(requisicao.headers);
  cabecalhos.set("x-request-id", idRequisicao);
  cabecalhos.set("x-usuario-id", sessao.usuarioId);
  cabecalhos.set("x-usuario-email", sessao.email);
  // Cabeçalho HTTP só aceita ISO-8859-1; nome com acento vai codificado.
  cabecalhos.set("x-usuario-nome", encodeURIComponent(sessao.nome));
  cabecalhos.set("x-usuario-papel", sessao.papel);
  cabecalhos.set("x-usuario-vs", String(sessao.vs ?? 0));
  if (sessao.alunoId) cabecalhos.set("x-usuario-aluno-id", sessao.alunoId);
  else cabecalhos.delete("x-usuario-aluno-id");

  return comCabecalhos(NextResponse.next({ request: { headers: cabecalhos } }), idRequisicao);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|manifest.webmanifest).*)",
};
