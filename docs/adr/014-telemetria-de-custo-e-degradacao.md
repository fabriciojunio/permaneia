# ADR 014: telemetria de custo e degradação na própria consulta

Data: 06/10/2026
Situação: aceita

## Contexto

O registro de cada pergunta já existia desde o começo, em `consultas_rag`, e
serviu para encontrar quatro defeitos reais: a pergunta curta que a busca
vetorial não alcançava, a enumeração respondida pela metade, o índice partido
pela cota e o calendário sem saber que dia era hoje. Ele guardava pergunta,
resposta, fontes, similaridade, origem e duração.

Três perguntas que apareceram depois não tinham resposta nesse registro:

1. **quanto custa manter o assistente no ar?** Duração não responde, porque o
   preço é por token e não por segundo. Uma pergunta de enumeração, que recebe o
   documento inteiro no contexto, custa várias vezes uma pergunta pontual de
   mesma duração;
2. **o sistema está degradando?** Quando a cota do provedor acaba, o modo
   extrativo local assume, nada falha e nenhum alerta dispara. A resposta fica
   mais pobre em silêncio. O campo `origem_ia` sempre esteve lá, mas ninguém
   olhava a proporção;
3. **qual modelo respondeu?** O nome configurado é um alias (`-latest`),
   escolhido de propósito para a aplicação não quebrar quando o Google aposenta
   uma versão. O preço disso é não saber qual versão atendeu, e portanto não
   conseguir explicar uma mudança de comportamento meses depois.

## Decisão

Gravar, por consulta, o modelo resolvido, os tokens de entrada e de saída
contados pela própria API e o custo estimado. Expor o agregado em
`/api/observabilidade`, atrás da permissão de auditoria.

Quatro escolhas dentro dessa decisão, e cada uma tem um motivo:

**Tokens vêm do provedor, nunca de estimativa por caractere.** A tokenização é
do modelo. Aproximar por tamanho de texto erra entre 10% e 30% em português, e
erra para mais justamente nas palavras acentuadas, que são a maioria aqui.

**O token de raciocínio entra na conta de saída.** Ele é cobrado, não aparece no
texto devolvido e vem num campo separado (`thoughtsTokenCount`). Somar só os
tokens do candidato faria a estimativa sair sempre abaixo da realidade, e
sobretudo nos modelos mais caros, que é onde errar custa mais.

**Modelo fora da tabela de preço devolve custo nulo, não zero.** O alias muda a
versão sozinho. No dia em que isso acontecer, a estimativa precisa dizer "não
sei o preço deste modelo" em vez de dizer "não custou nada". Por isso o custo
médio é dividido pelas consultas com preço conhecido, e não por todas.

**O preço fica em tabela com data e fonte no código.** Preço de API muda, e o
desta mudou duas vezes em 2026. A resposta da API de observabilidade devolve a
data da conferência junto com o valor: número de custo sem a data da tabela que
o gerou é número sem validade.

## Consequências

A latência passou a ser lida por percentil, e não por média: a média de chamada
a modelo de linguagem é dominada pelo caso comum e esconde a cauda, que é onde o
aluno desiste de esperar.

Aprendemos um limite do p95 escrevendo o teste: com 20 pontos, um único pico
fica acima do 95º percentil por definição e não aparece. Nas primeiras semanas
de uso, com poucas dezenas de perguntas, quem detecta pico isolado é a duração
máxima. Isso está num teste, com o motivo escrito.

As colunas são anuláveis e sem valor padrão. Consulta registrada antes desta
migração não tem como saber quantos tokens gastou, e zero diria que não gastou
nenhum. A migração é aditiva: a versão anterior do código continua gravando sem
elas enquanto a nova não sobe (ver ADR 011).

O custo continua sendo **estimativa**, e a resposta da API diz isso com todas as
letras. O projeto roda no tier gratuito, então não existe fatura para conferir
contra. O dia em que existir, a primeira coisa a fazer é comparar as duas.
