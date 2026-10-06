# ADR 015: rastro de LLM com Langfuse, ao lado da telemetria propria

Data: 06/10/2026
Situação: aceita

## Contexto

A ADR 014 colocou telemetria no próprio banco: por consulta, o modelo resolvido,
os tokens contados pela API, o custo estimado e a duração, com o agregado em
`/api/observabilidade`. Isso responde **como está o sistema**: latência por
percentil, taxa de recusa, taxa de degradação, custo da semana.

O que ela não responde é **por que esta resposta saiu assim**. A linha do banco
guarda o resultado, não o caminho: quais trechos chegaram ao modelo e com que
similaridade, o que o modelo devolveu antes da verificação, se a resposta foi
substituída por não se apoiar no contexto. Essas são justamente as perguntas que
aparecem quando alguém reclama de uma resposta específica, e foi assim que quatro
dos nove defeitos do projeto foram encontrados: lendo pergunta por pergunta.

## Decisão

Registrar cada consulta também no Langfuse, que é uma ferramenta específica de
observabilidade de LLM, mantendo a telemetria do banco como está.

Quatro decisões dentro dessa:

**Os dois convivem, e não se substituem.** O banco é a fonte do agregado e não
depende de serviço externo nenhum: se o Langfuse sumir, `/api/observabilidade`
continua respondendo. O Langfuse é a lupa para uma execução.

**A etapa de geração vai como `generation`, não como span comum.** É o tipo que
faz o painel somar token e custo. Como a ADR 014 já capturava os dois, eles vão
no rastro em vez de serem reestimados.

**O registro é feito depois do fato, e não embrulhando a execução.** Embrulhar
obrigaria o módulo do RAG a conhecer o rastro em cada ponto, e aí ele deixaria de
ser opcional de verdade. Do jeito que ficou, apagar `lib/rastro-llm.ts` não muda
o comportamento do assistente.

**Falha de rastro é registrada no log, não engolida.** Esta é a lição mais cara
desta semana, e veio de outro projeto da mesma família: lá, o exportador chamava
um método que a versão nova do SDK tinha renomeado, o `try` em volta engoliu o
erro, e **nada foi registrado por horas sem ninguém perceber**. Observabilidade
que falha em silêncio é pior que nenhuma, porque dá a sensação de cobertura.

## Consequências

A instrumentação vive em `instrumentation.ts`, que o Next executa uma vez por
processo. Ela só liga no runtime Node e só com as duas chaves presentes: carregar
o SDK de OpenTelemetry no runtime de borda, onde o middleware roda, quebraria o
deploy inteiro.

Sem `LANGFUSE_PUBLIC_KEY` e `LANGFUSE_SECRET_KEY` configuradas, nada é enviado e
a aplicação sobe igual. Meia configuração não liga: com só uma das chaves, o
cliente subiria e falharia em toda consulta, gastando tempo de rede dentro da
rota do aluno.

Nenhuma credencial passa pelo código do projeto. O SDK lê as próprias variáveis
de ambiente, e os nossos módulos apenas verificam se elas existem.

Um detalhe de quem for conferir: a ingestão tem atraso de alguns minutos.
Consultar logo depois de rodar e não achar nada não prova que nada foi enviado;
prova que nada chegou ainda.
