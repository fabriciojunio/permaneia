# Relatório do Projeto Prático de IA Generativa

## PermaneIA: assistente de estudo e alerta de risco de evasão

**Disciplina:** Inteligência Artificial, turma de quinta-feira, 2026-2
**Professor:** Patrick Pedreira Silva
**Instituição:** Unisagrado
**Grupo 1:** Camila Pereira Raimundo, Fabrício Júnio Almeida Dias, Ian Felipe
Amaral Oliveira Silva, Kauã Limão Nunes, Luan Padilha Miranda, Lucas Massamiti
Tsuji
**Entrega:** 19 de novembro de 2026

**Aplicação em produção:** <https://permaneia.vercel.app>
**Código-fonte:** <https://github.com/fabriciojunio/permaneia>

---

## 1. Descrição da aplicação

### 1.1 O problema escolhido

A evasão no ensino superior brasileiro é um dos problemas mais documentados da
educação do país:

| Indicador | Valor | Fonte |
|---|---|---|
| Evasão no ensino superior | 57,2% | Mapa do Ensino Superior 2024, Instituto Semesp |
| Evasão na rede privada | ~61% | Mapa do Ensino Superior 2026, Semesp |
| Evasão em cursos a distância | 64% | Mapa do Ensino Superior 2026, Semesp |
| Jovens que concluem a graduação iniciada | 1 em 4 | OCDE, Education at a Glance 2025 |

O grupo escolheu esse problema porque ele é vivido diretamente: somos alunos de
uma instituição privada, com os fatores de risco que a literatura descreve.

A premissa que organiza todo o projeto vem dessa literatura: **o abandono é
precedido por desengajamento, e não por notas ruins.** O aluno para de acessar a
plataforma semanas antes de a média cair, e meses antes de formalizar o
trancamento. Quem monitora apenas a nota chega tarde, quando a decisão de sair
já foi tomada.

### 1.2 Como a solução ataca o problema

O PermaneIA tem dois lados, cada um com uma técnica de IA distinta.

**Lado aluno: assistente de estudos com RAG.** Responde dúvidas sobre a
disciplina usando exclusivamente os documentos institucionais indexados. A
resposta cita a fonte, e quando a informação não está no material o sistema diz
que não sabe.

**Lado coordenação: painel de risco com lógica fuzzy.** A turma aparece ordenada
por um score contínuo de risco de evasão, com a explicação das regras que
produziram cada número e uma ação sugerida.

Os dois lados não se sobrepõem no controle de acesso, e essa foi uma decisão
deliberada e não um esquecimento: a coordenação não alcança o assistente, o
aluno não alcança o painel, e as permissões dos dois papéis operacionais são
disjuntas fora do que a LGPD obriga. Coordenação não é "aluno com mais poder":
é outra função, com outra tela. Uma pergunta feita pela coordenação entraria no
histórico de consultas como se fosse dúvida de aluno, e o histórico é o que
mostra onde o material da disciplina está falhando.

### 1.3 O resultado que sustenta a escolha

O sistema em produção, consultado com os sinais de um aluno com **média 8,6,
frequência 34% e 2 acessos à plataforma**, devolve:

```
score fuzzy: 0.675  |  faixa: alto
critério por nota: sem risco  |  divergem: true
regra dominante: 8, "Bom desempenho não anula a ausência sistemática das
aulas; o histórico apenas atrasa o efeito na média."
```

Este é o aluno que o critério da secretaria não enxerga. É o motivo de o projeto
existir.

---

## 2. Ferramentas utilizadas

### 2.1 Ferramentas de IA generativa exploradas

| Ferramenta | Uso no projeto | Vantagem observada | Limitação observada |
|---|---|---|---|
| ChatGPT | Brainstorm da estrutura de dados e dos critérios do score | Rápido para gerar alternativas de modelagem e discutir trade-offs | Sugere estruturas plausíveis mas genéricas; não conhece as restrições reais da instituição |
| Claude | Estruturação da documentação técnica e escrita de código | Bom em texto longo com coerência interna e em explicar decisões | Tende a escrever mais do que o necessário se não for contido |
| Gemini | Motor de produção embarcado: geração de texto e embeddings | Único provedor gratuito com geração **e** embeddings, sem cartão; forte em português | Cota diária acaba rápido na linha flash, e versões nomeadas são aposentadas sem aviso |
| Grok | Teste comparativo de respostas sobre conteúdo universitário | Tom mais direto que os concorrentes | Sem tier gratuito de API e **sem endpoint de embeddings**; inviável como motor deste projeto |
| Cursor | Desenvolvimento do código com apoio de IA | Reduz muito o tempo de código repetitivo (rotas, validações, testes de tabela) | Precisa de revisão em tudo que envolve regra de negócio; erra em silêncio no que parece certo |
| Dify | Prototipagem do RAG antes de migrar para código | Monta um RAG funcional em minutos, sem código | Não permite controlar o limiar de relevância nem instrumentar a decisão de recusar; foi exatamente por isso que migramos |

### 2.2 Por que o Gemini foi o motor embarcado

Separamos deliberadamente **ferramentas testadas manualmente** (seção 2.1, todas
gratuitas via chat) de **IA embarcada no código**, chamada via API a cada uso.

Para o motor embarcado, o requisito era não custar dinheiro. Mas o critério que
de fato decidiu não foi o preço, e sim uma exigência da arquitetura: **um sistema
de RAG precisa de duas coisas do provedor, geração de texto e embeddings.**

