// Contrato das variáveis de ambiente.
//
// Os módulos da aplicação NÃO importam este arquivo. O build de produção roda
// sem segredos, e uma validação em escopo de módulo derrubaria o build na
// Vercel. Quem chama `validarEnv()` são os scripts operacionais, onde falhar
// cedo é melhor do que tocar o banco com configuração pela metade.

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória."),
  DIRECT_URL: z.string().min(1, "DIRECT_URL é obrigatória (conexão direta, usada nas migrações)."),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET precisa de pelo menos 32 caracteres."),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Sem chave, o provedor local assume e a aplicação continua respondendo.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODELO_TEXTO: z.string().default("gemini-2.0-flash"),
  GEMINI_MODELO_EMBEDDING: z.string().default("text-embedding-004"),
  IA_EXTERNA: z.enum(["on", "off"]).default("on"),

  DEMO_MODE: z.enum(["on", "off"]).default("off"),
  RATE_LIMIT_CONFIA_PROXY: z.enum(["true", "false"]).default("true"),
  RETENCAO_AUDITORIA_DIAS: z.coerce.number().int().min(30).default(365),
});

export type Env = z.infer<typeof schema>;

export function validarEnv(): Env {
  const analisado = schema.safeParse(process.env);
  if (!analisado.success) {
    const problemas = analisado.error.flatten().fieldErrors;
    process.stderr.write(
      `[FATAL] Variáveis de ambiente inválidas:\n${JSON.stringify(problemas, null, 2)}\n`
    );
    process.exit(1);
  }
  return analisado.data;
}
