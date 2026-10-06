-- Telemetria por consulta do RAG: modelo, tokens e custo estimado.
--
-- Todas as colunas são anuláveis e sem valor padrão, de propósito. Esta tabela
-- recebe escrita a cada pergunta feita por aluno, e coluna com DEFAULT em
-- tabela viva obriga o PostgreSQL a reescrever cada linha em versões antigas.
-- Anulável também é o que mantém a linha honesta: consulta registrada antes
-- desta migração não tem como saber quantos tokens gastou, e zero diria que não
-- gastou nenhum.
--
-- Nada aqui é destrutivo: o código anterior continua gravando sem estas colunas
-- e segue funcionando enquanto a versão nova não sobe. Ver ADR 011.

ALTER TABLE "consultas_rag" ADD COLUMN IF NOT EXISTS "modelo" TEXT;
ALTER TABLE "consultas_rag" ADD COLUMN IF NOT EXISTS "tokens_entrada" INTEGER;
ALTER TABLE "consultas_rag" ADD COLUMN IF NOT EXISTS "tokens_saida" INTEGER;
ALTER TABLE "consultas_rag" ADD COLUMN IF NOT EXISTS "custo_usd" DECIMAL(12, 8);