| Provedor | Geração gratuita | Embeddings gratuitos | Veredicto |
|---|---|---|---|
| **Google Gemini** | sim, sem cartão | sim, `gemini-embedding-001` | **escolhido** |
| Grok (xAI) | não, API paga por token | não oferece endpoint | descartado |
| Groq Cloud | sim, rápido | **não oferece** | inviável sozinho |
| Mistral | tier gratuito | limitado | segunda opção |
| Cohere | tier de avaliação | sim | proibido para uso não experimental |

Groq e Grok são empresas diferentes, e nenhum dos dois resolve o problema: o Grok
não tem tier gratuito de API, e o Groq, apesar de gratuito e rápido, **não tem
endpoint de embeddings**. Usá-lo exigiria um segundo provedor só para os vetores,
dobrando a superfície de falha para economizar nada.

O Gemini é o único que fecha as duas pontas de graça e sem cartão de crédito.

**Duas descobertas durante a integração**, ambas com efeito direto no código:

*Versão fixa de modelo é bomba-relógio.* O `gemini-2.0-flash` e o
`text-embedding-004`, indicados na especificação original deste projeto,
respondem **404 para chaves novas**. Foram aposentados. O código passou a usar o
alias `-latest`, que normalmente seria má prática e aqui é o oposto: é o que
impede a aplicação de parar de responder no meio do semestre.

*A cota da linha flash acabou durante uma única sessão de calibração.* Rodar 26
perguntas em 6 limiares bastou para o modelo passar a responder 429. Trocamos
para a linha `lite`, cuja cota diária é várias vezes maior e que, medida no mesmo
conjunto, devolveu **a mesma resposta com a mesma citação de fonte**. Para
transcrever de um contexto curto já selecionado pela busca vetorial, o modelo
maior não acrescenta nada e custa disponibilidade.

### 2.3 A decisão que fez diferença: o provedor local

O sistema tem um **segundo provedor**, escrito do zero, sem rede e sem
dependência: um embedding por hashing de n-gramas e uma resposta extrativa que
transcreve literalmente os trechos recuperados.

Ele existe porque a cota do tier gratuito acaba, e porque a rede da sala pode
cair no meio da apresentação. Sem chave configurada, o sistema **continua
respondendo**, só que sem redigir texto novo.

Isso não é uma limitação aceita a contragosto. O compromisso do assistente é não
inventar; um modo que apenas transcreve o documento honra esse compromisso de
forma **mais estrita** que o modo generativo. O que se perde é fluência, não
confiabilidade. A interface declara qual modo está em uso a cada resposta.

---

## 3. Processo de desenvolvimento

### 3.1 Arquitetura

```
Navegador
   │  HTTPS
   ▼
Next.js (App Router) na Vercel
   │
   ├── middleware.ts        sessão, anti-CSRF, papéis, cabeçalhos de segurança
   ├── app/api/…            rotas REST
   └── lib/
       ├── fuzzy/           motor Mamdani escrito do zero
       ├── rag/             chunking, similaridade, prompt, consulta
       ├── ia/              provedor Gemini e provedor local
       └── repositorios/    Prisma e SQL da busca vetorial
   │
   ▼
Postgres (Neon) com pgvector
```

### 3.2 Modelo de dados

Oito tabelas: `usuarios`, `alunos`, `disciplinas`, `matriculas`, `documentos`,
`documento_chunks`, `consultas_rag` e `registros_auditoria`.

Duas decisões merecem registro:

**Documento separado de trecho.** A especificação inicial previa uma tabela só.
Separar permite guardar a *referência* do documento (a data ou versão) uma única
vez e citá-la em toda resposta. É o campo mais importante do sistema, pelo motivo
da seção 4.4.

**A coluna `embedding` é `vector(768)`.** O Prisma não tem tipo nativo para ela,
então é declarada como `Unsupported`: ele cria e migra a coluna, mas leitura e
escrita passam por SQL parametrizado nos repositórios (ADR 005).

### 3.3 O sistema fuzzy

**Variáveis de entrada e seus conjuntos:**

| Variável | Universo | Conjuntos |
|---|---|---|
| `frequencia_percentual` | 0 a 100 | baixa `trapz(0,0,40,60)`, média `trapz(50,63,72,85)`, alta `trapz(80,90,100,100)` |
| `media_notas` | 0 a 10 | baixa `trapz(0,0,3,5)`, média `tri(4;5,5;7)`, alta `trapz(6.5,8,10,10)` |
| `engajamento` | 0 a 10 | baixo `trapz(0,0;1,5;3)`, médio `tri(2,4,6)`, alto `trapz(5,7,10,10)` |

**Saída:** `risco_evasao` de 0 a 1, com quatro conjuntos: baixo, médio, alto e
crítico. Quatro, e não três, porque a coordenação precisa separar "acompanhar" de
"procurar hoje": a diferença muda a ação, não só o rótulo.

**Normalização do engajamento.** O banco guarda acessos brutos. A conversão para
a escala de 0 a 10 é logarítmica, porque a diferença entre 0 e 5 acessos diz
muito mais sobre o vínculo do aluno do que a diferença entre 60 e 65.

**Base de regras: fatorial completa, 27 regras.** Três variáveis com três termos
cada dão 3×3×3 = 27 combinações, e todas as 27 estão escritas. Não é excesso de
zelo: com a base completa, nenhuma entrada cai num vazio e a saída nunca vem de
uma agregação vazia. Um teste verifica essa completude e falha se alguém remover
uma linha.

**As quatro regras exigidas no enunciado do projeto:**

