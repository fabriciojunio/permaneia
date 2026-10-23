# Revisão de outubro de 2026

## Segurança

- Sessões agora consultam o estado da conta: troca de senha, desativação, remoção,
  mudança de papel e mudança de vínculo de aluno invalidam o acesso antigo.
- Trocas de senha concorrentes usam a versão da sessão no `UPDATE`; só uma pode
  consumir a mesma versão. A conta precisa continuar ativa durante a gravação.
- O limitador conserva contadores ativos ao atingir 10 mil chaves, respeita janelas
  maiores que dez minutos e ignora ambos os cabeçalhos de IP quando a confiança
  no proxy está desligada. Continua sendo um limitador local por instância.
- Consultas do assistente guardam o usuário autenticado. Histórico e exportação
  usam esse autor, inclusive para administradores, que não têm vínculo de aluno.

## Migração do histórico

`20261011120000_autor_consulta_rag` adiciona uma coluna e um índice. Associa consultas
antigas de alunos às contas vinculadas e mantém sem autor as consultas cuja autoria
não pode ser determinada. Estas não aparecem em nenhum histórico pessoal. A remoção
de uma conta remove suas consultas por chave estrangeira.

Aplique a migração antes de publicar o novo código. Em uma base já controlada por
migrations, use `npx prisma migrate deploy` com a conexão de manutenção. Faça backup
antes de atualizar a base. Ambientes antigos montados com `db push` precisam primeiro
de conferência do esquema e baseline das migrações já representadas no banco; não
marque migrações como aplicadas sem essa conferência. Esta revisão não altera o
banco da demonstração automaticamente.

## Testes isolados

Integração e Playwright aceitam `TEST_DATABASE_URL`, ou `DATABASE_URL` apontando para
uma base exclusiva cujo nome contenha `test`, `testing`, `ci` ou `e2e` como palavra
separada por `_` ou `-`. Exemplos: `permaneia_test` e `permaneia_e2e`. Nomes sem essa
identificação são rejeitados antes da gravação de fixtures.

O Playwright inicia seu próprio servidor e não reaproveita uma aplicação local
que possa estar ligada a outro banco. Prepare a base sintética com `IA_EXTERNA=off`
e use a mesma configuração no servidor de teste. No CI, PostgreSQL com pgvector,
migrações e dados sintéticos são criados do zero para cada trabalho.

As regressões verificam revogação de sessão, limites sob pressão de memória,
restrição da base de teste e isolamento de histórico entre dois administradores.
O teste de histórico também envia um autor falso no corpo da pergunta e confirma
que a identidade considerada é a da sessão.

## Rastreabilidade acadêmica

Site e apresentação leem os mesmos indicadores em `data/indicadores-publicos.json`.
Os percentuais identificam população e período. As limitações do motor fuzzy e
das avaliações históricas do assistente estão em
[VALIDACAO-CIENTIFICA.md](VALIDACAO-CIENTIFICA.md). O score é apresentado na escala
de 0 a 1, sem sinal de porcentagem ou interpretação de probabilidade.

O vídeo de demonstração anterior é um registro histórico; não serve para conferir
os indicadores ou a interface desta revisão.

## Respostas extrativas e avaliação

O limite de enumeração agora é compartilhado entre recuperação e transcrição,
evitando que o modo local descarte silenciosamente trechos após o vigésimo.
As respostas pontuais apresentam os trechos como relacionados à pergunta,
sem afirmar que a sobreposição lexical comprove uma resposta correta.

O avaliador valida limiar/data antes de consultar o banco e registra evidência por
pergunta, hash do acervo, commit e modo de execução. A data do CI é fixa; não há
pausa de cota no modo local. Perguntas de conhecimento geral ficam como não
aplicáveis quando nenhum provedor generativo está configurado. As métricas e seus
limites estão em [AVALIACAO-RAG.md](AVALIACAO-RAG.md).
