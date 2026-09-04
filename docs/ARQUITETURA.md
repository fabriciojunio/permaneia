# Arquitetura

Este documento descreve como o sistema está montado e, principalmente, **por
quê**. As decisões que exigiram argumento estão em [adr](adr); aqui fica o mapa
que liga uma à outra.

## Em uma frase

Um monolito Next.js com duas frentes de IA independentes, sobre um Postgres com
`pgvector`, publicado como função serverless e empacotado também como contêiner
para não depender de uma plataforma só.

## Por que um monolito

A [ADR 001](adr/001-monolito-next.md) registra a decisão e ela continua valendo.
O sistema tem dois usuários simultâneos numa apresentação e trinta alunos
sintéticos no banco. Separar em serviços custaria latência de rede, um contrato
para manter e uma topologia para operar, e compraria uma escalabilidade que
nunca vai ser exercida. O que separa as duas frentes aqui é o módulo, não o
processo.

## As camadas

```
app/                    rotas e telas (Next App Router)
  api/                  handlers HTTP, um por recurso
middleware.ts           sessão, papel, anti-CSRF, cabeçalhos, rastro

lib/
  fuzzy/                motor Mamdani escrito do zero, sem I/O
  rag/                  fatiamento, busca léxica, fusão, calendário, barreiras
  ia/                   provedor Gemini e provedor local determinístico
  repositorios/         Prisma e o SQL da busca vetorial
  armazenamento/        arquivo original em disco ou em S3
  rastro*, logger, observabilidade
```

A regra que organiza isso: **`lib/fuzzy` e a maior parte de `lib/rag` não fazem
I/O**. São funções puras, e é por isso que a cobertura delas passa de 95% sem um
único objeto de mentira. Onde há I/O, há um adaptador, e o adaptador tem uma
porta: é assim com o provedor de IA (Gemini ou local) e com o armazenamento de
documentos (S3 ou disco).

## O caminho de uma pergunta

1. O middleware abre um rastro `traceparent`, valida a origem, confere a sessão
   e injeta papel e identidade nos cabeçalhos.
2. O handler estabelece o rastro para tudo que roda abaixo e valida a entrada
   com Zod.
3. As **barreiras** (`lib/rag/guardrails`) avaliam a pergunta antes de qualquer
   custo: injeção de prompt, conteúdo ilícito e dado de terceiro são recusados
   aqui, sem tocar o banco nem o provedor.
4. A recuperação roda dois braços em paralelo: proximidade vetorial no
   `pgvector` e casamento de termos em memória, fundidos por posição
   ([ADR 008](adr/008-recuperacao-hibrida.md)).
5. Pergunta que depende de calendário não vai para o modelo: a agenda é
   calculada em código a partir do cronograma indexado, e o modelo só redige
   ([ADR 009](adr/009-agenda-e-resposta-fora-do-material.md)).
6. O provedor gera a resposta, restrita ao contexto recuperado. Sem chave, o
   provedor local transcreve os trechos com a fonte citada.
7. Cada etapa cara publica um trecho de rastro, e cada consulta ao banco publica
   o seu ([ADR 010](adr/010-rastro-distribuido.md)).

## As duas frentes, e por que elas não se misturam

O motor fuzzy não sabe que existe RAG, e o RAG não sabe que existe risco de
evasão. São dois módulos que compartilham banco, sessão e telas, e nada mais.
Isso não é purismo: é o que permite avaliar cada um por conta própria, com a
bateria adversarial de um lado e as 26.460 comparações de faixa do outro.

O acesso também as separa: a coordenação não alcança o assistente e o aluno não
alcança o painel.

## Estado e persistência

Postgres com `pgvector`. O tipo `vector` é `Unsupported` no Prisma
([ADR 005](adr/005-vetor-unsupported-no-prisma.md)), então a busca vetorial é
SQL escrito à mão, e é justamente ela que a instrumentação de consultas precisa
enxergar.

O arquivo **original** de cada documento não fica no banco: vai para disco ou
para armazenamento de objetos ([ADR 012](adr/012-armazenamento-de-documentos.md)).
Um `bytea` grande num banco de 500 MB é espaço que a busca vetorial vai querer.

O esquema é aplicado por fora da aplicação, nunca no arranque: migração
disparada por réplica que sobe é migração disparada N vezes em paralelo.

## Degradação, que é o desenho e não o acidente

Três modos, todos exercitados por teste:

| O que cai | O que acontece |
|---|---|
| Chave do Gemini ausente ou fora do ar | Provedor local transcreve os trechos, com a fonte citada |
| Busca vetorial indisponível ou índice partido | O braço léxico responde sozinho |
| Banco fora do ar | `/api/health` responde 503 e o pod para de receber tráfego |

O modo em vigor aparece na tela: uma resposta gerada e uma transcrita têm
garantias diferentes, e esconder qual das duas o aluno está lendo seria
desonesto.

## Onde roda

Vercel em produção, com Neon como banco. Também há imagem Docker, compose,
manifestos de Kubernetes e blueprint do Render, descritos em
[IMPLANTACAO.md](IMPLANTACAO.md). Isso não é enfeite: um trabalho que só sabe
rodar numa plataforma não pode ser reproduzido por quem o avalia.
