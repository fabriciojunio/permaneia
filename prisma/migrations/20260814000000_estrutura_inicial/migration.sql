-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('aluno', 'coordenacao', 'admin');

-- CreateEnum
CREATE TYPE "FaixaRisco" AS ENUM ('baixo', 'medio', 'alto', 'critico');

-- CreateEnum
CREATE TYPE "OrigemDocumento" AS ENUM ('upload', 'seed', 'texto');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'aluno',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao_sessao" INTEGER NOT NULL DEFAULT 0,
    "trocar_senha" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_acesso" TIMESTAMPTZ(6),
    "aluno_id" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alunos" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "curso" TEXT,
    "anonimizado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "professor" TEXT,
    "periodo" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas" (
    "id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "disciplina_id" UUID NOT NULL,
    "frequencia_percentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "media_notas" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "acessos_plataforma" INTEGER NOT NULL DEFAULT 0,
    "score_risco" DECIMAL(4,3),
    "faixa_risco" "FaixaRisco",
    "score_detalhes" JSONB,
    "calculado_em" TIMESTAMPTZ(6),
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" UUID NOT NULL,
    "disciplina_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "referencia" TEXT,
    "origem" "OrigemDocumento" NOT NULL DEFAULT 'upload',
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_chunks" (
    "id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "disciplina_id" UUID NOT NULL,
    "indice" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "embedding" vector(768),
    "origem_embedding" TEXT NOT NULL DEFAULT 'local',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas_rag" (
    "id" UUID NOT NULL,
    "aluno_id" UUID,
    "disciplina_id" UUID NOT NULL,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "fontes" JSONB NOT NULL,
    "origem_ia" TEXT NOT NULL,
    "similaridade_maxima" DECIMAL(5,4),
    "admitiu_nao_saber" BOOLEAN NOT NULL DEFAULT false,
    "duracao_ms" INTEGER,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_rag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" UUID NOT NULL,
    "ator_id" UUID,
    "ator_email" TEXT,
    "acao" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "recurso_id" TEXT,
    "detalhes" JSONB,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_aluno_id_key" ON "usuarios"("aluno_id");

-- CreateIndex
CREATE INDEX "usuarios_papel_idx" ON "usuarios"("papel");

-- CreateIndex
CREATE UNIQUE INDEX "alunos_email_key" ON "alunos"("email");

-- CreateIndex
CREATE INDEX "alunos_curso_idx" ON "alunos"("curso");

-- CreateIndex
CREATE INDEX "disciplinas_periodo_idx" ON "disciplinas"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "disciplinas_nome_periodo_key" ON "disciplinas"("nome", "periodo");

-- CreateIndex
CREATE INDEX "matriculas_score_risco_idx" ON "matriculas"("score_risco" DESC);

-- CreateIndex
CREATE INDEX "matriculas_disciplina_id_score_risco_idx" ON "matriculas"("disciplina_id", "score_risco" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_aluno_id_disciplina_id_key" ON "matriculas"("aluno_id", "disciplina_id");

-- CreateIndex
CREATE INDEX "documentos_disciplina_id_idx" ON "documentos"("disciplina_id");

-- CreateIndex
CREATE INDEX "documento_chunks_disciplina_id_idx" ON "documento_chunks"("disciplina_id");

-- CreateIndex
CREATE INDEX "documento_chunks_disciplina_id_origem_embedding_idx" ON "documento_chunks"("disciplina_id", "origem_embedding");

-- CreateIndex
CREATE UNIQUE INDEX "documento_chunks_documento_id_indice_key" ON "documento_chunks"("documento_id", "indice");

-- CreateIndex
CREATE INDEX "consultas_rag_disciplina_id_criado_em_idx" ON "consultas_rag"("disciplina_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "consultas_rag_criado_em_idx" ON "consultas_rag"("criado_em");

-- CreateIndex
CREATE INDEX "registros_auditoria_criado_em_idx" ON "registros_auditoria"("criado_em" DESC);

-- CreateIndex
CREATE INDEX "registros_auditoria_acao_idx" ON "registros_auditoria"("acao");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_chunks" ADD CONSTRAINT "documento_chunks_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas_rag" ADD CONSTRAINT "consultas_rag_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas_rag" ADD CONSTRAINT "consultas_rag_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


