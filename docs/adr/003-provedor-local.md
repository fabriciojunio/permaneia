# ADR 003: Provedor local determinístico como modo de degradação

**Situação:** aceita

## Contexto

O motor de IA embarcado é o Gemini, no tier gratuito. Tier gratuito tem cota
diária, e cota acaba. A rede da sala de aula também cai.

Uma aplicação que responde "erro ao consultar a IA" no meio da apresentação
falha justamente no momento em que precisava funcionar.

## Decisão

Implementar um segundo provedor, que satisfaz a mesma interface `ProvedorIA`,
sem rede e sem dependência:

- **Embedding** por hashing de n-gramas com sinal, 768 dimensões, determinístico
- **Resposta** extrativa: transcreve literalmente os trechos recuperados

O sistema usa o Gemini quando ele está configurado e responde; em qualquer falha,
o provedor local assume. A resposta sempre declara a origem, e a interface mostra
isso ao usuário.

## Justificativa

O compromisso do assistente é não inventar. Um modo que apenas transcreve o
documento honra esse compromisso de forma **mais estrita** que o modo generativo.
O que se perde é fluência, não confiabilidade.

Declarar a origem é obrigatório: uma resposta gerada e uma resposta transcrita
têm garantias diferentes, e esconder qual das duas o aluno está lendo seria
desonesto.

A interface abstrata também paga por si nos testes: eles injetam um provedor
controlado e exercitam o RAG inteiro sem depender de cota, de latência ou de
resposta não determinística.

## Consequências

**A favor.** A aplicação nunca fica indisponível por causa da IA. Os testes de
integração rodam sem cota e de forma determinística. A demonstração funciona sem
internet.

**Contra.** Dois espaços de embedding incompatíveis convivendo no mesmo banco. A
coluna `origem_embedding` e o filtro obrigatório na busca resolvem, mas é
complexidade real. Ver ADR 005.

**Contra.** O limiar de relevância precisa ser diferente para cada provedor,
porque as geometrias são diferentes. Documentado em `docs/AVALIACAO-RAG.md`.
