import { describe, expect, it } from "vitest";
import {
  alunoSchema,
  atualizarMatriculaSchema,
  cadastroSchema,
  camposComErro,
  disciplinaSchema,
  documentoTextoSchema,
  emailSchema,
  loginSchema,
  matriculaSchema,
  perguntaSchema,
  sinaisSchema,
  trocarSenhaSchema,
  uuidSchema,
} from "@/lib/validacoes";

const UUID = "11111111-2222-4333-8444-555555555555";

describe("uuidSchema", () => {
  it.each([UUID, "00000000-0000-4000-8000-000000000000"])("aceita %s", (v) => {
    expect(uuidSchema.safeParse(v).success).toBe(true);
  });

  it.each(["", "123", "não-é-uuid", "11111111-2222-3333-4444", `${UUID}x`])("rejeita %s", (v) => {
    expect(uuidSchema.safeParse(v).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it.each([
    "pessoa@exemplo.com",
    "aluno@unisagrado.edu.br",
    "nome.sobrenome+tag@sub.dominio.com.br",
  ])("aceita %s", (v) => {
    expect(emailSchema.safeParse(v).success).toBe(true);
  });

  it.each(["", "sem-arroba", "@semlocal.com", "sem@dominio", "a@b", "espaço @exemplo.com"])(
    "rejeita %s",
    (v) => {
      expect(emailSchema.safeParse(v).success).toBe(false);
    }
  );

  it("normaliza para minúsculas", () => {
    const r = emailSchema.safeParse("Pessoa@Exemplo.COM");
    expect(r.success && r.data).toBe("pessoa@exemplo.com");
  });

  it("remove espaços das bordas", () => {
    const r = emailSchema.safeParse("  pessoa@exemplo.com  ");
    expect(r.success && r.data).toBe("pessoa@exemplo.com");
  });

  it("rejeita endereço longo demais", () => {
    expect(emailSchema.safeParse(`${"a".repeat(250)}@exemplo.com`).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("aceita credenciais bem formadas", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "qualquer" }).success).toBe(true);
  });

  it.each([
    [{ email: "a@b.com" }],
    [{ senha: "x" }],
    [{ email: "invalido", senha: "x" }],
    [{ email: "a@b.com", senha: "" }],
    [{}],
    [null],
  ])("rejeita %o", (entrada) => {
    expect(loginSchema.safeParse(entrada).success).toBe(false);
  });

  it("não impõe política de força no login, só no cadastro", () => {
    // Impor a política aqui impediria quem tem senha antiga de entrar para trocá-la.
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "123" }).success).toBe(true);
  });
});

describe("cadastroSchema", () => {
  const valido = {
    nome: "Maria Antônia",
    email: "maria@exemplo.com",
    curso: "Ciência da Computação",
    senha: "senhaSegura2026",
    confirmacao: "senhaSegura2026",
    aceiteTermos: true as const,
  };

  it("aceita cadastro completo", () => {
    expect(cadastroSchema.safeParse(valido).success).toBe(true);
  });

  it("o curso é opcional", () => {
    const { curso: _curso, ...semCurso } = valido;
    expect(cadastroSchema.safeParse(semCurso).success).toBe(true);
  });

  it("NÃO aceita papel vindo do formulário", () => {
    // Aceitar o papel permitiria a qualquer pessoa se cadastrar como
    // coordenação e abrir o painel com o risco de toda a instituição.
    const r = cadastroSchema.safeParse({ ...valido, papel: "admin" });
    expect(r.success).toBe(true);
    expect(r.success && "papel" in r.data).toBe(false);
  });

  it("exige confirmação igual à senha", () => {
    const r = cadastroSchema.safeParse({ ...valido, confirmacao: "outraCoisa2026" });
    expect(r.success).toBe(false);
    if (!r.success) expect(camposComErro(r.error)).toHaveProperty("confirmacao");
  });

  it("exige o aceite do aviso de tratamento de dados", () => {
    expect(cadastroSchema.safeParse({ ...valido, aceiteTermos: false }).success).toBe(false);
    const { aceiteTermos: _a, ...sem } = valido;
    expect(cadastroSchema.safeParse(sem).success).toBe(false);
  });

  it("recusa senha que contém o próprio usuário do e-mail", () => {
    const r = cadastroSchema.safeParse({
      ...valido,
      email: "joaquim@exemplo.com",
      senha: "joaquim123456",
      confirmacao: "joaquim123456",
    });
    expect(r.success).toBe(false);
  });

  it.each([
    [{ nome: "" }],
    [{ nome: "   " }],
    [{ email: "invalido" }],
    [{ nome: "a".repeat(200) }],
  ])("rejeita cadastro com %o", (parcial) => {
    expect(cadastroSchema.safeParse({ ...valido, ...parcial }).success).toBe(false);
  });
});

