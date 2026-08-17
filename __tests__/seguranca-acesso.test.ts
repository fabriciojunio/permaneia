import { describe, expect, it } from "vitest";
import { exigir, permissoesDe, podeFazer, podeVerDadosDoAluno, podeVerPagina } from "@/lib/acesso";
import type { Papel, Sessao } from "@/lib/sessao";

const PAPEIS: Papel[] = ["aluno", "coordenacao", "admin"];

const PERMISSOES = [
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
] as const;

function sessao(papel: Papel, alunoId?: string): Sessao {
  return {
    usuarioId: "u1",
    email: "pessoa@exemplo.test",
    nome: "Pessoa",
    papel,
    alunoId,
    vs: 0,
  };
}

describe("matriz de permissões", () => {
  it.each(PAPEIS.flatMap((p) => PERMISSOES.map((perm) => [p, perm] as const)))(
    "o papel %s tem decisão definida para %s",
    (papel, permissao) => {
      expect(typeof podeFazer(papel, permissao)).toBe("boolean");
    }
  );

  it("o aluno tem exatamente três permissões", () => {
    expect(permissoesDe("aluno")).toEqual([
      "chat.perguntar",
      "disciplina.ler",
      "privacidade.propriosDados",
    ]);
  });

  it.each([
    "dashboard.ver",
    "matricula.ler",
    "matricula.escrever",
    "risco.calcular",
    "aluno.ler",
    "aluno.escrever",
    "disciplina.escrever",
    "documento.ingerir",
    "usuario.gerenciar",
    "auditoria.ver",
  ] as const)("o aluno NÃO pode %s", (permissao) => {
    expect(podeFazer("aluno", permissao)).toBe(false);
  });

  it("o aluno não vê o painel de risco, nem o próprio score", () => {
    // Decisão de projeto: informar a alguém que um sistema o classificou como
    // risco crítico pode produzir justamente o desligamento que se quer evitar.
    expect(podeFazer("aluno", "dashboard.ver")).toBe(false);
    expect(podeFazer("aluno", "matricula.ler")).toBe(false);
  });

  it.each([
    "dashboard.ver",
    "matricula.ler",
    "matricula.escrever",
    "risco.calcular",
    "disciplina.escrever",
    "documento.ingerir",
    "aluno.ler",
    "aluno.escrever",
  ] as const)("a coordenação pode %s", (permissao) => {
    expect(podeFazer("coordenacao", permissao)).toBe(true);
  });

  it.each(["usuario.gerenciar", "auditoria.ver"] as const)(
    "a coordenação NÃO pode %s, que é atribuição da administração",
    (permissao) => {
      expect(podeFazer("coordenacao", permissao)).toBe(false);
    }
  );

  it("a coordenação NÃO usa o assistente, que é ferramenta de aluno", () => {
    expect(podeFazer("coordenacao", "chat.perguntar")).toBe(false);
  });

  it("os dois papéis operacionais não compartilham nenhuma atribuição de trabalho", () => {
    // "privacidade.propriosDados" e "disciplina.ler" ficam de fora porque não
    // são atribuição de ninguém: a primeira é exigência da LGPD para qualquer
    // titular, e a segunda é o que permite ao aluno escolher a disciplina no
    // seletor do assistente.
    const comuns = ["privacidade.propriosDados", "disciplina.ler"];
    const aluno = permissoesDe("aluno").filter((p) => !comuns.includes(p));
    const coordenacao = permissoesDe("coordenacao").filter((p) => !comuns.includes(p));
    expect(aluno.filter((p) => coordenacao.includes(p))).toEqual([]);
  });

  it.each(PERMISSOES)("a administração pode %s", (permissao) => {
    expect(podeFazer("admin", permissao)).toBe(true);
  });

  it("a administração é o único papel que gerencia contas", () => {
    expect(PAPEIS.filter((p) => podeFazer(p, "usuario.gerenciar"))).toEqual(["admin"]);
  });

  it("todo papel pode acessar os próprios dados, por exigência da LGPD", () => {
    for (const p of PAPEIS) {
      expect(podeFazer(p, "privacidade.propriosDados")).toBe(true);
    }
  });

  it("as permissões da coordenação são subconjunto das da administração", () => {
    for (const perm of permissoesDe("coordenacao")) {
      expect(permissoesDe("admin")).toContain(perm);
    }
  });

  it("as permissões do aluno NÃO são subconjunto das da coordenação", () => {
    // Hierarquia deliberadamente quebrada entre os dois papéis operacionais.
    // Coordenação não é "aluno com mais poder": é outra função, com outra tela.
    expect(permissoesDe("coordenacao")).not.toContain("chat.perguntar");
    expect(permissoesDe("aluno")).toContain("chat.perguntar");
  });

  it.each(PAPEIS)("permissoesDe(%s) devolve lista ordenada e sem repetição", (papel) => {
    const lista = permissoesDe(papel);
    expect([...lista].sort()).toEqual(lista);
    expect(new Set(lista).size).toBe(lista.length);
  });
});

