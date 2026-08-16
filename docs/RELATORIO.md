# Relatório — Projeto Prático de IA Generativa

## PermaneIA: assistente de estudo e alerta de risco de evasão

**Disciplina:** Inteligência Artificial, turma de quinta-feira, 2026-2
**Professor:** Patrick Pedreira Silva
**Instituição:** Unisagrado
**Grupo:** Camila Pereira Raimundo, Fabrício Júnio Almeida Dias, Kauã Limão Nunes,
Luan Padilha Miranda
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

### 1.3 O resultado que sustenta a escolha

O sistema em produção, consultado com os sinais de um aluno com **média 8,6,
frequência 34% e 2 acessos à plataforma**, devolve:

```
score fuzzy: 0.675  |  faixa: alto
critério por nota: sem risco  |  divergem: true
regra dominante: 8 — "Bom desempenho não anula a ausência sistemática das
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
Postgres (Supabase) com pgvector
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
"procurar hoje" — a diferença muda a ação, não só o rótulo.

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

---

## 4. Visão crítica

Esta seção é a mais importante do relatório, e todos os números dela saíram de
scripts executáveis que estão no repositório.

### 4.1 Qualidade do assistente, medida

Conjunto de avaliação: 26 perguntas escritas à mão sobre os três documentos
indexados. 18 respondíveis, cada uma com o trecho que precisa aparecer na
resposta; 8 **não** respondíveis, escritas de propósito no mesmo vocabulário das
outras.

Duas métricas que puxam em direções opostas:

| Limiar | Cobertura | Recusa correta |
|---|---|---|
| 0,10 | 88,9% (16/18) | 50,0% (4/8) |
| **0,15** | **83,3% (15/18)** | **75,0% (6/8)** |
| 0,18 | 55,6% (10/18) | 75,0% (6/8) |

Valor adotado: 0,15. É o ponto em que a recusa sobe de 50% para 75% sem custo
nenhum de cobertura.

### 4.2 Três defeitos que só a medição revelou

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

A lição vale além deste código: **recortar abaixo da unidade em que a informação
foi escrita quebra a informação.**

### 4.3 O tamanho do trecho é o parâmetro de maior impacto

Com trechos de 900 caracteres, o cronograma inteiro cabia em 4 trechos e cada
vetor representava quatro aulas ao mesmo tempo. A similaridade de um par
relevante ficava em 0,13. Com cerca de 320 caracteres, uma aula por trecho, a
mesma pergunta chega a 0,21 e 0,33.

A regra que saiu daí: o trecho deve ter o tamanho da **unidade de informação do
documento**, e não um tamanho fixo em caracteres. Texto corrido admite trechos
grandes; lista de fatos independentes exige trechos pequenos.

### 4.4 O risco que não conseguimos eliminar

O maior risco deste sistema não é inventar uma data. É **repetir com confiança a
data certa de uma ementa do semestre passado.**

O RAG resolve alucinação, não desatualização. Se a coordenação indexar o
cronograma de 2025-1 e esquecê-lo lá, o assistente vai responder com autoridade e
com fonte citada, e vai estar errado.

A mitigação implementada é parcial: todo documento tem um campo de referência
(data ou versão) que aparece em toda citação, transferindo ao leitor a chance de
perceber. É uma mitigação, não uma solução. Uma solução exigiria integração com o
sistema acadêmico, o que está fora do escopo.

### 4.5 Sensibilidade do score fuzzy

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

### 4.6 O artefato do método Mamdani

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

### 4.7 Limitação da calibração dos conjuntos

Os conjuntos de frequência seguem a especificação do trabalho, em que "baixa"
termina em 60%. O contrato didático da disciplina, porém, reprova por falta
abaixo de 75%.

Consequência medida: um aluno com 62% de presença já passou do limite
institucional, mas o sistema o classifica como risco **médio**. Alinhar o
conjunto "baixa" à linha dos 75% é a primeira recalibração que sugerimos, e está
registrada como teste que documenta o comportamento atual.

### 4.8 Limitações honestas da própria avaliação

- **26 perguntas é pouco.** O conjunto serve para comparar configurações entre
  si, que é para o que foi usado, e não para afirmar uma taxa absoluta.
- **As perguntas foram escritas por quem construiu o sistema.** Há viés de
  vocabulário. Uma avaliação melhor coletaria perguntas reais de alunos.
- **Os números são do modo degradado.** O modo com Gemini não foi medido no mesmo
  conjunto porque não dispomos de chave configurada em caráter permanente. O
  script aceita a chave e roda igual.
- **Os dados de aluno são sintéticos.** O sistema fuzzy nunca foi validado contra
  evasão real. Não sabemos se o score prevê alguma coisa; sabemos que ele captura
  o padrão que a literatura descreve.

### 4.9 Lições aprendidas

1. **Medir muda o que se constrói.** Os três defeitos da seção 4.2 estavam no
   sistema e pareciam corretos. Só apareceram quando existiu um número.
2. **Uma instrução ao modelo não é uma garantia.** As barreiras que valem são as
   que rodam antes e depois dele.
3. **O modo degradado precisa ser projetado, não improvisado.** Tratá-lo como
   requisito produziu um modo que é mais estrito quanto a não inventar.
4. **O parâmetro que mais importa raramente é o modelo.** Foi o tamanho do trecho
   e a lista de palavras vazias, não a escolha do LLM.

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
4. **Avaliação do modo generativo** no mesmo conjunto de perguntas.
5. **Coleta de perguntas reais** para substituir o conjunto escrito por nós.
6. **Acompanhamento longitudinal.** Só com uma coorte real é possível dizer se o
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
npm run test:coverage                 # 1690 testes e cobertura
```

Nenhum número deste relatório foi estimado ou gerado por IA. Onde não medimos,
dissemos que não medimos (seção 4.8).