describe("alunoSchema e disciplinaSchema", () => {
  it("aceita aluno bem formado", () => {
    expect(alunoSchema.safeParse({ nome: "Ana", email: "ana@x.com" }).success).toBe(true);
  });

  it("remove espaços das bordas do nome", () => {
    const r = alunoSchema.safeParse({ nome: "  Ana  ", email: "ana@x.com" });
    expect(r.success && r.data.nome).toBe("Ana");
  });

  it("aceita disciplina bem formada", () => {
    expect(
      disciplinaSchema.safeParse({ nome: "Inteligência Artificial", professor: "Patrick", periodo: "2026-2" }).success
    ).toBe(true);
  });

  it.each(["2026-1", "2026-2", "2027-1"])("aceita o período %s", (periodo) => {
    expect(disciplinaSchema.safeParse({ nome: "IA", periodo }).success).toBe(true);
  });

  it.each(["2026", "2026-3", "26-2", "2026/2", "2026-0", "abcd-1"])("rejeita o período %s", (periodo) => {
    expect(disciplinaSchema.safeParse({ nome: "IA", periodo }).success).toBe(false);
  });

  it("professor e período são opcionais", () => {
    expect(disciplinaSchema.safeParse({ nome: "IA" }).success).toBe(true);
  });
});

describe("sinaisSchema", () => {
  it("aceita os três sinais dentro do universo", () => {
    expect(
      sinaisSchema.safeParse({ frequenciaPercentual: 75, mediaNotas: 6.5, acessosPlataforma: 12 }).success
    ).toBe(true);
  });

  it.each([
    [{ frequenciaPercentual: -1 }],
    [{ frequenciaPercentual: 101 }],
    [{ mediaNotas: -0.5 }],
    [{ mediaNotas: 10.5 }],
    [{ acessosPlataforma: -1 }],
    [{ acessosPlataforma: 3.5 }],
    [{ acessosPlataforma: 200_000 }],
  ])("rejeita %o", (parcial) => {
    const base = { frequenciaPercentual: 50, mediaNotas: 5, acessosPlataforma: 10 };
    expect(sinaisSchema.safeParse({ ...base, ...parcial }).success).toBe(false);
  });

  it.each([
    [{ frequenciaPercentual: 0 }],
    [{ frequenciaPercentual: 100 }],
    [{ mediaNotas: 0 }],
    [{ mediaNotas: 10 }],
    [{ acessosPlataforma: 0 }],
  ])("aceita o valor de borda %o", (parcial) => {
    const base = { frequenciaPercentual: 50, mediaNotas: 5, acessosPlataforma: 10 };
    expect(sinaisSchema.safeParse({ ...base, ...parcial }).success).toBe(true);
  });

  it("rejeita texto no lugar de número", () => {
    expect(
      sinaisSchema.safeParse({ frequenciaPercentual: "75", mediaNotas: 6, acessosPlataforma: 1 }).success
    ).toBe(false);
  });

  it("a mensagem de erro dos acessos alerta para falha de importação", () => {
    const r = sinaisSchema.safeParse({ frequenciaPercentual: 50, mediaNotas: 5, acessosPlataforma: 500_000 });
    if (!r.success) expect(JSON.stringify(r.error.errors)).toMatch(/importação/i);
  });
});

describe("matriculaSchema e atualizarMatriculaSchema", () => {
  it("a matrícula exige aluno, disciplina e os três sinais", () => {
    expect(
      matriculaSchema.safeParse({
        alunoId: UUID,
        disciplinaId: UUID,
        frequenciaPercentual: 80,
        mediaNotas: 7,
        acessosPlataforma: 20,
      }).success
    ).toBe(true);
  });

  it("rejeita matrícula sem identificadores válidos", () => {
    expect(
      matriculaSchema.safeParse({
        alunoId: "x",
        disciplinaId: UUID,
        frequenciaPercentual: 80,
        mediaNotas: 7,
        acessosPlataforma: 20,
      }).success
    ).toBe(false);
  });

  it.each([
    [{ frequenciaPercentual: 90 }],
    [{ mediaNotas: 8 }],
    [{ acessosPlataforma: 30 }],
    [{ frequenciaPercentual: 90, mediaNotas: 8 }],
  ])("a atualização parcial aceita %o", (parcial) => {
    expect(atualizarMatriculaSchema.safeParse(parcial).success).toBe(true);
  });

  it("a atualização exige ao menos um campo", () => {
    expect(atualizarMatriculaSchema.safeParse({}).success).toBe(false);
  });

  it("a atualização mantém os limites de cada sinal", () => {
    expect(atualizarMatriculaSchema.safeParse({ frequenciaPercentual: 150 }).success).toBe(false);
  });
});

