# Sobre o uso de IA neste projeto

Exigência de ética do enunciado: "toda utilização das ferramentas, inclusive
para escrita de texto, deve ser explicitamente descrita e contextualizada".

Este documento é o cumprimento dessa exigência, escrito para ser específico o
bastante para ser verificável.

## O que foi feito com apoio de IA generativa

**Código.** A maior parte do código foi escrita com apoio de ferramentas de IA:
estrutura de rotas, esquemas de validação, componentes de interface, camada de
repositórios e, principalmente, os testes de tabela, que são repetitivos por
natureza. O ganho de tempo aqui foi grande e é honesto reconhecê-lo.

**Documentação.** A estruturação deste repositório de documentos, incluindo o
relatório, os ADRs e este arquivo, teve apoio de IA na organização e na redação.

**Revisão de texto.** Ortografia, acentuação e clareza.

## O que foi decisão do grupo

- A escolha do problema, o recorte e a premissa de que desengajamento antecede
  queda de nota
- A arquitetura: monolito Next.js com Postgres e pgvector, e as razões
  registradas nos ADRs
- A decisão de **escrever o motor Mamdani do zero** em vez de usar biblioteca,
  para que as quatro etapas fiquem explícitas e auditáveis
- A calibração dos conjuntos fuzzy e a construção da base fatorial de 27 regras,
  incluindo a revisão linha a linha da tabela
- A decisão de ter um **provedor local** como modo de degradação projetado, e não
  como remendo
- A decisão de **não mostrar o score ao aluno**, e a razão pedagógica por trás
- O conjunto de 26 perguntas de avaliação e a separação entre respondíveis e não
  respondíveis
- A interpretação dos resultados e toda a seção de visão crítica do relatório

## O que foi verificado independentemente

Todo número apresentado no relatório sai de um script executável do repositório.
Nenhum foi estimado, arredondado para soar melhor, ou gerado por IA.

```bash
npx tsx scripts/avaliar-rag.ts        # cobertura e recusa do assistente
npx tsx scripts/diagnostico-fuzzy.ts  # monotonicidade e artefato do centroide
npm run test:coverage                 # contagem de testes e cobertura
```

## Onde a IA errou, e o que isso ensinou

Vale registrar, porque é material de visão crítica e porque a pergunta
"qual foi a limitação da ferramenta" merece resposta concreta.

**Código que parece certo e não é.** As três correções documentadas em
`AVALIACAO-RAG.md` são exemplos. O embedding com trigramas de caracteres, a
ausência de interrogativos na lista de palavras vazias e o recorte por frase na
resposta extrativa são todos código plausível, bem escrito e comentado. Nenhum
deles produzia erro. Todos estavam errados, e só apareceram quando existiu uma
métrica.

**Confiança uniforme.** A ferramenta escreve com a mesma segurança o trecho que
está certo e o que está errado. Não há sinal no texto que distinga um do outro.
A única defesa é a verificação externa.

**Tendência ao genérico.** Pedidos amplos produzem soluções corretas e sem
compromisso com o domínio. As decisões que dão identidade ao projeto, como o
limiar por provedor ou o tamanho de trecho por tipo de documento, saíram de
olhar os dados, não de pedir uma sugestão.

**A lição que fica:** a ferramenta acelera muito a escrita e não substitui o
julgamento. Quem decide o que medir, e o que fazer com o número, continua sendo
quem assina o trabalho.

## Ferramentas de IA embarcadas no produto

Distinto do acima. O sistema em execução usa:

- **Google Gemini** (`gemini-2.0-flash` e `text-embedding-004`), tier gratuito,
  para geração de texto e embeddings, quando há chave configurada
- **Provedor local**, escrito por nós, sem rede e sem dependência, que assume
  quando não há chave ou quando o Gemini falha

A interface declara qual dos dois respondeu, a cada resposta.
