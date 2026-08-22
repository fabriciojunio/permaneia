# ADR 009: agenda calculada pelo domínio, e a terceira saída da resposta

Status: aceita
Data: 22 de agosto de 2026

## Contexto

Duas perguntas reais, feitas pela turma e registradas em `consultas_rag`, foram
recusadas com o cronograma inteiro indexado e seis trechos dele no contexto:

| Pergunta | Similaridade | Resposta |
|---|---|---|
| "Quando é a proxima aula" | 0,721 | "não encontrei essa informação" |
| "na materia da semana que vem vai ter o que?" | 0,664 | "não encontrei essa informação" |

A recuperação funcionou: os trechos eram do cronograma. O que faltava era outra
coisa. Um trecho diz "20 de agosto de 2026, quinta-feira. Aula normal. Busca
heurística." e não diz se essa aula já aconteceu. Responder "qual é a próxima"
exige comparar vinte datas com o dia de hoje, e isso é aritmética, não
recuperação. Um modelo de linguagem faz essa conta, mas erra em silêncio, e o
sistema não teria como saber que errou.

Havia um segundo problema, de outra natureza. Perguntas como "como funciona o
trancamento de matrícula" ou "o que é uma heurística admissível" recebiam
recusa, porque não estão nos documentos indexados. É a recusa correta segundo a
regra em vigor e é a resposta errada para quem perguntou: são exatamente as
dúvidas que um assistente de estudos existe para atender.

## Decisão

**A agenda é calculada em código.** `lib/rag/calendario.ts` lê as datas por
extenso dos trechos indexados, escolhe o documento com mais dias distintos como
sendo o calendário da disciplina, e devolve um bloco pronto com o último
encontro realizado, o próximo, o que cai na semana que vem e a próxima
avaliação, cada um com a diferença de dias já resolvida. O bloco entra no prompt
como `<agenda>` quando a pergunta é temporal, e o modelo só o transforma em
frase.

A divisão é a mesma que o projeto usa no motor fuzzy: **quem calcula é o
domínio, quem redige é o modelo.** No modo de leitura direta, sem provedor
externo, a agenda é transcrita literalmente, e a pergunta temporal continua
sendo respondida.

**A resposta fora do material é a terceira saída.** Quando o acervo não responde
e o assunto ainda é do assistente, o sistema responde com o conhecimento geral
do modelo. O recorte está em `lib/rag/escopo.ts` e tem dois assuntos: a vida
acadêmica e a instituição, e o conteúdo das disciplinas do professor. Fora
deles, a recusa continua sendo a resposta, e é isso que mantém "quem ganhou a
Copa de 2022" fora do escopo.

Três coisas seguram essa saída:

1. **O aviso é escrito pelo código, não pelo modelo.** Toda resposta desse tipo
   começa por "Isso não está no material da disciplina". Pedir ao modelo que
   avise seria cumprido quase sempre, e "quase sempre" não serve para a
   fronteira entre o que tem fonte e o que não tem.
2. **A instrução proíbe número.** O modelo pode explicar como funciona um
   trancamento; não pode dizer o prazo, o valor, a nota mínima nem o nome de
   quem coordena o curso. Para tudo isso a resposta é onde confirmar.
3. **A lista de fontes fica vazia e a tela muda de traço.** A resposta com fonte
   e a resposta sem fonte não podem se parecer.

## Consequências

`admitiuNaoSaber` continua verdadeiro nas respostas fora do material, e isso é
proposital: o campo sempre significou "o sistema declarou que não achou isso no
acervo", e é o que a primeira linha da resposta diz. As métricas de recusa
correta seguem medindo a mesma coisa que mediam antes, e a bateria adversarial
não muda de resultado.

O custo é uma chamada a mais ao provedor nas perguntas que caem nessa saída, e
elas são minoria. Sem provedor externo a terceira saída não existe: o modo local
só transcreve documento, e aqui não há documento para transcrever. Nesse caso a
recusa volta a ser a resposta, o que é o comportamento correto.

O reconhecedor de pergunta temporal e o de escopo são listas de expressões
regulares, com o mesmo defeito conhecido do reconhecedor de enumeração: erram
nas bordas. A escolha se mantém pela mesma razão da ADR 007: são inspecionáveis,
testáveis caso a caso e não custam uma chamada de rede para classificar cada
pergunta.

## Alternativas descartadas

**Deixar o modelo fazer a conta de datas com a data de hoje no prompt.** Foi o
que existia, e é o que falhou: a data de hoje já estava lá quando as duas
perguntas foram recusadas. Com os trechos certos e a data certa, ainda falta ao
modelo saber que aquele conjunto de aulas é o calendário inteiro.

**Guardar as aulas numa tabela estruturada, em vez de derivá-las do texto.**
Seria mais robusto e muda o produto: passaria a exigir que a coordenação
cadastre o cronograma campo a campo, em vez de subir o documento que já existe.
A derivação a partir do texto indexado mantém a promessa de que basta enviar o
material.

**Liberar o conhecimento geral para qualquer pergunta.** Transformaria o
assistente de estudos num chatbot genérico com um cronograma anexado, que é
exatamente o que este projeto se propôs a não ser.
