# ADR 010: rastro distribuído no formato do W3C

Status: aceita
Data: 4 de setembro de 2026

## Contexto

O sistema já correlacionava requisições. O middleware gerava um UUID por
requisição, punha em `x-request-id`, devolvia no envelope de erro, e a pessoa
que relatasse um problema podia ler o número na tela. Com esse número, a linha
aparece no log da Vercel. Isso resolve o caso de suporte e não resolve mais
nada.

O que ficou de fora foram as perguntas que apareceram no uso real, e todas elas
são sobre **onde o tempo foi parar**:

- Uma pergunta ao assistente leva de 900 ms a 4 s. Quanto disso é a busca
  vetorial no Postgres, quanto é a busca léxica em memória e quanto é a chamada
  ao Gemini? O log registrava a duração total e mais nada.
- A ingestão de um PDF de vinte páginas dispara uma consulta por trecho. Quando
  isso vira lentidão, o log mostra "ingestão concluída em 40 s" e nenhuma linha
  entre o começo e o fim.
- A chamada ao Gemini falha por limite de requisições. A linha do erro existe,
  mas não fica ligada à pergunta do aluno que a provocou, porque as duas foram
  registradas por caminhos diferentes.

Havia também um problema menor e chato: `x-request-id` é convenção, não padrão.
Cada plataforma usa um nome, e nenhum coletor de telemetria procura por ele.

## Decisão

Adotar `traceparent`, do W3C Trace Context, como identificador de correlação, e
publicar **trechos** dentro de cada requisição.

O middleware lê o `traceparent` que chegou e continua o rastro do cliente,
quando ele existe; quando não existe, que é o caso do navegador, abre um novo. O
trecho aberto é sempre **filho**, e nunca a continuação do mesmo identificador:
quem chamou e quem atendeu são trabalhos separados, com duração própria.

O identificador que aparece no envelope de erro passou a ser o `traceId` do
padrão, e `x-request-id` carrega o mesmo valor. Dois números diferentes
significam a pessoa lendo um na tela enquanto o log guarda o outro.

O rastro fica num `AsyncLocalStorage` estabelecido em `comTratamentoDeErro`, que
é o ponto por onde todas as rotas passam. Estabelecido ali, ele vale para tudo
que roda abaixo sem que nenhuma função precise recebê-lo por parâmetro.

Sobre esse contexto, o cliente do Prisma ganhou uma extensão que publica **um
trecho por consulta ao banco**, com a operação, o modelo e a duração. Instrumentar
o cliente inteiro, e não repositório por repositório, é o que pega também o que
o Prisma emite por conta própria.

**O que não vai para o trecho: o valor dos parâmetros.** Telemetria sai da
aplicação e fica guardada em outro lugar; matrícula, e-mail e nome de aluno não
têm por que passear por lá (ver `LGPD.md`). O gabarito da consulta, com os
marcadores no lugar dos valores, basta para identificar qual consulta é.

## Consequências

O destino de um trecho hoje é **o log estruturado, e não um painel de rastros**.
Não há coletor configurado, e não vale a pena fingir que há: a linha sai em
nível `debug`, com `traceId`, `spanId`, nome e duração, e a investigação é
filtrar por `traceId` na busca da Vercel. Os nomes dos campos seguem o
OpenTelemetry (`db.system`, `db.operation`, `db.statement`) para que ligar um
coletor um dia seja trocar a função `emitirTrecho`, e não reescrever quem a
chama.

O nome do trecho é a operação e a tabela, nunca o comando inteiro: `db select
chunk`, e não o SQL da busca vetorial. Log e painel agrupam por nome, e com o
comando inteiro no nome cada consulta viraria um grupo de uma linha só. A
pergunta que se quer responder, "qual consulta está lenta em geral", deixaria de
ter resposta.

`lib/rastro.ts` é puro de propósito, sem `node:async_hooks` e sem `next/headers`:
o middleware roda no runtime de borda, onde importar `node:async_hooks` quebra o
build sem produzir nenhum aviso útil. O contexto por requisição mora em
`lib/rastro-ativo.ts`, importado só de dentro do runtime Node.

Custo: uma linha de log a mais por consulta, em nível `debug`, que em produção
não é emitido a não ser que `LOG_NIVEL` seja baixado. O `AsyncLocalStorage` é
uma leitura de ponteiro por acesso.

## Alternativas descartadas

**Instalar o SDK do OpenTelemetry.** É o caminho certo quando existe um coletor.
Aqui traria a dependência inteira, com a instrumentação automática que carrega
no arranque da função serverless, para exportar em seguida para lugar nenhum. O
formato adotado é o mesmo, então trocar depois é trabalho local.

**Continuar com `x-request-id` e só acrescentar durações.** Resolveria a pergunta
"onde o tempo foi parar" dentro de um processo, e manteria o sistema incapaz de
juntar seu rastro ao de qualquer outro. O padrão custou o mesmo trabalho.

**Instrumentar os repositórios um a um.** Pegaria só as consultas que alguém
lembrou de instrumentar. A consulta que interessa no dia da investigação é
justamente a que ninguém escreveu de propósito.