| Regra | Antecedente | Consequente |
|---|---|---|
| 1 | frequência baixa E notas baixas E engajamento baixo | crítico |
| 7 | frequência baixa E notas altas E engajamento baixo | **alto** |
| 14 | frequência média E notas médias E engajamento médio | médio |
| 27 | frequência alta E notas altas E engajamento alto | baixo |

A regra 7 é o coração do projeto.

**Método de inferência:** Mamdani puro, implementado do zero.

1. Fuzzificação: valor nítido para grau de pertinência
2. Inferência: força de disparo pelo mínimo (norma T)
3. Agregação: recorte do consequente e união pelo máximo
4. Defuzzificação: centroide sobre o universo discretizado em 1000 passos

O centroide foi escolhido porque leva em conta a área inteira do conjunto
agregado. Um aluno com uma regra "crítico" fraca e uma "médio" forte recebe um
score intermediário, que é exatamente a gradação que justifica usar fuzzy. A
média dos máximos descartaria a regra mais fraca e devolveria o degrau que
estamos tentando evitar.

### 3.4 O pipeline de RAG

**Ingestão:** limpeza do texto extraído do PDF, divisão em trechos respeitando
fronteiras de parágrafo e frase, geração dos vetores em lote e gravação com a
origem do embedding marcada.

**Consulta**, em sete passos, e a ordem importa:

1. Gera o vetor da pergunta
2. Busca os trechos mais próximos **dentro da disciplina**
3. Descarta o que não passa do limiar de relevância
4. **Se não sobrou nada, responde que não sabe e para aqui**
5. Remove trechos redundantes e monta o contexto
6. Chama o provedor de IA, com degradação para o modo extrativo
7. Confere se a resposta cita alguma fonte, registra e devolve

### 3.5 Barreiras contra uso indevido

Antes de qualquer chamada externa, a pergunta passa por `lib/rag/guardrails.ts`,
que barra três coisas que o limiar de similaridade não pega:

| Categoria | O que barra | Por que o limiar não basta |
|---|---|---|
| Injeção de prompt | "Ignore as instruções", "mostre seu system prompt", "aja como" | A pergunta pode até recuperar contexto legítimo; o alvo é fazer o modelo abandonar as regras |
| Conteúdo ilícito | Fabricar arma, sintetizar droga, invadir sistema, fraudar prova | Não deve consumir cota nem receber a resposta educada de "não encontrei no material" |
| Dado de terceiro | "Qual a nota do aluno X", "quais alunos estão em risco" | O assistente do aluno nunca intermedeia dado de outra pessoa |

A calibração prioriza **precisão sobre cobertura**: os padrões exigem intenção
explícita junto do objeto, e não palavra solta. "Arma" não bloqueia; "como
fabricar uma arma" bloqueia. Um falso positivo barra um aluno com dúvida
legítima, o que é pior do que deixar passar uma pergunta estranha que o limiar
recusa em seguida.

Um caso tem tratamento próprio e vem antes de todos: **sinal de automutilação**.
Ele também casa com os padrões de conteúdo ilícito, e responder "isso está fora
do meu escopo" seria o pior desfecho possível. A resposta encaminha ao CVV pelo
188 e ao apoio da instituição. Um sistema de permanência estudantil que ignora
esse sinal falha exatamente no que diz querer evitar.

A recusa nunca explica qual padrão disparou o bloqueio, porque isso ensinaria a
contorná-lo. Há teste automatizado que verifica essa propriedade.

`scripts/testar-barreiras.ts` roda a bateria adversarial contra a aplicação com o
provedor real: **21 de 21 casos** com o desfecho esperado, incluindo as 5
perguntas legítimas que precisam continuar passando.

### 3.6 As três barreiras contra alucinação

Uma instrução de prompt é um pedido, não uma garantia. O sistema tem três
mecanismos independentes, e é importante que sejam três:

1. **O limiar de similaridade** impede que contexto irrelevante chegue ao modelo.
   A decisão de admitir ignorância mora no código, não no prompt: depender só da
   instrução seria confiar a garantia mais importante do sistema a algo que o
   modelo pode desobedecer.
2. **A instrução de sistema** obriga a citar a origem e a admitir quando a
   resposta não está no contexto.
3. **A verificação posterior** confere, com a resposta pronta, se ela realmente
   aponta um dos documentos fornecidos.

### 3.7 Prompt efetivamente enviado ao Gemini

Instrução de sistema (íntegra em `lib/rag/prompt.ts`):

> Você é o assistente de estudos do PermaneIA. Sua única fonte de verdade é o
> CONTEXTO fornecido em cada pergunta. […]
> 1. Responda APENAS com informação presente no contexto. Você não tem permissão
>    para usar conhecimento próprio sobre a disciplina […]
> 2. Se a resposta não estiver no contexto, diga exatamente que não encontrou
>    essa informação no material da disciplina […]
> 3. Sempre cite o documento de origem entre colchetes […]
> 4. Datas, prazos, pesos de avaliação, percentuais de falta e critérios de
>    aprovação são informações críticas: transcreva exatamente como estão […]
>
> Nunca invente uma data de prova. Um aluno que perde uma avaliação por causa de
> uma data errada é o pior resultado possível deste sistema.

### 3.8 Observabilidade: duas perguntas diferentes

Um sistema que chama modelo de linguagem em produção tem duas perguntas que não
se respondem com o mesmo dado:

**"Como está o sistema?"** é agregada. Quantas consultas, quanto tempo, quantas
recusas, quanto custou, quantas caíram no modo degradado. Isso está no próprio
banco: cada consulta grava `modelo`, `tokensEntrada`, `tokensSaida`, `custoUsd` e
`duracaoMs`, e `/api/observabilidade` resume em percentis. Fica atrás da
permissão `auditoria.ver`, porque pergunta de aluno é dado de aluno.

