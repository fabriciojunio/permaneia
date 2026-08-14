// Leitura da sessão dentro das rotas de API e dos componentes de servidor.
//
// O middleware já validou a assinatura do token e escreveu os dados da sessão
// em cabeçalhos da requisição. Reler e verificar o token de novo aqui custaria
// uma verificação criptográfica por rota sem ganho: nenhum cliente consegue
// forjar esses cabeçalhos, porque o middleware os sobrescreve incondicionalmente
// antes de a rota ser chamada.

import { headers } from "next/headers";
import type { Papel, Sessao } from "./sessao";

export function sessaoAtual(): Sessao | null {
  let cabecalhos: Headers;
  try {
    cabecalhos = headers();
  } catch {
    return null;
  }

  const usuarioId = cabecalhos.get("x-usuario-id");
  const email = cabecalhos.get("x-usuario-email");
  const papel = cabecalhos.get("x-usuario-papel") as Papel | null;
  if (!usuarioId || !email || !papel) return null;
  if (papel !== "aluno" && papel !== "coordenacao" && papel !== "admin") return null;

  const alunoId = cabecalhos.get("x-usuario-aluno-id");
  const nomeCodificado = cabecalhos.get("x-usuario-nome");

  return {
    usuarioId,
    email,
    // Cabeçalho HTTP só aceita ISO-8859-1, então o nome trafega percent-encoded.
    nome: nomeCodificado ? decodeURIComponent(nomeCodificado) : "",
    papel,
    alunoId: alunoId ?? undefined,
    vs: Number(cabecalhos.get("x-usuario-vs") ?? 0),
  };
}
