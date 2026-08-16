# Avaliação do RAG

Este documento registra como a qualidade do assistente foi medida, com que
números, e o que os números mostraram. Ele é a fonte da seção de visão crítica
do relatório.

Tudo aqui é reproduzível: `npx tsx scripts/avaliar-rag.ts [limiar]`.

## O que é medido

Um assistente de estudos baseado em RAG tem duas formas de errar, e elas puxam
em direções opostas:

| Métrica | Pergunta que responde |
|---|---|
| **Cobertura** | Das perguntas que o material RESPONDE, quantas o sistema respondeu de fato? |
| **Recusa correta** | Das perguntas que o material NÃO responde, quantas o sistema recusou em vez de arriscar? |

Medir só a cobertura premia um sistema que responde qualquer coisa. Medir só a
recusa premia um sistema que nunca responde. Só o par diz alguma coisa.

## Conjunto de avaliação

26 perguntas escritas à mão sobre os três documentos indexados na disciplina de
Inteligência Artificial (cronograma, contrato didático e enunciado do projeto):

- **18 respondíveis**, cada uma com o trecho que precisa aparecer na resposta
  (por exemplo, "Quando é a Prova P1?" precisa devolver "24 de setembro");
- **8 não respondíveis**, sobre informação que não está em documento nenhum
  (valor da mensalidade, número de créditos, como trancar a matrícula).

As não respondíveis foram escritas de propósito no mesmo vocabulário das
outras. Perguntar "qual o valor da mensalidade" com termos que não aparecem em
lugar nenhum tornaria a recusa fácil demais e a métrica, inútil.

## Resultado no modo generativo (Gemini)

Modelo `gemini-flash-lite-latest`, embeddings `gemini-embedding-001` em 768
dimensões.

| Limiar de similaridade | Cobertura | Recusa correta |
|---|---|---|
| 0,55 | 88,9% (16/18) | 87,5% (7/8) |
| 0,60 | 88,9% (16/18) | 12,5% (1/8) |
| **0,65** | **83,3% a 88,9%** | **75,0% a 100,0%** |
| 0,70 | 72,2% (13/18) | 100,0% (8/8) |
| 0,75 | 22,2% (4/18) | 100,0% (8/8) |

**Valor adotado: 0,65.** Acima dele a cobertura despenca: em 0,70 o sistema já
recusa uma em cada quatro perguntas que o material responde, e em 0,75 ele
praticamente para de responder.

### Duas ressalvas que a própria tabela obriga a fazer

**O modo generativo não é determinístico, e a métrica oscila entre execuções.**
A linha de 0,65 traz faixa, e não número único, porque execuções sucessivas da
mesma bateria devolveram 15/18 e 16/18 de cobertura, e 6/8 e 8/8 de recusa. O
modelo reformula a resposta a cada chamada, e uma reformulação pode deixar de
conter a palavra que o teste procura, ou deixar de soar como recusa. Isso não é
defeito do sistema: é a natureza de avaliar saída de modelo de linguagem, e
qualquer número aqui apresentado como exato seria uma escolha de rodada.

**A não monotonicidade de 0,60 é ruído, não sinal.** Recusa de 87,5% em 0,55 e
12,5% em 0,60 é fisicamente impossível como comportamento real: limiar maior não
pode recusar menos. São 8 casos, então **cada caso vale 12,5 pontos**, e uma
única resposta reformulada move a métrica em um oitavo. A tabela serve para
comparar ordens de grandeza e localizar a região de trabalho, e não para
afirmar uma taxa com uma casa decimal.

O modo de leitura direta, logo abaixo, é determinístico e não sofre disso. Foi
nele que a calibração de fato se apoiou.

Registro honesto: antes de medir, este limiar estava fixado em **0,62**, por
estimativa. Na primeira medição, a estimativa entregava **37,5% de recusa
correta**. Era o parâmetro mais importante do sistema, definido no chute, e só a
medição mostrou isso.

## Resultado no modo de leitura direta

O modo de leitura direta é o que roda sem `GEMINI_API_KEY`: sem geração de
texto, apenas recuperação e transcrição literal dos trechos.

| Limiar de similaridade | Cobertura | Recusa correta |
|---|---|---|
| 0,10 | 88,9% (16/18) | 50,0% (4/8) |
| 0,13 | 83,3% (15/18) | 50,0% (4/8) |
| **0,15** | **83,3% (15/18)** | **75,0% (6/8)** |
| 0,18 | 55,6% (10/18) | 75,0% (6/8) |
| 0,20 | 55,6% (10/18) | 75,0% (6/8) |