**"Por que ESTA resposta saiu assim?"** é individual, e a linha do banco não
responde: ela guarda o resultado, não o caminho. Para isso existe o rastro no
Langfuse (`lib/rastro-llm.ts`): cada consulta vira um `agent` com uma etapa por
fase, `recuperar`, `gerar` e `verificar`, com entrada e saída de cada uma. A
etapa `gerar` é do tipo `generation`, e não `span` comum, porque é isso que faz
o painel somar token e custo em vez de só guardar texto.

Três decisões que valem registro:

**O custo é calculado, não estimado por contagem própria.** Os tokens vêm do
`usageMetadata` que a própria API do Gemini devolve, e não de uma contagem
local de palavras. O campo `thoughtsTokenCount` entra na conta de saída: é
token cobrado, e ignorá-lo subestimaria a fatura. Quando o modelo não está na
tabela de preço, `custoEstimadoUsd` devolve **nulo**, e não zero. Nulo é
"não sei"; zero seria uma afirmação falsa sobre dinheiro.

**O modelo registrado é o que respondeu, não o que foi pedido.** O código pede
`gemini-flash-lite-latest`, que é um apelido. A resposta traz `modelVersion` com
o modelo concreto que atendeu, e é esse que vai para o banco. Sem isso, o
histórico de custo não sobreviveria à primeira troca de modelo por trás do
apelido.

**O envio é explícito.** Em função sem servidor o processo congela assim que a
resposta sai, e o que estiver na fila de telemetria morre com ele. Por isso há um
`forceFlush()` ao fim do registro. Sem essa linha nada falha e o painel fica
vazio, que é o modo de falha mais caro de observabilidade: o sistema parece
instrumentado e não está.

Toda a telemetria é opcional. Sem as chaves, o rastro desliga e o assistente
responde igual. Falha de telemetria nunca derruba a resposta de quem perguntou.

---

## 4. Visão crítica

Esta seção é a mais importante do relatório, e todos os números dela saíram de
scripts executáveis que estão no repositório.

### 4.1 Qualidade do assistente, medida

Conjunto de avaliação: 52 perguntas escritas à mão sobre os sete documentos
indexados, em `scripts/avaliar-rag.ts`. São três grupos:

- **41 respondíveis**, cada uma com o trecho que precisa aparecer na resposta.
  Cinco são de enumeração, e nelas o trecho esperado é sempre o último item do
  documento: resposta que para no meio falha o teste.
- **8 não respondíveis**, sobre informação que não está em documento nenhum,
  escritas de propósito no mesmo vocabulário das outras.
- **3 de conhecimento geral**, que o material não responde e o assistente ainda
  deve atender, avisando que a resposta não tem fonte no material (§4.4).

Duas métricas que puxam em direções opostas, e **dois limiares**, porque os dois
modos de operação trabalham em escalas diferentes de similaridade:

Modo generativo, que é o padrão:

| Limiar | Cobertura | Recusa correta |
|---|---|---|
| 0,55 | 88,9% (16/18) | 87,5% (7/8) |
| 0,60 | 88,9% (16/18) | 12,5% (1/8) |
| **0,65** | **83,3% a 88,9%** | **75,0% a 100,0%** |
| 0,70 | 72,2% (13/18) | 100,0% (8/8) |
| 0,75 | 22,2% (4/18) | 100,0% (8/8) |

Duas ressalvas que esta tabela obriga a fazer, e que não dá para esconder:

A linha adotada traz faixa, e não número único, porque execuções sucessivas da
mesma bateria no mesmo limiar devolveram 15/18 e 16/18 de cobertura, e 6/8 e 8/8
de recusa. O modelo reformula a resposta a cada chamada, e uma reformulação pode
deixar de conter a palavra que o teste procura. A faixa é o número honesto; um
valor único seria uma rodada escolhida.

E a linha de 0,60 é **ruído, não sinal**: recusa de 87,5% em 0,55 caindo para
12,5% em 0,60 é impossível como comportamento real, porque limiar maior não pode
recusar menos. São 8 casos, cada um vale 12,5 pontos, e a oscilação do modelo
cabe inteira nessa resolução. A conclusão correta não é "0,60 é ruim", é que
**a bateria de recusa é pequena demais para distinguir limiares vizinhos**.

Modo de leitura direta, que é determinístico:

| Limiar | Cobertura | Recusa correta |
|---|---|---|
| 0,10 | 88,9% (16/18) | 50,0% (4/8) |
| **0,15** | **83,3% (15/18)** | **75,0% (6/8)** |
| 0,18 | 55,6% (10/18) | 75,0% (6/8) |

Valores adotados: **0,65** no modo generativo e **0,15** no de leitura direta.
No segundo, é o ponto em que a recusa sobe de 50% para 75% sem custo nenhum de
cobertura. Confundir os dois foi um defeito real, e está em §4.3.

A tabela completa, com todos os limiares medidos, está em `docs/AVALIACAO-RAG.md`.

### 4.2 Cinco defeitos que só a medição revelou

O caminho até esses números importa mais que os números. Nenhum destes defeitos
seria visível testando o assistente à mão com meia dúzia de perguntas.

**Trigramas de caracteres afogando o sinal (cobertura: 0%).** A primeira versão
do embedding local indexava todos os trigramas de caracteres de cada palavra,
para tolerar flexão. Com cinco vezes mais unidades projetadas em 768 dimensões, a
colisão passou a dominar: perguntas fora do material pontuavam *mais* que
perguntas respondíveis. "Como faço para trancar a matrícula" marcava 0,208 e
"Quando é a Prova P1" marcava 0,159.

