# Validação científica e rastreabilidade

Revisão documental: 11 de outubro de 2026. Projeto acadêmico da disciplina de
Inteligência Artificial, UNISAGRADO, semestre 2026-2.

## Indicadores externos

| Indicador conferido | Valor e recorte | Fonte primária |
|---|---|---|
| Desistência acumulada na rede privada | 64,7%, ciclo 2020–2024 | [Semesp, Mapa 2026, Indicadores de Trajetória](https://www.semesp.org.br/mapa/edicao-16/brasil/) |
| Desistência acumulada no EAD privado | 68,1%, ciclo 2020–2024 | Mesma fonte |
| Conclusão de bacharelado entre ingressantes no Brasil | 49%, até três anos após a duração prevista | [OCDE, Education at a Glance 2025, nota do Brasil, tabela B5.1](https://www.oecd.org/en/publications/education-at-a-glance-2025_1a3543e2-en/brazil_d42263a0-en.html) |

A definição de desistência acumulada do Semesp inclui ingressantes que
desistiram do curso ou faleceram até o ano de referência. Os valores não são
taxas anuais. Na OCDE, o denominador são ingressantes em bacharelado, e não
todos os jovens do país. Não se deve subtrair ou comparar diretamente esses
percentuais entre fontes.

Foram substituídas as afirmações anteriores de 57,2%, cerca de 61%, 64% e
“um em cada quatro conclui a graduação” porque a documentação não identificava
adequadamente população, período e indicador, e a última afirmação não
corresponde à fonte da OCDE citada. A página usa `data/indicadores-publicos.json`
como fonte dos valores e links.

## O que o motor fuzzy demonstra

- Inferência Mamdani com 27 regras fatoriais, agregação por máximo e centroide
  discretizado. Os testes verificam o comportamento dessa implementação.
- Exemplos e matrículas sintéticas mostram como as regras reagem a frequência,
  notas e acessos. Reproduzir um exemplo não mede sua capacidade de prever evasão.
- O score de 0 a 1 é um índice heurístico. Não é uma probabilidade calibrada,
  um diagnóstico ou uma decisão automática sobre o estudante.
- O critério por nota é uma referência simplificada escolhida para comparação,
  sem evidência de que represente a prática majoritária das instituições.

Para avaliar eficácia, seria necessário definir coorte e desfecho, obter dados
sob autorização e governança adequadas, separar treino/calibração e avaliação
no tempo, comparar referências e medir discriminação, calibração, erros por
subgrupo e efeito das intervenções. Essa avaliação ainda não foi realizada.

## O que a avaliação do RAG demonstra

As métricas registradas em `AVALIACAO-RAG.md` valem para o conjunto de perguntas,
acervo, provedor e configuração descritos em cada execução. O modo local extrai
trechos e não valida a qualidade das respostas generativas do provedor externo.
Citar um documento não prova que todas as afirmações da resposta estão apoiadas
nele. Testes de barreiras também não garantem resistência a toda injeção de prompt.

Resultados históricos devem manter data e configuração originais. Uma alteração
de código ou provedor exige nova execução para sustentar uma métrica atual.
Cobertura de testes de software não mede acurácia científica.
