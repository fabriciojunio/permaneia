# ADR 005: Coluna vetorial como tipo Unsupported do Prisma

**Situação:** aceita

## Contexto

A busca por similaridade usa a extensão `pgvector`. O Prisma não tem tipo nativo
para `vector`.

## Decisão

Declarar a coluna como `Unsupported("vector(768)")` no schema. O Prisma cria e
migra a coluna normalmente; leitura e escrita passam por SQL parametrizado nos
repositórios.

A dimensão 768 vem do `text-embedding-004` do Gemini. O provedor local produz
vetores do mesmo tamanho de propósito, para que a coluna não precise mudar.

## Justificativa

Alternativas descartadas:

- **Abandonar o Prisma** por causa de uma coluna. O resto do modelo se beneficia
  muito do cliente tipado.
- **Guardar o embedding como JSON** e calcular a similaridade na aplicação. Isso
  inviabilizaria o índice vetorial e traria todos os trechos da disciplina para a
  memória a cada pergunta.

## Consequências

**A favor.** Prisma tipado para tudo, SQL apenas onde ele não alcança.

**Contra.** As consultas vetoriais não têm verificação de tipo em tempo de
compilação. Mitigado por testes de integração contra banco real, que exercitam a
serialização do vetor, o operador de distância e os filtros.

**Regra que não pode ser quebrada:** o vetor entra **parametrizado**, nunca
interpolado na string da consulta. Concatenar o literal seria injeção de SQL
esperando acontecer.

**Filtro obrigatório por origem.** Vetores do Gemini e do provedor local vivem em
espaços completamente diferentes. Comparar um com o outro produz um número que
parece uma similaridade e não significa nada. Toda busca filtra por
`origem_embedding`, e há teste de integração que falha se o filtro sumir.

**Filtro obrigatório por disciplina.** Pelo mesmo rigor: sem ele, a pergunta
sobre a Prova P1 de Inteligência Artificial recuperaria o cronograma de Teoria
dos Grafos e a resposta viria com a data errada.
