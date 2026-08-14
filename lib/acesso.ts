// Controle de acesso baseado em papel.
//
// Três papéis, com fronteiras que espelham o mundo real da instituição:
//
//   aluno        vê o próprio chat e os próprios dados. Nunca vê o painel de
//                risco, nem o próprio score. Mostrar a um aluno que o sistema o
//                classificou como "risco crítico" é capaz de produzir
//                exatamente o desligamento que se quer evitar.
//   coordenacao  vê o painel de risco da instituição e gerencia disciplinas e
//                documentos. Não gerencia contas.
//   admin        gerencia contas e vê a auditoria.
//
// A regra vive aqui, num único lugar, e é aplicada tanto pelo middleware (que
// evita a renderização da página) quanto por cada rota de API (que é a defesa
// que de fato conta).

import type { Papel, Sessao } from "./sessao";
import { erro, falha, ok, type Resultado } from "./resultado";

export type Permissao =
  | "chat.perguntar"
  | "disciplina.ler"
  | "disciplina.escrever"
  | "documento.ingerir"
  | "matricula.ler"
  | "matricula.escrever"
  | "risco.calcular"
  | "dashboard.ver"
  | "aluno.ler"
  | "aluno.escrever"
  | "usuario.gerenciar"
  | "auditoria.ver"
  | "privacidade.propriosDados";

const PERMISSOES: Record<Papel, ReadonlySet<Permissao>> = {
  aluno: new Set<Permissao>(["chat.perguntar", "disciplina.ler", "privacidade.propriosDados"]),
  coordenacao: new Set<Permissao>([
    "chat.perguntar",
    "disciplina.ler",
    "disciplina.escrever",
    "documento.ingerir",
    "matricula.ler",
    "matricula.escrever",
    "risco.calcular",
    "dashboard.ver",
    "aluno.ler",
    "aluno.escrever",
    "privacidade.propriosDados",
  ]),
  admin: new Set<Permissao>([
    "chat.perguntar",
    "disciplina.ler",
    "disciplina.escrever",
    "documento.ingerir",
    "matricula.ler",
    "matricula.escrever",
    "risco.calcular",
    "dashboard.ver",
    "aluno.ler",
    "aluno.escrever",
    "usuario.gerenciar",
    "auditoria.ver",
    "privacidade.propriosDados",
  ]),
};

export function podeFazer(papel: Papel, permissao: Permissao): boolean {
  return PERMISSOES[papel].has(permissao);
}

/** Todas as permissões do papel, para a interface esconder o que não é permitido. */
export function permissoesDe(papel: Papel): Permissao[] {
  return [...PERMISSOES[papel]].sort();
}

/** Exige a permissão e devolve a sessão, ou a falha pronta para virar resposta HTTP. */
export function exigir(sessao: Sessao | null, permissao: Permissao): Resultado<Sessao> {
  if (!sessao) return falha(erro("NAO_AUTORIZADO", "Faça login para continuar."));
  if (!podeFazer(sessao.papel, permissao)) {
    return falha(erro("PROIBIDO", "Seu perfil não tem acesso a esta funcionalidade."));
  }
  return ok(sessao);
}

/**
 * Páginas visíveis por papel. É defesa de borda: impede que a tela sequer
 * renderize. A proteção real de dados está nas rotas de API.
 */
export function podeVerPagina(caminho: string, papel: Papel): boolean {
  if (caminho === "/dashboard" || caminho.startsWith("/dashboard/")) {
    return podeFazer(papel, "dashboard.ver");
  }
  if (caminho === "/disciplinas" || caminho.startsWith("/disciplinas/")) {
    return podeFazer(papel, "disciplina.escrever");
  }
  if (caminho === "/admin" || caminho.startsWith("/admin/")) {
    return podeFazer(papel, "usuario.gerenciar");
  }
  return true;
}

/**
 * Um aluno só enxerga os próprios dados. Coordenação e administração enxergam
 * os de todos, que é a razão de existir do painel.
 */
export function podeVerDadosDoAluno(sessao: Sessao, alunoId: string): boolean {
  if (sessao.papel === "aluno") return sessao.alunoId === alunoId;
  return podeFazer(sessao.papel, "aluno.ler");
}
