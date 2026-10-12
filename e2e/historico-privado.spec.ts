import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";
import { ORIGEM } from "./ajudantes";
import { validarBancoDeTeste } from "../scripts/banco-de-teste";

test("cada administrador acessa apenas suas consultas, inclusive na exportação", async ({ browser }) => {
  validarBancoDeTeste(process.env.DATABASE_URL);
  const banco = new PrismaClient();
  const sufixo = crypto.randomUUID();
  const senha = "HistoricoPrivadoSegura2026";
  const senhaHash = await hash(senha, 12);
  const contas = await Promise.all(["a", "b"].map((letra) => banco.usuario.create({ data: {
    nome: `Admin ${letra}`, email: `${letra}.${sufixo}@permaneia.exemplo`, senhaHash, papel: "admin",
  } })));
  const contextos = await Promise.all(contas.map(() => browser.newContext()));
  const disciplina = await banco.disciplina.create({ data: {
    nome: `Privacidade ${sufixo}`, documentos: { create: { titulo: "Material de teste", totalChunks: 0 } },
  } });
  try {
    // Registros legados sem identificação do autor não pertencem a todo administrador.
    await banco.consultaRag.create({ data: {
      disciplinaId: disciplina.id, pergunta: "Consulta legada sem autor", resposta: "Legado",
      fontes: [], origemIa: "local",
    } });
    for (const [indice, conta] of contas.entries()) {
      const api = contextos[indice].request;
      expect((await api.post(`${ORIGEM}/api/auth/login`, {
        headers: { origin: ORIGEM }, data: { email: conta.email, senha },
      })).status()).toBe(200);
      const resposta = await api.post(`${ORIGEM}/api/rag/perguntar`, {
        headers: { origin: ORIGEM },
        // O autor enviado no corpo não pode substituir o da sessão autenticada.
        data: { disciplinaId: disciplina.id, pergunta: `Qual é a data da prova ${indice}?`, usuarioId: contas[1 - indice].id },
      });
      expect(resposta.status()).toBe(200);
    }
    for (const [indice, contexto] of contextos.entries()) {
      const historico = await contexto.request.get(`${ORIGEM}/api/rag/historico`);
      expect(historico.status()).toBe(200);
      const { consultas } = await historico.json();
      expect(consultas).toHaveLength(1);
      expect(consultas[0].pergunta).toBe(`Qual é a data da prova ${indice}?`);
      const exportacao = await contexto.request.get(`${ORIGEM}/api/privacidade/meus-dados`);
      expect(exportacao.status()).toBe(200);
      expect((await exportacao.json()).consultasAoAssistente.map((c: { pergunta: string }) => c.pergunta))
        .toEqual([`Qual é a data da prova ${indice}?`]);
      expect(await banco.consultaRag.count({ where: { usuarioId: contas[indice].id } })).toBe(1);
    }
  } finally {
    await Promise.all(contextos.map((contexto) => contexto.close()));
    await banco.disciplina.delete({ where: { id: disciplina.id } });
    await banco.registroAuditoria.deleteMany({ where: { atorId: { in: contas.map((c) => c.id) } } });
    await banco.usuario.deleteMany({ where: { id: { in: contas.map((c) => c.id) } } });
    await banco.$disconnect();
  }
});
