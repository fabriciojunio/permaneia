# ADR 013: o banco sai do Supabase e vai para o Neon

Status: aceita
Data: 4 de setembro de 2026

## Contexto

Em 4 de setembro de 2026 o sistema publicado parou de responder consulta
nenhuma. A página inicial devolvia 200, o assistente e o painel não
funcionavam, e `/api/health` acusava `banco: indisponivel`.

O diagnóstico: o host do projeto, `kdlmuwhixjixduwljbum.supabase.co`, **não
existia mais no DNS**, enquanto o pooler compartilhado do Supabase resolvia
normalmente. O pooler respondia `tenant/user not found`.

A causa é política de plataforma, e não defeito: **o Supabase na camada gratuita
pausa o projeto depois de sete dias sem nenhuma conexão**, e despausar é manual,
pelo painel. Um sistema que fica semanas parado entre uma aula e outra atende
exatamente essa descrição. Pior: o modo de falha é silencioso do lado de fora,
porque a Vercel continua servindo a página.

Vale dizer o que isso custou: a base teve que ser semeada de novo, e as
perguntas já feitas ao assistente, que eram registro de uso real, se perderam.

## Decisão

Migrar para o Neon, em `aws-sa-east-1`.

O que decidiu, em ordem:

1. **A camada gratuita não expira e não exige despausar à mão.** O compute
   suspende por inatividade e acorda sozinho na conexão seguinte, em cerca de
   meio segundo. Ninguém precisa clicar em nada.
2. **Traz `pgvector`**, sem o qual metade da recuperação não funciona.
3. **Existe em São Paulo**, que é onde o banco já estava e onde estão os
   usuários.
4. Já é o banco de outros dois sistemas do mesmo autor, então a operação é
   conhecida.

Dois papéis, como antes:

- `permaneia_web`, usado pela aplicação, pelo endpoint com pooler. Só lê e
  escreve linha. `CREATE TABLE` responde "permission denied for schema public"
  e `DROP TABLE usuarios` responde "must be owner of table";
- `permaneia_app`, dono do banco, usado apenas pela conexão direta para aplicar
  esquema.

## Consequências

**A Row Level Security saiu, e é honesto dizer por quê.** Ela existia para
fechar uma superfície específica do Supabase: a API REST publicada sobre as
tabelas, alcançável com a chave pública do projeto. Com a RLS ligada e sem
política para `anon` e `authenticated`, aquela porta não devolvia linha nenhuma
mesmo com a chave vazada.

O Neon não publica API sobre o banco. A única porta é uma conexão Postgres
autenticada. Uma política que libera tudo para o papel da aplicação, e ele é o
único que conecta, não acrescentaria segurança nenhuma — só a aparência dela. O
que continua valendo, e é o que sempre carregou o peso, é o privilégio mínimo do
papel da aplicação.

O fluxo `manter-banco-acordado.yml`, escrito no mesmo dia por causa da pausa,
continua existindo com um propósito menor e verdadeiro: manter o compute quente,
para quem abrir o link não esperar nem o meio segundo, e servir de monitor de
fumaça diário do caminho até o banco.

O `.env.example` passou a explicar as duas URLs pelo que elas são — papéis
diferentes, e não só endereços diferentes — porque a confusão entre as duas foi
o que gerou, no Supabase, o erro sobre transação preparada que ninguém sabia
interpretar.

## Alternativas descartadas

**Restaurar o projeto no Supabase e seguir.** Era o caminho de menos trabalho, e
resolvia até a próxima janela de sete dias. O keep-alive diário reduziria o
risco sem eliminá-lo: agendamento em camada gratuita do GitHub é promessa, não
garantia, e já medimos, em outro repositório, quatro execuções entregues em
dezenove horas quando dez tinham sido pedidas por hora.

**Postgres gratuito do Render.** Expira em trinta dias, o que mataria a
demonstração no meio do semestre, e não traz `pgvector`.

**Subir um Postgres em contêiner num servidor próprio.** Resolve a dependência
de plataforma e cria a de manter um servidor, com backup e atualização de
segurança, para um trabalho de disciplina.
