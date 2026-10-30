// Leitura da sessão dentro das rotas de API e dos componentes de servidor.
//
// O middleware valida a assinatura e sobrescreve os cabeçalhos das rotas
// protegidas. Aqui conferimos também o estado atual da conta: a assinatura
// sozinha continua válida depois de trocar a senha ou desativar um usuário.
// Esta consulta por chave primária permite revogação imediata nas rotas e nas
// páginas protegidas, sem manter um cache que prolongue uma sessão revogada.

import { headers } from "next/headers";
import type { Papel, Sessao } from "./sessao";
import { prisma } from "./prisma";

// A partir do Next 15, headers() é assíncrona: a requisição pode não estar
// disponível no momento da chamada, e a API passou a refletir isso.
export async function sessaoAtual(): Promise<Sessao | null> {
  let cabecalhos: Headers;
  try {
    cabecalhos = await headers();
  } catch {
    return null;
  }

  const usuarioId = cabecalhos.get("x-usuario-id");
  const email = cabecalhos.get("x-usuario-email");
  const papel = cabecalhos.get("x-usuario-papel") as Papel | null;
  if (!usuarioId || !email || !papel) return null;
  if (papel !== "aluno" && papel !== "coordenacao" && papel !== "admin") return null;

  const alunoId = cabecalhos.get("x-usuario-aluno-id");
  const vs = Number(cabecalhos.get("x-usuario-vs") ?? 0);
  if (!Number.isSafeInteger(vs) || vs < 0) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true, nome: true, email: true, papel: true, alunoId: true,
      ativo: true, versaoSessao: true,
    },
  });
  if (
    !usuario?.ativo || usuario.versaoSessao !== vs ||
    usuario.papel !== papel || (usuario.alunoId ?? null) !== alunoId
  ) return null;

  return {
    usuarioId,
    email: usuario.email,
    nome: usuario.nome,
    papel,
    alunoId: alunoId ?? undefined,
    vs,
  };
}