describe("perguntaSchema", () => {
  it("aceita pergunta bem formada", () => {
    expect(perguntaSchema.safeParse({ disciplinaId: UUID, pergunta: "Quando é a P1?" }).success).toBe(true);
  });

  it.each(["", "ab", "  "])("rejeita a pergunta curta demais %s", (pergunta) => {
    expect(perguntaSchema.safeParse({ disciplinaId: UUID, pergunta }).success).toBe(false);
  });

  it("rejeita pergunta longa demais", () => {
    // Sem teto, o campo vira um canal para inflar o prompt e queimar a cota.
    expect(
      perguntaSchema.safeParse({ disciplinaId: UUID, pergunta: "a".repeat(1001) }).success
    ).toBe(false);
  });

  it("aceita exatamente o tamanho máximo", () => {
    expect(perguntaSchema.safeParse({ disciplinaId: UUID, pergunta: "a".repeat(1000) }).success).toBe(true);
  });

  it("remove espaços das bordas da pergunta", () => {
    const r = perguntaSchema.safeParse({ disciplinaId: UUID, pergunta: "  Quando é a P1?  " });
    expect(r.success && r.data.pergunta).toBe("Quando é a P1?");
  });

  it("rejeita disciplina inválida", () => {
    expect(perguntaSchema.safeParse({ disciplinaId: "abc", pergunta: "Quando é a P1?" }).success).toBe(false);
  });
});

describe("documentoTextoSchema", () => {
  const valido = { titulo: "Cronograma", conteudo: "a".repeat(100) };

  it("aceita documento bem formado", () => {
    expect(documentoTextoSchema.safeParse(valido).success).toBe(true);
  });

  it("rejeita conteúdo curto demais para valer a indexação", () => {
    expect(documentoTextoSchema.safeParse({ ...valido, conteudo: "curto" }).success).toBe(false);
  });

  it("rejeita documento grande demais para uma única ingestão", () => {
    expect(documentoTextoSchema.safeParse({ ...valido, conteudo: "a".repeat(400_001) }).success).toBe(false);
  });

  it("a referência é opcional", () => {
    expect(documentoTextoSchema.safeParse({ ...valido, referencia: "ago/2026" }).success).toBe(true);
  });

  it("exige título", () => {
    expect(documentoTextoSchema.safeParse({ ...valido, titulo: "" }).success).toBe(false);
  });
});

describe("trocarSenhaSchema", () => {
  const valido = { senhaAtual: "antiga123456", senhaNova: "novaSenha2026", confirmacao: "novaSenha2026" };

  it("aceita troca bem formada", () => {
    expect(trocarSenhaSchema.safeParse(valido).success).toBe(true);
  });

  it("exige confirmação igual", () => {
    const r = trocarSenhaSchema.safeParse({ ...valido, confirmacao: "outra" });
    expect(r.success).toBe(false);
    if (!r.success) expect(camposComErro(r.error)).toHaveProperty("confirmacao");
  });

  it("exige senha nova diferente da atual", () => {
    const r = trocarSenhaSchema.safeParse({
      senhaAtual: "mesmaSenha123",
      senhaNova: "mesmaSenha123",
      confirmacao: "mesmaSenha123",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(camposComErro(r.error)).toHaveProperty("senhaNova");
  });

  it.each([
    [{ senhaAtual: "" }],
    [{ senhaNova: "" }],
    [{ confirmacao: "" }],
  ])("rejeita campo vazio em %o", (parcial) => {
    expect(trocarSenhaSchema.safeParse({ ...valido, ...parcial }).success).toBe(false);
  });
});

describe("camposComErro", () => {
  it("mapeia cada campo à sua mensagem", () => {
    const r = alunoSchema.safeParse({ nome: "", email: "invalido" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const campos = camposComErro(r.error);
      expect(campos).toHaveProperty("nome");
      expect(campos).toHaveProperty("email");
    }
  });

  it("guarda apenas a primeira mensagem de cada campo", () => {
    const r = alunoSchema.safeParse({ nome: "", email: "" });
    if (!r.success) {
      for (const mensagem of Object.values(camposComErro(r.error))) {
        expect(typeof mensagem).toBe("string");
      }
    }
  });

  it("usa underscore para erro sem campo associado", () => {
    const r = atualizarMatriculaSchema.safeParse({});
    if (!r.success) expect(Object.keys(camposComErro(r.error))).toContain("_");
  });

  it("as mensagens estão em português e com acentuação correta", () => {
    const r = sinaisSchema.safeParse({ frequenciaPercentual: 200, mediaNotas: 5, acessosPlataforma: 1 });
    if (!r.success) {
      const texto = Object.values(camposComErro(r.error)).join(" ");
      expect(texto).toMatch(/não pode passar/);
    }
  });
});
