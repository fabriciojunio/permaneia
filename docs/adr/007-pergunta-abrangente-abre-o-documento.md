# ADR 007: pergunta de enumeração abre o documento inteiro

Status: aceita
Data: 16 de agosto de 2026

## Contexto

O RAG recupera os `k` trechos mais próximos da pergunta. Para uma dúvida
pontual isso é exatamente certo: "quando é a Prova P1" está numa linha só do
cronograma, e entregar quatro trechos ao modelo já é generoso.

Para uma pergunta de enumeração o mesmo mecanismo produz um erro difícil de
enxergar. Perguntado "qual é o conteúdo das aulas", o sistema respondia:

> A apresentação da disciplina e a Introdução à IA ocorrem na aula de 06 de
> agosto de 2026 [Cronograma de aulas].

A resposta é verdadeira, é citada, e está errada como resposta. O aluno pediu o
semestre e recebeu a primeira aula, porque foi o trecho que ficou em primeiro no
ranking de similaridade. Nada no sistema sinalizava a parcialidade: o
diagnóstico dizia "resposta gerada", as fontes apareciam, a similaridade era
alta. É o pior formato de defeito num assistente de estudos, o que parece
funcionar.

O limite não é do modelo nem do prompt. É de recuperação: o contexto entregue
continha uma aula, e nenhuma instrução faz o modelo citar o que não recebeu.

## Decisão

Classificar a pergunta antes de montar o contexto, com um reconhecedor de
enumeração baseado em expressão regular (`lib/rag/abrangencia.ts`), e trocar a
estratégia de contexto conforme a classe:

- **pontual**: os `K_CONTEXTO` (4) trechos mais próximos, como antes;
- **enumeração**: todos os documentos que contribuíram algum trecho relevante,
  inteiros e em ordem de índice, até o teto de 30 trechos.

O reconhecedor tem duas listas. A de enumeração pega "quais", "liste", "todos
os temas", "conteúdo programático", "o que vai ser estudado", "ementa". A de
marcadores pontuais tem precedência e desarma a primeira: "quais são os
critérios da Prova P1" cita "quais" mas nomeia a parte do material, e devolver o
documento inteiro seria pior que o trecho.

A instrução do sistema ganhou a regra 7, que manda percorrer todo o contexto e
responder em lista curta, uma linha por item. Sem ela o modelo recebia o
cronograma inteiro e continuava resumindo em três frases, ou transcrevia os
materiais de apoio de cada aula e estourava o orçamento de tokens antes de
chegar a novembro.

O modo de leitura direta acompanha: `responderExtrativo` transcreve todos os
trechos recebidos quando a pergunta é de enumeração, em vez dos dois melhores.

## Alternativa descartada: abrir só o documento do trecho campeão

Foi a primeira implementação, e é a mais óbvia: pega o documento do trecho que
ganhou a busca e devolve ele inteiro. O teste de integração derrubou na hora.
Para "quais são os temas das aulas", o trecho campeão veio do **contrato
didático**, que fala de aulas o tempo todo, e o cronograma inteiro ficou de fora
por centésimos de similaridade. A decisão dependia de uma escolha que a busca
vetorial não é confiável o bastante para tomar.

Abrir todos os documentos com trecho relevante custa mais tokens e não depende
de acertar qual documento é o certo.

## Alternativa descartada: aumentar `k` para todas as perguntas

Resolveria a enumeração e estragaria o resto. Contexto grande em pergunta
pontual dilui o sinal, aumenta a chance de o modelo citar o trecho errado e
gasta cota à toa em toda pergunta para beneficiar uma minoria delas.

## Consequências

**A favor.** A bateria de avaliação subiu de 78,3% para 91,3% de cobertura, com
cinco casos novos de enumeração em que o trecho esperado é sempre o ÚLTIMO item
do documento: uma resposta que para no meio acerta o começo e falha o teste.

**Contra.** Uma pergunta de enumeração custa mais tokens, e o teto de 30 trechos
é um limite real: uma disciplina com muito material indexado teria a lista
truncada sem aviso. Aceitável no tamanho de corpus deste projeto, e o ponto
onde mexer se o corpus crescer.

**Risco assumido.** O reconhecedor é lexical e vai errar em fraseados que não
foram previstos. Errar para menos devolve o comportamento antigo, que é o pior
caso conhecido e não uma regressão nova. Errar para mais entrega contexto
demais, e as três barreiras contra alucinação seguem valendo. São 45 casos de
teste fixando a fronteira entre as duas classes.