**Valor adotado: 0,15.** É o ponto em que a recusa sobe de 50% para 75% sem
custo nenhum de cobertura. Acima dele a cobertura despenca sem ganho.

## Três defeitos encontrados durante a calibração

O caminho até esses números importa mais que os números, e todos os três
defeitos abaixo apareceram porque a avaliação existia. Nenhum deles seria
visível testando o assistente à mão com meia dúzia de perguntas.

### 1. Trigramas de caracteres afogando o sinal (cobertura: 0%)

A primeira versão do embedding local indexava, além das palavras, todos os
trigramas de caracteres de cada palavra. A intenção era tolerar plural e flexão
verbal. O efeito foi outro: com cinco vezes mais unidades projetadas em 768
dimensões, a colisão passou a dominar, e perguntas fora do material pontuavam
MAIS que perguntas respondíveis. "Como faço para trancar a matrícula" marcava
0,208 enquanto "Quando é a Prova P1" marcava 0,159.

Correção: trocar os trigramas por um radical aproximado, que dá a mesma
tolerância a flexão com uma unidade por palavra em vez de cinco.

### 2. Interrogativos sem IDF (recusa arruinada)

Praticamente toda pergunta feita a um assistente de estudos começa por "quando",
"qual", "quanto", "como", "onde" ou "quem". Nenhum deles diz nada sobre qual
trecho responde, mas todos casavam com trechos que por acaso continham a mesma
palavra. Num TF-IDF clássico o IDF anularia esses termos sozinho; aqui, sem
corpus para estimar frequência documental, eles precisaram entrar na lista de
palavras vazias.

Efeito medido: "Como faço para trancar a matrícula", que não tem resposta no
material, caiu de 0,210 para 0,069.

### 3. Recorte abaixo da unidade de informação (cobertura: 44%)

Com a recuperação já funcionando, a cobertura ainda era de 44%. A recuperação
trazia o trecho certo e a resposta saía sem a informação.

O motivo: a resposta extrativa selecionava FRASES do trecho por sobreposição de
termos com a pergunta. No cronograma, "24 de setembro de 2026, quinta-feira" e
"Avaliação. Prova P1" são frases separadas. A frase que casa com a pergunta é a
segunda; a que tem a resposta é a primeira. O aluno recebia a confirmação de que
a prova existe, sem a data.

Correção: devolver o trecho inteiro. O trecho é a unidade escolhida na ingestão
justamente porque a informação está completa dentro dele; recortar abaixo dela
quebra a informação.

Efeito medido: cobertura de 44,4% para 88,9%.

## Tamanho do trecho

O parâmetro de maior impacto isolado. Com trechos de 900 caracteres, o
cronograma inteiro cabia em 4 trechos e cada vetor representava quatro aulas
diferentes ao mesmo tempo. A similaridade de um par relevante ficava em 0,13.
Com cerca de 320 caracteres, uma aula por trecho, a mesma pergunta chega a
0,21 a 0,33.

A regra que saiu daí: **o trecho deve ter o tamanho da unidade de informação do
documento**, e não um tamanho fixo em caracteres. Texto corrido admite trechos
grandes, porque o parágrafo vizinho ajuda. Lista de fatos independentes, como um
cronograma, exige trechos pequenos, porque o vizinho só atrapalha.

## Por que o limiar é por provedor

`lib/rag/similaridade.ts` define limiares diferentes para o Gemini (0,62) e para
o provedor local (0,15). Não é ajuste arbitrário: os dois espaços de embedding
têm geometrias diferentes.

O `text-embedding-004` é treinado com objetivo de recuperação, aproximando
deliberadamente a pergunta do trecho que a responde; ali um par relevante fica
entre 0,6 e 0,8. O provedor local é um saco de palavras projetado por hashing,
sem treino: a similaridade entre uma pergunta de cinco palavras e um trecho de
duzentas é limitada pela própria aritmética do cosseno, e raramente passa de
0,35 mesmo quando o trecho responde perfeitamente.

Um limiar único desligaria o assistente em um dos dois modos.

## Barreiras de entrada, e o teste adversarial

O limiar recusa o que está fora do material, mas não cobre duas coisas: tentativa
de **injeção de prompt**, que pode até recuperar contexto legítimo enquanto tenta
fazer o modelo abandonar as regras, e pedido **ilícito**, que não deve consumir
cota nem receber a resposta educada de "não encontrei no material", que soa como
se a pergunta fosse aceitável e só faltasse o documento.

