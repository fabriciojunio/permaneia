// Esquemas de validação de entrada.
//
// Toda entrada que chega pela rede passa por aqui antes de tocar o banco ou a
// API do Gemini. O esquema é a fronteira de confiança da aplicação: depois
// dele, o tipo do TypeScript corresponde ao que existe de fato em execução.

import { z } from "zod";

/**
 * Mensagem para campo ausente e, se vier, para tipo errado. No zod 4 as duas
 * saem de um único `error`; devolver undefined mantém a mensagem padrão.
 */
const mensagens = (ausente?: string, tipoErrado?: string) => ({
  error: (problema: { input: unknown }) => (problema.input === undefined ? ausente : tipoErrado),
});

/** Texto obrigatório, com espaços das pontas removidos antes de medir o tamanho. */
const textoObrigatorio = (campo: string, maximo: number) =>
  z
    .string(mensagens(`${campo} é obrigatório.`, `${campo} precisa ser texto.`))
    .trim()
    .min(1, `${campo} é obrigatório.`)
    .max(maximo, `${campo} não pode passar de ${maximo} caracteres.`);

export const uuidSchema = z.string().uuid("Identificador inválido.");

export const emailSchema = z
  .string(mensagens("O e-mail é obrigatório."))
  .trim()
  .toLowerCase()
  .min(5, "E-mail inválido.")
  .max(255, "E-mail longo demais.")
  .email("E-mail inválido.");

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string(mensagens("A senha é obrigatória.")).min(1, "A senha é obrigatória.").max(200),
});

/**
 * Cadastro de conta pelo próprio usuário.
 *
 * Note o que NÃO está aqui: o papel. O cadastro público cria exclusivamente
 * contas de aluno. Aceitar o papel vindo do formulário permitiria a qualquer
 * pessoa se cadastrar como coordenação e abrir o painel com o risco de evasão
 * da instituição inteira. Contas de coordenação e de administração são criadas
 * por quem já é administrador.
 */
export const cadastroSchema = z
  .object({
    nome: textoObrigatorio("O nome", 160),
    email: emailSchema,
    curso: textoObrigatorio("O curso", 120).optional(),
    senha: z.string(mensagens("A senha é obrigatória.")).min(1, "A senha é obrigatória."),
    confirmacao: z.string(mensagens("Confirme a senha.")).min(1, "Confirme a senha."),
    aceiteTermos: z.literal(true, { error: "É preciso aceitar o aviso de tratamento de dados." }),
  })
  .refine((d) => d.senha === d.confirmacao, {
    message: "A confirmação não confere com a senha.",
    path: ["confirmacao"],
  })
  .refine((d) => !d.senha.toLowerCase().includes(d.email.split("@")[0]?.toLowerCase() ?? "\u0000"), {
    // Senha contendo o próprio usuário é o primeiro palpite de qualquer ataque dirigido.
    message: "A senha não pode conter o seu e-mail.",
    path: ["senha"],
  });

export const alunoSchema = z.object({
  nome: textoObrigatorio("O nome", 160),
  email: emailSchema,
  curso: textoObrigatorio("O curso", 120).optional(),
});

export const disciplinaSchema = z.object({
  nome: textoObrigatorio("O nome da disciplina", 160),
  professor: textoObrigatorio("O professor", 160).optional(),
  periodo: z
    .string()
    .trim()
    .regex(/^\d{4}-[12]$/, "O período deve estar no formato AAAA-1 ou AAAA-2.")
    .optional(),
});

/** Os três sinais do sistema fuzzy, cada um preso ao seu universo de discurso. */
export const sinaisSchema = z.object({
  frequenciaPercentual: z
    .number(mensagens(undefined, "A frequência precisa ser um número."))
    .min(0, "A frequência não pode ser negativa.")
    .max(100, "A frequência não pode passar de 100%."),
  mediaNotas: z
    .number(mensagens(undefined, "A média precisa ser um número."))
    .min(0, "A média não pode ser negativa.")
    .max(10, "A média não pode passar de 10."),
  acessosPlataforma: z
    .number(mensagens(undefined, "Os acessos precisam ser um número."))
    .int("Os acessos precisam ser um número inteiro.")
    .min(0, "Os acessos não podem ser negativos.")
    .max(100_000, "Número de acessos improvável; confira a importação."),
});

export const matriculaSchema = z.object({
  alunoId: uuidSchema,
  disciplinaId: uuidSchema,
  ...sinaisSchema.shape,
});

/** Atualização parcial: pelo menos um dos três sinais precisa vir. */
export const atualizarMatriculaSchema = sinaisSchema.partial().refine(
  (dados) => Object.values(dados).some((v) => v !== undefined),
  { message: "Informe pelo menos um campo para atualizar." }
);

export const perguntaSchema = z.object({
  disciplinaId: uuidSchema,
  pergunta: z
    .string(mensagens("A pergunta é obrigatória."))
    .trim()
    .min(3, "A pergunta precisa ter pelo menos 3 caracteres.")
    // Teto generoso para a pergunta, mas finito: sem limite, o campo vira um
    // canal para inflar o prompt e queimar a cota do tier gratuito.
    .max(1000, "A pergunta não pode passar de 1000 caracteres."),
});

export const documentoTextoSchema = z.object({
  titulo: textoObrigatorio("O título", 200),
  referencia: z.string().trim().max(120).optional(),
  conteudo: z
    .string(mensagens("O conteúdo é obrigatório."))
    .trim()
    .min(50, "O conteúdo precisa ter pelo menos 50 caracteres para valer a indexação.")
    .max(400_000, "Documento grande demais para uma única ingestão."),
});

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual."),
    senhaNova: z.string().min(1, "Informe a senha nova."),
    confirmacao: z.string().min(1, "Confirme a senha nova."),
  })
  .refine((d) => d.senhaNova === d.confirmacao, {
    message: "A confirmação não confere com a senha nova.",
    path: ["confirmacao"],
  })
  .refine((d) => d.senhaNova !== d.senhaAtual, {
    message: "A senha nova precisa ser diferente da atual.",
    path: ["senhaNova"],
  });

/** Converte o erro do Zod no mapa campo -> mensagem consumido pelo formulário. */
export function camposComErro(erro: z.ZodError): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = problema.path.join(".") || "_";
    if (!saida[campo]) saida[campo] = problema.message;
  }
  return saida;
}
