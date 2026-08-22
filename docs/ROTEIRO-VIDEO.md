# Roteiro do vídeo tutorial (Parte 2)

**Tema:** "RAG do zero com Dify: como fazer uma IA responder só com base nos seus
documentos"

**Duração alvo:** 10 minutos
**Produção:** gravação e edição pelos integrantes do grupo

---

## Bloco 1, gancho (0:00 a 1:00)

Abrir pelo problema, e não pela ferramenta.

> "Toda vez que você pergunta uma coisa para um modelo de linguagem e ele
> responde com uma data errada, um artigo que não existe ou uma regra que ele
> inventou, isso tem nome: alucinação."

**Na tela:** perguntar a um modelo sem RAG "quando é a Prova P1 de Inteligência
Artificial na Unisagrado?". Ele vai responder alguma coisa. Vai estar errado,
porque ele não tem como saber.

> "Hoje eu mostro como resolver isso sem escrever uma linha de código."

**Cuidado na gravação:** grave essa resposta errada com antecedência e tenha um
print de reserva. O modelo pode se recusar a responder na hora da gravação, e o
gancho perde a força.

---

## Bloco 2, explicação conceitual (1:00 a 3:00)

**O que é RAG.** Buscar informação relevante *antes* de perguntar ao modelo, e
obrigá-lo a responder só com base nela.

**A analogia:** é dar uma prova de consulta ao modelo, em vez de deixá-lo
responder de memória.

**Os três passos, com diagrama simples:**

1. O documento vira pedaços de texto, os *chunks*
2. Cada pedaço vira um vetor numérico, o *embedding*
3. Na pergunta, busca-se os pedaços mais parecidos e eles vão junto ao modelo

**Por que isso reduz alucinação:** o modelo é instruído a citar a fonte e a dizer
que não sabe quando a resposta não está no material fornecido.

**Frase para plantar aqui, e retomar no bloco 5:**

> "Repare que o RAG não deixa o modelo mais inteligente. Ele muda de onde vem a
> informação."

---

## Bloco 3, demonstração prática (3:00 a 8:00)

Tela do Dify, ao vivo.

1. Criar um aplicativo do tipo Chatbot
2. Fazer upload de um PDF real: **o cronograma da própria disciplina**
3. Mostrar a configuração do RAG: tamanho do chunk, modelo de embedding e número
   de resultados recuperados
4. Perguntar **"quando é a Prova P1?"** e mostrar a resposta correta com a fonte
   citada
5. Perguntar **"qual é o valor da mensalidade?"**, que não está no documento, e
   mostrar o sistema admitindo que não sabe

**O momento mais importante do vídeo é o passo 5.** Um assistente que responde
tudo é fácil. O que dá valor é ele saber calar.

**Sugestão de diferencial, se sobrar tempo:** mexer no tamanho do chunk ao vivo,
subindo para um valor grande, e mostrar a qualidade da resposta piorando. É o
achado mais interessante do nosso projeto e quase nunca aparece em tutorial de
RAG: com o cronograma inteiro em quatro pedaços, cada vetor passa a representar
quatro aulas ao mesmo tempo, e a busca deixa de discriminar.

**Terceiro diferencial, e o que mais impressiona ao vivo:** perguntar "qual é a
próxima aula?" e "o que tem na semana que vem?". Um RAG comum recusa as duas,
porque o trecho recuperado diz a data da aula e não diz se ela já passou. No
nosso sistema quem faz a conta de datas é o código, e não o modelo: a agenda é
calculada a partir do cronograma indexado e entregue pronta ao modelo, que só
redige. Vale mostrar a recusa antiga, que está registrada no histórico de
perguntas, ao lado da resposta de hoje.

**Segundo diferencial, também barato de mostrar:** perguntar "qual é o conteúdo
das aulas?" e reparar que o assistente responde com UMA aula, a que ficou em
primeiro na busca. A resposta sai correta e citada, e é metade da verdade. É o
defeito mais perigoso de um RAG, porque nada na tela avisa que ele aconteceu.
No nosso sistema a correção foi trocar a estratégia de contexto quando a
pergunta pede uma relação.

---

## Bloco 4, casos de uso (8:00 a 9:30)

- Atendimento ao cliente sobre a base de conhecimento real da empresa
- Assistente jurídico restrito à legislação vigente
- Ferramenta de estudo baseada apenas no material da disciplina, que é o gancho
  de volta para a Parte 1

**Mencionar o limite honesto:** o RAG resolve alucinação, não desatualização. Se
o documento indexado estiver velho, o sistema responde com confiança e cita a
fonte, e está errado. Por isso todo documento precisa de data visível.

---

## Bloco 5, fechamento (9:30 a 10:00)

Retomar a frase plantada no bloco 2:

> "RAG não deixa a IA mais inteligente. Deixa ela mais honesta."

Créditos: Camila Pereira Raimundo, Fabrício Júnio Almeida Dias, Kauã Limão
Nunes e Luan Padilha Miranda. Disciplina, professor e data.

---

## Checklist de produção

- [ ] Gravação em 1080p no mínimo
- [ ] Áudio testado antes, sem eco de ambiente
- [ ] Resposta errada do bloco 1 gravada com antecedência, com print de reserva
- [ ] PDF do cronograma pronto na área de trabalho, para não procurar arquivo ao vivo
- [ ] Conta do Dify já criada e logada
- [ ] Nenhum dado pessoal visível na tela: fechar abas, notificações e e-mail
- [ ] Cortes a cada 30 segundos no máximo, mantendo o ritmo
- [ ] Legendas, que ajudam a acessibilidade e a nota de didatismo
- [ ] Créditos finais com os nomes dos quatro integrantes

## Relação com a Parte 1

O vídeo usa Dify e a aplicação entregue usa código próprio. Isso é proposital e
vale ser dito em uma frase no bloco 4: o protótipo no Dify foi o primeiro passo
do nosso projeto, e migramos para código quando precisamos controlar o limiar de
relevância, que é o parâmetro que decide entre responder e admitir ignorância.
Essa limitação do Dify é uma observação crítica legítima e mostra que o grupo
usou a ferramenta de verdade.