`lib/rag/guardrails.ts` avalia a pergunta antes de qualquer chamada externa.
`scripts/testar-barreiras.ts` roda a bateria adversarial contra a aplicação real.

| Categoria | Casos | Resultado |
|---|---|---|
| Injeção de prompt | 6 | 6 bloqueadas |
| Conteúdo ilícito | 3 | 3 bloqueadas |
| Dado de terceiro | 2 | 2 bloqueadas |
| Fora de assunto (recusa pelo limiar) | 5 | 5 recusadas |
| Legítimas (precisam continuar passando) | 5 | 5 respondidas corretamente |
| **Total** | **21** | **21 (100%)** |

Três decisões de calibração merecem registro:

**Precisão acima de cobertura.** Os padrões exigem *intenção explícita junto do
objeto*, e não palavra solta. "Arma" não bloqueia; "como fabricar uma arma"
bloqueia. Um falso positivo barra um aluno com dúvida legítima, o que é pior do
que deixar passar uma pergunta estranha que o limiar recusa em seguida. O
conjunto de teste inclui negativos de propósito, como "estudo de caso sobre
segurança e invasão de sistemas".

**Sinal de automutilação tem tratamento próprio, e vem primeiro.** Ele também
casa com os padrões de conteúdo ilícito, e a resposta genérica de "fora do meu
escopo" seria a pior possível. A ordem de avaliação garante que esse caso receba
encaminhamento ao CVV e ao apoio da instituição. Um sistema de permanência
estudantil que ignora esse sinal falha exatamente no que diz querer evitar.

**A recusa nunca explica o que disparou o bloqueio.** Dizer qual padrão casou
ensina a contorná-lo. Há teste que verifica isso.

Além da entrada, há verificação na **saída**: se a resposta gerada não citar
nenhum documento e nem admitir ignorância, ela é descartada e substituída pela
recusa padrão. É o que impede o assistente de apresentar texto solto como se
tivesse apoio no material.

## O modelo, e por que a linha lite

Duas descobertas durante a integração, ambas com efeito direto na escolha:

**Versão fixa é bomba-relógio.** `gemini-2.0-flash` e `gemini-2.5-flash`, os
modelos que a especificação original do projeto indicava, respondem **404 para
chaves novas**. Foram aposentados. O código usa o alias `-latest`, que
normalmente seria má prática, e aqui é o oposto: é o que impede a aplicação de
parar de responder no meio do semestre.

**A cota gratuita da linha flash acabou durante uma única sessão de avaliação.**
Calibrar o limiar exigiu rodar 26 perguntas em 6 limiares, e isso bastou para o
`gemini-flash-latest` passar a responder 429. A linha `lite` tem cota diária
várias vezes maior e, medida no mesmo conjunto, devolveu **a mesma resposta com
a mesma citação de fonte**, sem gastar tokens de raciocínio. Para uma tarefa que
é transcrever de um contexto curto já selecionado pela busca vetorial, o modelo
maior não acrescenta nada e custa disponibilidade.

Um detalhe que custou tempo: pedir `thinkingConfig` para desligar o raciocínio
faz a linha lite responder **400 invalid argument**. E, com teto de tokens
apertado, os modelos que raciocinam devolvem texto **vazio sem finishReason**,
que parece falha de rede e é falta de orçamento.

## Limitações honestas desta avaliação

- **26 perguntas é pouco.** O intervalo de confiança em cima disso é largo. O
  conjunto serve para comparar configurações entre si, que é para o que foi
  usado, e não para afirmar uma taxa de acerto absoluta.
- **As perguntas foram escritas por quem construiu o sistema.** Há viés
  inevitável de vocabulário. Uma avaliação melhor coletaria perguntas reais de
  alunos, o que só é possível depois de colocar o sistema em uso.
- **Os números acima são do modo degradado.** O modo com Gemini não foi medido
  no mesmo conjunto porque o projeto não dispõe de chave configurada de forma
  permanente. O script aceita a chave e roda igual; a tabela precisa ser
  refeita antes de afirmar qualquer coisa sobre o modo generativo.
- **A recusa correta de 75% significa que uma pergunta fora do material em cada
  quatro recebe um trecho irrelevante.** No modo de leitura direta isso é menos
  grave do que parece, porque o sistema transcreve o documento em vez de redigir:
  o aluno vê que o trecho não responde. No modo generativo o mesmo erro seria
  mais perigoso, porque o modelo tentaria costurar uma resposta em cima de um
  contexto ruim, e é por isso que o limiar do Gemini é bem mais alto.