**Interrogativos sem IDF.** Toda pergunta começa por "quando", "qual", "quanto",
"como", "onde" ou "quem", e nenhum diz nada sobre qual trecho responde. Num
TF-IDF clássico o IDF os anularia sozinho; sem corpus para estimar frequência
documental, eles precisaram entrar na lista de palavras vazias. A pergunta sobre
trancar matrícula caiu de 0,210 para 0,069.

**Recorte abaixo da unidade de informação (cobertura: 44%).** A resposta
extrativa selecionava *frases* por sobreposição de termos. No cronograma, "24 de
setembro de 2026, quinta-feira" e "Avaliação. Prova P1" são frases separadas: a
que casa com a pergunta é a segunda, a que tem a resposta é a primeira. O aluno
recebia a confirmação de que a prova existe, sem a data. Corrigido devolvendo o
trecho inteiro, a cobertura foi de 44,4% para 88,9%.

**Enumeração respondida com um item.** Perguntado "qual é o conteúdo das
aulas", o assistente devolvia a primeira aula do semestre, citada e correta.
Todo o instrumental de honestidade dizia que estava tudo bem: similaridade alta,
fonte apontada, diagnóstico de resposta gerada. Faltava metade da resposta, e
nada sinalizava isso. A causa não era o modelo nem o prompt: o contexto entregue
continha uma aula, porque foi a que ficou em primeiro no ranking, e nenhuma
instrução faz um modelo citar o que não recebeu. Corrigido classificando a
pergunta antes de montar o contexto (ADR 007); a cobertura foi de 78,3% para
91,3% com os casos novos incluídos.

**A própria ferramenta de avaliação medindo o limiar errado.** O mais
desconfortável dos cinco. `scripts/avaliar-rag.ts` usava, quando rodado sem
argumento, o limiar do modo de leitura direta (0,15) também para o modo
generativo, cujo limiar é 0,65. Com 0,15 quase todo trecho passa no filtro, o
modelo recebe contexto irrelevante em toda pergunta e a recusa desaba: a
execução padrão relatava 0/8, e as mesmas perguntas no limiar do provedor
recusavam 6/8. As tabelas de calibração não foram afetadas, porque foram
levantadas varrendo o limiar explicitamente; errado estava o caso sem
argumento, que é justamente o que se roda no dia a dia.

Duas lições que valem além deste código: **recortar abaixo da unidade em que a
informação foi escrita quebra a informação**, e **uma métrica que ninguém audita
mede o que a ferramenta faz, não o que o sistema faz.**

### 4.3 Quatro defeitos que só o uso revelou

Os cinco anteriores apareceram na bancada de medição. Os quatro seguintes só
apareceram depois, com o sistema no ar: alguém usou o assistente e disse que ele
não achava nada. O que transformou a reclamação em diagnóstico foi o registro de
`consultas_rag`, que guarda toda pergunta feita, com a similaridade máxima
alcançada e a resposta devolvida.

**A recuperação só vetorial perde a pergunta curta.** O registro mostrou duas
perguntas sobre o mesmo fato, com similaridade praticamente igual e respostas
opostas:

| Pergunta | Similaridade máxima | Resposta |
|---|---|---|
| "Quando é a Prova P1?" | 0,691 | respondida, com a data certa |
| "quando vai ser a prova" | 0,692 | "não encontrei essa informação" |

O limiar não era o problema, porque os trechos passavam. O problema era o
conjunto recuperado: o vetor de uma pergunta de cinco palavras, das quais quatro
são vazias, é pouco discriminante, e os quatro trechos entregues ao modelo eram
aulas quaisquer do cronograma. A palavra que decide a pergunta, "prova", pesa
pouco num vetor de 768 dimensões e não pesa nada num limiar. Corrigido com um
segundo braço de recuperação, por casamento de termos (BM25), fundido ao
vetorial por posição com Reciprocal Rank Fusion (ADR 008).

No mesmo registro havia "Quando é a proxima aula", também recusada. Essa não
tinha como ser respondida por construção: o prompt não informava que dia é hoje.
Passou a informar, no fuso de Brasília, porque o servidor roda em UTC e às 21h de
uma quinta-feira em Bauru já é sexta em Londres.

**A cota do provedor partiu o índice, em silêncio.** Numa carga de oito
documentos seguidos, o provedor recusou duas chamadas de embedding por limite de
requisições por minuto. A ingestão caiu para o modo local, gravou os vetores e
não reclamou. Como a busca filtra por origem do embedding, e precisa filtrar
para não comparar espaços diferentes, aqueles dois documentos ficaram invisíveis
para a busca vetorial: apareciam na lista da disciplina, tinham trechos
gravados, e não respondiam nada. Corrigido em três camadas: a ingestão insiste
com o provedor externo antes de aceitar o vetor local, `/api/health` passou a
declarar se o índice tem mais de uma origem, e `scripts/reparar-indice.ts`
reindexa o que ficou no espaço errado a partir do texto já guardado.

A distinção que ficou registrada: **cair para o modo local é a decisão certa
numa consulta de aluno, que está esperando resposta, e é a decisão errada numa
ingestão, cujo resultado fica gravado.**

