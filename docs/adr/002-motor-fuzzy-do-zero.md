# ADR 002: Motor fuzzy escrito do zero, sem biblioteca

**Situação:** aceita

## Contexto

A especificação previa `scikit-fuzzy`. Com a decisão do ADR 001, a aplicação
passou a ser TypeScript, e não existe equivalente maduro de `scikit-fuzzy` em
JavaScript.

Havia duas saídas: manter um serviço Python só para o cálculo fuzzy, ou
implementar o método Mamdani diretamente.

## Decisão

Implementar o método Mamdani do zero, em TypeScript, como função pura.

## Justificativa

O que começou como restrição virou a melhor decisão técnica do projeto.

**As quatro etapas ficam explícitas.** Fuzzificação, inferência por mínimo,
agregação por máximo e defuzzificação por centroide aparecem como código legível
em `lib/fuzzy/motor.ts`. Numa apresentação de disciplina de IA, mostrar as etapas
vale mais que mostrar uma chamada de biblioteca.

**A função é pura.** Sem I/O e sem estado, o motor inteiro é testável por tabela.
São mais de 500 testes só sobre ele, incluindo varredura em grade de 26.460
comparações verificando monotonicidade.

**O artefato do método ficou visível.** Descobrimos, medimos e documentamos a
inversão do centroide perto da fronteira entre termos (relatório, seção 4.6).
Com biblioteca, o comportamento seria o mesmo e teria passado despercebido.

## Calibração da base de regras

O ponto de partida foi uma soma ponderada dos três sinais, com pesos que
refletem o que a literatura sobre evasão descreve: a presença é o sinal mais
forte, o engajamento vem logo atrás, e a nota é o indicador que chega por último.

A tabela resultante foi então revisada linha a linha e ajustada onde o número
contrariava o bom senso pedagógico. O caso mais claro foi frequência baixa com
notas baixas: a fórmula colocava a combinação com engajamento alto em "alto", e
a revisão a moveu para "crítico", porque acesso intenso à plataforma sem
presença e sem nota costuma ser tentativa tardia de recuperar o que já se perdeu.

## Consequências

**Contra.** Mais código para manter, e a responsabilidade de acertar o método é
nossa. Mitigado pela cobertura de teste.

**Contra.** Não há validação cruzada contra uma implementação de referência.
Fica registrado como trabalho futuro exportar os casos e comparar com
`scikit-fuzzy`.
