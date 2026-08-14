// Trilha de auditoria das ações sensíveis.
//
// Registra quem fez o quê, sobre qual recurso e quando. Existe por duas razões:
// a LGPD exige demonstrar quem acessou dado pessoal, e a coordenação precisa
// saber quem alterou a frequência de um aluno quando o número não bate.
//
// A gravação nunca derruba a operação principal: perder uma linha de auditoria
// é ruim, mas impedir a coordenação de corrigir uma nota por causa disso seria
// pior. A falha vai para o log de erro, onde é visível.

import { prisma } from "./prisma";
import { logger } from "./logger";

export type AcaoAuditada =
  | "login.sucesso"
  | "login.falha"
  | "logout"
  | "senha.trocada"
  | "aluno.criado"
  | "aluno.anonimizado"
  | "disciplina.criada"
  | "disciplina.removida"
  | "documento.ingerido"
  | "documento.removido"
  | "matricula.criada"
  | "matricula.atualizada"
  | "risco.calculado"
  | "risco.recalculado.lote"
  | "dados.exportados"
  | "usuario.criado"
  | "usuario.desativado";

export type EntradaAuditoria = {
  acao: AcaoAuditada;
  recurso: string;
  recursoId?: string;
  atorId?: string;
  atorEmail?: string;
  detalhes?: Record<string, unknown>;
};

export async function registrar(entrada: EntradaAuditoria): Promise<void> {
  try {
    await prisma.registroAuditoria.create({
      data: {
        acao: entrada.acao,
        recurso: entrada.recurso,
        recursoId: entrada.recursoId ?? null,
        atorId: entrada.atorId ?? null,
        atorEmail: entrada.atorEmail ?? null,
        detalhes: (entrada.detalhes ?? {}) as object,
      },
    });
  } catch (e) {
    logger.error("Falha ao gravar registro de auditoria", {
      acao: entrada.acao,
      recurso: entrada.recurso,
      detalhe: (e as Error).message,
    });
  }
}

/** Dias de retenção do log de auditoria. Ver LGPD.md. */
export function diasDeRetencao(): number {
  const bruto = Number(process.env.RETENCAO_AUDITORIA_DIAS);
  if (!Number.isFinite(bruto) || bruto < 30) return 365;
  return Math.trunc(bruto);
}

/** Apaga registros além do prazo de retenção. Chamado pelo script de expurgo. */
export async function expurgar(agora = new Date()): Promise<number> {
  const corte = new Date(agora.getTime() - diasDeRetencao() * 24 * 60 * 60 * 1000);
  const { count } = await prisma.registroAuditoria.deleteMany({ where: { criadoEm: { lt: corte } } });
  return count;
}