**A sobreposição do chunking separava o tema da sua data.** Com trechos de 320
caracteres e 60 de sobreposição, a cauda repetida abria o trecho seguinte no
meio de uma entrada do cronograma: o trecho começava em "Aula normal.
Finalização das médias." e a data daquela aula tinha ficado no trecho anterior.
Quem lesse aquele trecho sozinho, modelo ou aluno, casava o tema com a data
errada. Corrigido com divisão por unidade de informação, um parágrafo por
trecho, sem sobreposição, com o título do documento e a seção colados em cada
trecho.

**O calendário sem saber que dia é hoje.** No mesmo registro, duas perguntas
recusadas com o cronograma inteiro indexado e seis trechos dele no contexto:
"Quando é a proxima aula", com similaridade 0,721, e "na materia da semana que
vem vai ter o que?", com 0,664. A recuperação acertou, os trechos eram do
cronograma. Faltava outra coisa: um trecho diz "20 de agosto de 2026,
quinta-feira. Aula normal. Busca heurística." e não diz se essa aula já
aconteceu. Responder qual é a próxima exige comparar vinte datas com o dia de
hoje, e isso é aritmética, não recuperação. A data de hoje já ia no prompt desde
a correção anterior, e não bastou.

Corrigido tirando a conta do modelo: `lib/rag/calendario.ts` lê as datas por
extenso do material, identifica o documento que é o calendário e monta um bloco
com o último encontro realizado, o próximo, o que cai na semana que vem e a
próxima avaliação, com a diferença de dias já resolvida. O modelo recebe isso
pronto e só redige. É a mesma divisão do motor fuzzy: quem calcula é o domínio,
quem redige é o modelo. Sem provedor externo, o bloco é transcrito literalmente,
e a pergunta temporal continua respondida.

Com as quatro correções, a bateria ampliada para 52 perguntas passou de 89,2%
para 100% de cobertura e de 87,5% para 100% de recusa correta.

### 4.4 A terceira saída: responder fora do material, avisando

O sistema tinha dois desfechos, e a fronteira entre eles era o acervo indexado.
Isso é o certo para "quando é a P1", porque uma data inventada é o pior
resultado possível deste projeto. Mas produzia recusa em perguntas que qualquer
pessoa espera que um assistente de estudos responda: como funciona o trancamento
de matrícula, o que é uma heurística admissível.

A terceira saída responde com o conhecimento geral do modelo. O que a torna
aceitável é o recorte, e ele é deliberadamente estreito:

- vale para dois assuntos apenas, a vida acadêmica e o conteúdo das disciplinas;
  fora deles a recusa continua, e "quem ganhou a Copa de 2022" segue recusada;
- o aviso de que aquilo não está no material é escrito **pelo código**, sempre na
  primeira linha, e não pelo modelo. Pedir ao modelo que avise seria cumprido
  quase sempre, e quase sempre não serve para a fronteira entre o que tem fonte
  e o que não tem;
- a instrução proíbe afirmar data, valor, prazo, nota mínima ou nome de pessoa
  da instituição, e manda dizer onde confirmar;
- a lista de fontes fica vazia e a tela muda o traço da resposta.

Testado com as perguntas que mais convidam à invenção, o comportamento se
manteve: perguntado quem coordena o curso, o assistente diz que a informação
muda e manda procurar a secretaria; perguntado o valor da mensalidade, explica
que varia por curso e turno e aponta os canais oficiais. Nenhuma das duas
inventou nome ou número.

### 4.5 O tamanho do trecho é o parâmetro de maior impacto

Com trechos de 900 caracteres, o cronograma inteiro cabia em 4 trechos e cada
vetor representava quatro aulas ao mesmo tempo. A similaridade de um par
relevante ficava em 0,13. Com cerca de 320 caracteres, uma aula por trecho, a
mesma pergunta chega a 0,21 e 0,33.

A regra que saiu daí: o trecho deve ter o tamanho da **unidade de informação do
documento**, e não um tamanho fixo em caracteres. Texto corrido admite trechos
grandes; lista de fatos independentes exige trechos pequenos.

### 4.6 O risco que não conseguimos eliminar

O maior risco deste sistema não é inventar uma data. É **repetir com confiança a
data certa de uma ementa do semestre passado.**

O RAG resolve alucinação, não desatualização. Se a coordenação indexar o
cronograma de 2025-1 e esquecê-lo lá, o assistente vai responder com autoridade e
com fonte citada, e vai estar errado.

A mitigação implementada é parcial: todo documento tem um campo de referência
(data ou versão) que aparece em toda citação, transferindo ao leitor a chance de
perceber. É uma mitigação, não uma solução. Uma solução exigiria integração com o
sistema acadêmico, o que está fora do escopo.

### 4.7 Sensibilidade do score fuzzy

Três alunos sintéticos, com o mesmo sistema:

| Perfil | Freq. | Média | Acessos | Score | Faixa | Critério por nota |
|---|---|---|---|---|---|---|
| Abandono em curso | 18% | 2,1 | 1 | 0,901 | crítico | em risco |
| **Notas boas, desengajando** | **34%** | **8,6** | **2** | **0,675** | **alto** | **sem risco** |
| Trajetória saudável | 96% | 9,1 | 34 | 0,108 | baixo | sem risco |

A linha do meio é a resposta à pergunta "por que fuzzy e não um classificador
binário". O critério da secretaria classifica esse aluno como tranquilo. O
sistema fuzzy o coloca na faixa alta, e a regra 8 explica por quê em linguagem
que a coordenação pode repetir numa conversa.

### 4.8 O artefato do método Mamdani

Encontramos e medimos uma limitação do método que a disciplina ensina.

