import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ findUnique: vi.fn() }));
const contexto = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: banco } }));
vi.mock("next/headers", () => contexto);

import { sessaoAtual } from "@/lib/auth";

const usuario = {
  id: "usuario-1", email: "aluno@permaneia.exemplo", nome: "Estudante",
  papel: "aluno", alunoId: "aluno-1", ativo: true, versaoSessao: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  contexto.headers.mockResolvedValue(new Headers({
    "x-usuario-id": usuario.id, "x-usuario-email": usuario.email,
    "x-usuario-nome": usuario.nome, "x-usuario-papel": usuario.papel,
    "x-usuario-aluno-id": usuario.alunoId, "x-usuario-vs": "2",
  }));
  banco.findUnique.mockResolvedValue({ ...usuario });
});

describe("revogação da sessão na leitura das rotas", () => {
  it("aceita a sessão da conta ativa com a versão atual", async () => {
    expect(await sessaoAtual()).toMatchObject({ usuarioId: usuario.id, vs: 2 });
    expect(banco.findUnique).toHaveBeenCalledOnce();
  });

  it("recusa o cookie anterior à troca de senha", async () => {
    banco.findUnique.mockResolvedValue({ ...usuario, versaoSessao: 3 });
    expect(await sessaoAtual()).toBeNull();
  });

  it("recusa a sessão quando a conta foi desativada", async () => {
    banco.findUnique.mockResolvedValue({ ...usuario, ativo: false });
    expect(await sessaoAtual()).toBeNull();
  });

  it("recusa a sessão quando a conta foi removida", async () => {
    banco.findUnique.mockResolvedValue(null);
    expect(await sessaoAtual()).toBeNull();
  });

  it("não mantém as permissões de um papel que mudou no banco", async () => {
    banco.findUnique.mockResolvedValue({ ...usuario, papel: "coordenacao" });
    expect(await sessaoAtual()).toBeNull();
  });

  it("não mantém acesso a um vínculo de aluno que mudou", async () => {
    banco.findUnique.mockResolvedValue({ ...usuario, alunoId: "aluno-2" });
    expect(await sessaoAtual()).toBeNull();
  });

  it("não consulta o banco quando não existe sessão no contexto", async () => {
    contexto.headers.mockResolvedValue(new Headers());
    expect(await sessaoAtual()).toBeNull();
    expect(banco.findUnique).not.toHaveBeenCalled();
  });

  it("não permite autenticação se a versão estiver malformada", async () => {
    const h = await contexto.headers();
    h.set("x-usuario-vs", "NaN");
    expect(await sessaoAtual()).toBeNull();
  });
});