describe("exigir", () => {
  it("recusa sem sessão com NAO_AUTORIZADO", () => {
    const r = exigir(null, "chat.perguntar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("NAO_AUTORIZADO");
  });

  it("recusa com sessão sem permissão, usando PROIBIDO", () => {
    // Códigos diferentes porque as ações do cliente também são diferentes:
    // um pede login, o outro não tem o que fazer.
    const r = exigir(sessao("aluno"), "dashboard.ver");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("PROIBIDO");
  });

  it("aceita e devolve a própria sessão quando há permissão", () => {
    const s = sessao("coordenacao");
    const r = exigir(s, "dashboard.ver");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBe(s);
  });

  it.each(PAPEIS.flatMap((p) => PERMISSOES.map((perm) => [p, perm] as const)))(
    "exigir concorda com podeFazer para %s e %s",
    (papel, permissao) => {
      expect(exigir(sessao(papel), permissao).ok).toBe(podeFazer(papel, permissao));
    }
  );

  it("a mensagem de recusa não revela detalhe interno", () => {
    const r = exigir(sessao("aluno"), "usuario.gerenciar");
    if (!r.ok) {
      expect(r.erro.mensagem).not.toMatch(/usuario\.gerenciar|permissao|Set/i);
    }
  });
});

describe("podeVerPagina", () => {
  it.each([
    ["/dashboard", "aluno", false],
    ["/dashboard", "coordenacao", true],
    ["/dashboard", "admin", true],
    ["/disciplinas", "aluno", false],
    ["/disciplinas", "coordenacao", true],
    ["/admin", "aluno", false],
    ["/admin", "coordenacao", false],
    ["/admin", "admin", true],
    ["/chat", "aluno", true],
    ["/chat", "coordenacao", false],
    ["/chat", "admin", true],
    ["/inicio", "aluno", true],
    ["/privacidade", "aluno", true],
  ] as const)("%s para %s devolve %s", (caminho, papel, esperado) => {
    expect(podeVerPagina(caminho, papel)).toBe(esperado);
  });

  it("protege também as subrotas", () => {
    expect(podeVerPagina("/dashboard/detalhe/123", "aluno")).toBe(false);
    expect(podeVerPagina("/admin/usuarios", "coordenacao")).toBe(false);
    expect(podeVerPagina("/disciplinas/abc/documentos", "aluno")).toBe(false);
  });

  it("não confunde prefixo com rota protegida", () => {
    // "/dashboards-publicos" não é subrota de "/dashboard".
    expect(podeVerPagina("/inicio", "aluno")).toBe(true);
  });

  it("libera por padrão a rota desconhecida, porque a proteção real está na API", () => {
    expect(podeVerPagina("/rota-nova-qualquer", "aluno")).toBe(true);
  });
});

describe("podeVerDadosDoAluno", () => {
  it("o aluno vê os próprios dados", () => {
    expect(podeVerDadosDoAluno(sessao("aluno", "a1"), "a1")).toBe(true);
  });

  it("o aluno NÃO vê os dados de outro aluno", () => {
    expect(podeVerDadosDoAluno(sessao("aluno", "a1"), "a2")).toBe(false);
  });

  it("aluno sem vínculo não vê dados de ninguém", () => {
    expect(podeVerDadosDoAluno(sessao("aluno"), "a1")).toBe(false);
  });

  it("a coordenação vê os dados de qualquer aluno, que é a razão do painel", () => {
    expect(podeVerDadosDoAluno(sessao("coordenacao"), "a1")).toBe(true);
    expect(podeVerDadosDoAluno(sessao("coordenacao"), "a999")).toBe(true);
  });

  it("a administração vê os dados de qualquer aluno", () => {
    expect(podeVerDadosDoAluno(sessao("admin"), "a1")).toBe(true);
  });

  it.each(["a1", "a2", "outro-id", ""])("o aluno vinculado a a1 só vê a1 (testando %s)", (id) => {
    expect(podeVerDadosDoAluno(sessao("aluno", "a1"), id)).toBe(id === "a1");
  });
});