Perto da fronteira entre dois termos, a massa que cada regra contribui muda de
forma descontínua, e o centroide pode andar alguns milésimos na direção
*contrária* à esperada: piorar levemente um sinal pode reduzir levemente o score.

Medição em grade de 26.460 comparações:

| Medida | Valor |
|---|---|
| Inversões no score | 911 (3,4%) |
| Maior inversão observada | 0,036 |
| **Inversões de faixa** | **0** |

A conclusão importante é a última linha: o que a coordenação vê é a **faixa**, e
ela é estritamente monótona. O artefato existe, é pequeno, está medido e não
chega a mudar nenhuma decisão. Um teste automatizado falha se a maior inversão
passar de 0,05.

Optamos por **manter o método como é ensinado** e documentar o artefato, em vez
de trocar por uma defuzzificação que o esconderia. A escolha custa 3,4% de
inversões marginais e preserva a correspondência entre o código e o conteúdo da
disciplina.

### 4.9 Limitação da calibração dos conjuntos

Os conjuntos de frequência seguem a especificação do trabalho, em que "baixa"
termina em 60%. O contrato didático da disciplina, porém, reprova por falta
abaixo de 75%.

Consequência medida: um aluno com 62% de presença já passou do limite
institucional, mas o sistema o classifica como risco **médio**. Alinhar o
conjunto "baixa" à linha dos 75% é a primeira recalibração que sugerimos, e está
registrada como teste que documenta o comportamento atual.

### 4.10 Limitações honestas da própria avaliação

- **52 perguntas é pouco.** O conjunto serve para comparar configurações entre
  si, que é para o que foi usado, e não para afirmar uma taxa absoluta.
- **As perguntas foram escritas por quem construiu o sistema.** Há viés de
  vocabulário. Uma avaliação melhor coletaria perguntas reais de alunos, e o
  registro de consultas existe para isso: quatro dos nove defeitos de
  recuperação e resposta saíram dele. Os outros três que o relatório documenta
  são de instrumentação (§4.12), e esses não vinham de pergunta nenhuma.
- **O modo generativo não é determinístico**, então a tabela dele traz faixa e
  não número exato. A calibração se apoiou no modo de leitura direta, que é
  determinístico.
- **O custo registrado é estimativa, não fatura.** Os tokens vêm da contagem da
  própria API; o preço vem de tabela declarada em código, com data de
  conferência. O projeto roda no tier gratuito e não há fatura para comparar.
- **Os dados de aluno são sintéticos.** O sistema fuzzy nunca foi validado contra
  evasão real. Não sabemos se o score prevê alguma coisa; sabemos que ele captura
  o padrão que a literatura descreve.

### 4.11 O que a telemetria revelou: a conta é o contexto, não a resposta

Medição de produção em 06/10/2026, sobre 104 consultas reais acumuladas desde
04/09/2026, das quais 35 depois da migração que criou os campos de telemetria:

| Medida | Valor |
|---|---|
| Consultas registradas | 104 |
| Recusa (admitiu não saber) | 43 (41,3%) |
| Caíram no modo degradado | 13 |
| Latência p50 | 1.392 ms |
| Latência p95 | 20.534 ms |
| Chamadas ao Gemini com token contado | 30 |
| Tokens de entrada | 38.117 |
| Tokens de saída | 1.701 |
| Custo acumulado | US$ 0,0157 |

O número que muda a forma de pensar o custo: **95,7% dos tokens são de entrada**,
uma razão de 22,4 para 1. O gasto não está na resposta que o modelo escreve, está
no material que viaja junto com a pergunta. A consequência prática é que a
alavanca de custo num sistema de RAG não é escolher um modelo mais barato para
gerar: é recuperar menos trecho, ou trecho menor. Isso liga esta seção
diretamente à §4.5, onde o tamanho do trecho já havia aparecido como o parâmetro
de maior impacto na qualidade. Ele é também o de maior impacto no custo.

Duas leituras que a tabela obriga:

**O p95 de 20,5 segundos não é o tempo de pensar do modelo.** É a soma de partida
a frio da função sem servidor e do banco no Neon acordando da suspensão. O p50 de
1,4 segundo é o sistema quente. Reportar só a média esconderia justamente a
experiência de quem abre o assistente primeiro no dia.

**O custo de US$ 0,0157 não é a fatura.** É a tabela de preço declarada em
código multiplicada pelos tokens que a API contou, e o projeto roda no tier
gratuito. Serve para comparar configurações e projetar escala, não para
conciliar com cobrança. Projetando: as 104 consultas, se todas tivessem sido
geradas, custariam cerca de US$ 0,054. Uma turma de 40 alunos com 20 perguntas
cada no semestre fica na casa de US$ 0,42.

### 4.12 Três defeitos que só a instrumentação revelou

Ironia útil: ligar observabilidade produziu os três defeitos mais caros do
projeto, e dois deles em produção.

**A variável de ambiente com marca de ordem de byte derrubou a aplicação
inteira.** As chaves foram gravadas na Vercel por um comando encadeado no
PowerShell, que acrescenta uma marca invisível no começo do texto. O valor
chegou como `'﻿https://us.cloud.langfuse.com'`, falhou ao ser lido como
URL dentro do gancho de instrumentação, e o gancho é carregado antes de
qualquer rota: **toda** requisição passou a responder 500, inclusive a de
saúde. A correção tem três camadas, porque uma só não bastava: o valor passa
por uma função que remove a marca e o espaço em volta, o gancho inteiro está
dentro de `try`, e o endereço tem padrão no código. A lição é que código de
telemetria roda antes do sistema e precisa ser mais defensivo que ele, não
menos.

