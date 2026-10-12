-- O vínculo de aluno não identifica administradores nem consultas de avaliação.
ALTER TABLE "consultas_rag" ADD COLUMN "usuario_id" UUID;

-- Preserva o histórico dos alunos cujo vínculo identifica uma conta existente.
-- Consultas antigas sem autor conhecido permanecem fora dos históricos pessoais.
UPDATE "consultas_rag" AS consulta
SET "usuario_id" = usuario."id"
FROM "usuarios" AS usuario
WHERE consulta."aluno_id" = usuario."aluno_id";

ALTER TABLE "consultas_rag" ADD CONSTRAINT "consultas_rag_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "consultas_rag_usuario_id_criado_em_idx"
  ON "consultas_rag"("usuario_id", "criado_em" DESC);
