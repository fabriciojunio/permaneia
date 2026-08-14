// Esquemas de validação de entrada.
//
// Toda entrada que chega pela rede passa por aqui antes de tocar o banco ou a
// API do Gemini. O esquema é a fronteira de confiança da aplicação: depois
// dele, o tipo do TypeScript corresponde ao que existe de fato em execução.

import { z } from "zod";

/** Texto obrigatório, com espaços das pontas removidos antes de medir o tamanho. */
const textoObrigatorio = (campo: string, maximo: number) =>
  z
    .string({ required_error: `${campo} é obrigatório.`, invalid_type_error: `${campo} precisa ser texto.` })
    .trim()
    .min(1, `${campo} é obrigatório.`)
    .max(maximo, `${campo} não pode passar de ${maximo} caracteres.`);

export const uuidSchema = z.string().uuid("Identificador inválido.");

export const emailSchema = z
  .string({ required_error: "O e-mail é obrigatório." })
  .trim()
  .toLowerCase()
  .min(5, "E-mail inválido.")
  .max(255, "E-mail longo demais.")
  .email("E-mail inválido.");

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string({ required_error: "A senha é obrigatória." }).min(1, "A senha é obrigatória.").max(200),
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
    .number({ invalid_type_error: "A frequência precisa ser um número." })
    .min(0, "A frequência não pode ser negativa.")
    .max(100, "A frequência não pode passar de 100%."),
  mediaNotas: z
    .number({ invalid_type_error: "A média precisa ser um número." })
    .min(0, "A média não pode ser negativa.")
    .max(10, "A média não pode passar de 10."),
  acessosPlataforma: z
    .number({ invalid_type_error: "Os acessos precisam ser um número." })
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
    .string({ required_error: "A pergunta é obrigatória." })
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
    .string({ required_error: "O conteúdo é obrigatório." })
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
  for (const problema of erro.errors) {
    const campo = problema.path.join(".") || "_";
    if (!saida[campo]) saida[campo] = problema.message;
  }
  return saida;
}