**Duas cópias da biblioteca de rastro deixaram o painel vazio sem erro
nenhum.** O Next empacota o gancho de instrumentação separado do código das
rotas. O processador foi criado num módulo auxiliar importado pelos dois, e o
resultado foram duas instâncias: a rota esvaziava uma fila vazia enquanto a fila
que recebeu os dados nunca era enviada. O mesmo problema apareceu de novo um
nível acima, com a própria API de OpenTelemetry: registrar o provedor à mão o
deixava numa cópia e as rotas noutra, então a etapa era criada contra um
provedor que não existia. A solução foi `registerOTel` do pacote `@vercel/otel`,
que existe justamente para isso no Next. Nos dois casos não houve exceção, log
nem alerta. Só painel vazio.

**A ferramenta de conferência mentiu por omissão.** Depois de tudo funcionando,
o script que lê o rastro de volta mostrava a estrutura certa e **toda geração sem
modelo e sem token**. A conclusão fácil era que os atributos não subiam. O dado
estava lá: a versão 2 da API devolve grupos de campos, o padrão traz nome, tipo e
horário, e entrada, saída, modelo, token e custo ficam fora, vindo ausentes e não
nulos. Quem não pedia era a conferência.

O fio que liga os três é o mesmo: **a verificação também precisa ser
verificada.** Nos dois primeiros a ferramenta dizia que estava tudo bem e não
estava; no terceiro dizia que faltava dado e não faltava. A única prova de que
telemetria funciona é ler de volta, e a única prova de que a leitura funciona é
plantar um valor conhecido e encontrá-lo. Foi assim que o caso se fechou: uma
geração de teste com 1.234 tokens de entrada e 56 de saída, procurada e achada.

### 4.13 Lições aprendidas

1. **Medir muda o que se constrói.** Os três defeitos da seção 4.2 estavam no
   sistema e pareciam corretos. Só apareceram quando existiu um número.
2. **Uma instrução ao modelo não é uma garantia.** As barreiras que valem são as
   que rodam antes e depois dele.
3. **O modo degradado precisa ser projetado, não improvisado.** Tratá-lo como
   requisito produziu um modo que é mais estrito quanto a não inventar.
4. **O parâmetro que mais importa raramente é o modelo.** Foi o tamanho do trecho
   e a lista de palavras vazias, não a escolha do LLM. A telemetria mostrou
   depois que ele também é o parâmetro de maior peso no custo.
5. **Telemetria falha calada, e é o pior tipo de falha.** Um erro engolido num
   `try` posto ali para "telemetria não derrubar resposta" produz um sistema que
   parece instrumentado e não está. Só ler de volta prova o contrário.

---

## 5. Conclusões e sugestões futuras

O PermaneIA entrega o que se propôs: um assistente que responde com base em
documento real e admite quando não sabe, e um painel que identifica o aluno em
risco antes que a nota caia.

**Trabalhos futuros, em ordem de valor:**

1. **Integração com o sistema acadêmico.** Hoje os sinais entram à mão. A
   integração resolveria também a desatualização de documentos da seção 4.4.
2. **Validação com coordenação real.** O score precisa ser confrontado com casos
   que a coordenação conhece. A calibração atual é defensável, não validada.
3. **Recalibração da frequência para a linha institucional dos 75%**
   (seção 4.7).
4. **Ampliação da bateria de recusa.** São 8 casos, cada um vale 12,5 pontos, e
   essa resolução não distingue limiares vizinhos (§4.1). É a limitação que mais
   atrapalha qualquer calibração futura.
5. **Coleta de perguntas reais** para substituir o conjunto escrito por nós.
6. **Redução do contexto enviado, medindo os dois lados.** A telemetria mostrou
   que 95,7% do custo é contexto (§4.11). Recuperar menos trecho barateia e
   derruba cobertura, e o par é que diz alguma coisa: a mesma bateria de 52
   perguntas serve para medir o que se perde.
7. **Alerta sobre a taxa de recusa.** O dado já é gravado e já tem painel; falta
   disparar quando o patamar muda. Recusa subindo de repente é o sinal mais cedo
   de documento desatualizado ou de índice quebrado.
8. **Acompanhamento longitudinal.** Só com uma coorte real é possível dizer se o
   score prevê evasão, e não apenas se descreve o padrão da literatura.

---

## 6. Sobre o uso de IA neste projeto

Exigência de ética do enunciado. A íntegra está em
[USO-DE-IA.md](USO-DE-IA.md); o resumo é este:

**O que foi feito com apoio de IA generativa:** a maior parte do código
(estrutura de rotas, validações, componentes de interface e testes de tabela), a
estruturação desta documentação e a revisão de redação.

**O que foi decisão do grupo:** a escolha do problema e do recorte; a
arquitetura; a calibração dos conjuntos fuzzy e da base de 27 regras; a decisão
de escrever o motor Mamdani do zero em vez de usar biblioteca; a decisão de ter
um provedor local como modo de degradação; o conjunto de perguntas de avaliação;
a interpretação dos resultados e a redação desta seção de visão crítica.

**O que foi verificado independentemente:** todos os números apresentados. Cada
um sai de um script no repositório e pode ser reproduzido:

```bash
npx tsx scripts/avaliar-rag.ts        # cobertura e recusa
npx tsx scripts/diagnostico-fuzzy.ts  # monotonicidade e artefato do centroide
npm run test:coverage                 # 1935 testes e cobertura
```

Nenhum número deste relatório foi estimado ou gerado por IA. Onde não medimos,
dissemos que não medimos (seção 4.8).
