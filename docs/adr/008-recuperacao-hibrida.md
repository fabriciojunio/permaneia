# ADR 008: recuperação híbrida, vetorial mais léxica

Status: aceita
Data: 22 de agosto de 2026

## Contexto

O assistente recuperava contexto apenas por proximidade vetorial: vetor da
pergunta, `k` vizinhos mais próximos no pgvector, filtro por limiar de
similaridade. Em uso real, com a turma digitando do jeito que digita, esse
desenho falhou de três formas distintas.

**Pergunta curta e genérica.** O registro de consultas mostra "quando vai ser a
prova" com similaridade máxima de 0,69, acima do limiar, e resposta "não
encontrei essa informação no material". O vetor de uma pergunta de cinco
palavras, das quais quatro são vazias, é pouco discriminante: os trechos
recuperados eram aulas quaisquer do cronograma, e a linha da Prova P1 ficava de
fora por centésimos. A palavra que decide a pergunta, "prova", pesa muito pouco
num vetor de 768 dimensões e não pesa nada num limiar.

**Índice partido.** Numa carga de oito documentos seguidos, o provedor externo
recusou duas chamadas por limite de requisições por minuto, a ingestão caiu para
o modo local sem reclamar, e dois documentos foram gravados com vetores de outro
espaço. Como a busca filtra por origem do embedding, e precisa filtrar, esses
documentos ficaram **invisíveis para a busca vetorial**: apareciam na lista de
documentos da disciplina, tinham trechos, e não respondiam nada.

**Provedor fora do ar.** O mesmo mecanismo derruba a busca inteira quando o
provedor está indisponível na hora da pergunta: o vetor da pergunta passa a vir
do modo local, o índice está em Gemini, e a consulta devolve zero linhas. O modo
de degradação existia para a geração de texto, e não para a recuperação.

## Decisão

Recuperar por dois braços independentes e fundi-los por posição:

- **vetorial**: como antes, `k` vizinhos no pgvector, filtrados pelo limiar do
  provedor que gerou o vetor;
- **léxico**: BM25 sobre os trechos da disciplina, com a mesma tokenização do
  provedor local (acento normalizado, palavra vazia removida, radical
  aproximado), exigindo cobertura mínima de metade dos termos de conteúdo da
  pergunta.

A fusão é Reciprocal Rank Fusion com amortecimento 60. Combina posições, e não
pontuações: similaridade de cosseno e BM25 não vivem na mesma escala, e somá-las
exigiria uma normalização arbitrária que muda de sentido a cada corpus.

O braço léxico roda **em memória**, sobre os trechos da disciplina carregados do
banco, e não com busca de texto do Postgres. A razão é escala: uma disciplina
tem dezenas de trechos, não milhões. O que se ganha é usar a mesma tokenização
do resto do sistema, já testada, em vez de depender da configuração
`portuguese` do servidor, que difere entre a máquina de quem desenvolve e o
Postgres gerido. `listarTrechosDaDisciplina` tem teto declarado: acima dele, o
braço léxico passaria a ver só parte do material, e é a hora de levá-lo para
dentro do banco com índice de texto.

## Consequências

A recusa honesta continua sendo a decisão central do sistema, e agora tem dois
critérios em vez de um. O léxico não afrouxa a barreira: exigir metade dos
termos de conteúdo é mais estrito que a similaridade em vários casos. "Qual é o
valor da mensalidade do curso" não casa termo nenhum e continua recusada.

O limiar de similaridade deixou de ser o único botão da recusa. O teste de
integração que verificava "com limiar impossível, sempre admite não saber"
passou a ser duas afirmações: com limiar no teto e pergunta sem termo em comum,
recusa; com limiar no teto e pergunta sobre a Prova P1, o braço léxico recupera
a linha do cronograma e responde. A segunda é a garantia nova.

Cada trecho devolvido declara por qual braço chegou, e a tela mostra isso ao
lado da fonte. Uma fonte encontrada por casamento de termos e outra por
proximidade vetorial têm evidências diferentes, e esconder qual é qual seria o
mesmo tipo de omissão que esconder se a resposta foi gerada ou transcrita.

Custo: uma consulta a mais ao banco por pergunta, e a pontuação BM25 sobre
algumas centenas de trechos. Medido no corpus atual, some no tempo de rede da
chamada ao provedor.

## Alternativas descartadas

**Baixar o limiar de similaridade.** Resolveria a pergunta curta e não resolveria
nenhum dos outros dois casos, ao custo de deixar passar contexto irrelevante em
toda pergunta. A tabela de calibração em `docs/AVALIACAO-RAG.md` mostra a recusa
correta despencando abaixo de 0,60.

**Expandir a pergunta com sinônimos antes de gerar o vetor.** Mais uma chamada ao
provedor por pergunta, mais latência, e continua dependendo do mesmo provedor
que pode estar fora.

**Reindexar tudo no provedor local, abandonando o externo.** Perderia a qualidade
de recuperação do embedding treinado, que é grande: os mesmos pares relevantes
pontuam 0,7 no Gemini e 0,2 no local.
