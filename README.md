# PermaneIA

*[Read in English](README.en.md)*

Assistente de estudos com RAG e painel de risco de evasão por lógica fuzzy.

Projeto prático da disciplina de Inteligência Artificial, turma de quinta-feira,
período 2026-2. Entrega em 19 de novembro de 2026.

**No ar:** [permaneia.vercel.app](https://permaneia.vercel.app)

---

## O problema

A evasão no ensino superior brasileiro chega a **57,2%** no conjunto da rede
(Mapa do Ensino Superior 2024, Instituto Semesp), sobe para cerca de **61%** na
rede privada e a **64%** nos cursos a distância (Mapa do Ensino Superior 2026).
Apenas **um em cada quatro** jovens conclui a graduação que começou (OCDE,
Education at a Glance 2025).

O que a literatura sobre evasão descreve, e que este projeto usa como premissa:
o abandono é precedido por desengajamento, não por notas ruins. O aluno para de
acessar a plataforma semanas antes de a média cair, e meses antes de formalizar
o trancamento. Quem olha só a nota chega tarde.

## O que o sistema faz

Duas frentes, cada uma com uma técnica de IA diferente.

**1. Assistente de estudos com RAG.** O aluno pergunta sobre a disciplina e o
sistema busca a resposta nos documentos institucionais indexados (cronograma,
contrato didático, enunciado do projeto, atividades e materiais de cada aula)
antes de acionar o modelo de linguagem. A busca tem dois braços, proximidade
vetorial e casamento de termos, fundidos por posição: o primeiro acha a
paráfrase, o segundo acha a palavra que decide uma pergunta curta como "quando
vai ser a prova". A resposta vem com a fonte citada e com a indicação de por
qual dos dois braços cada trecho chegou.

Perguntas que dependem do calendário ("qual é a próxima aula", "o que tem na
semana que vem", "quantos dias faltam para a P1") são respondidas com uma agenda
calculada em código a partir do cronograma indexado: quem faz a conta de datas é
o domínio, o modelo só redige.

Quando a informação não está no material, o sistema diz isso. Se o assunto ainda
for dele, a vida acadêmica ou o conteúdo das disciplinas, responde com
conhecimento geral avisando na primeira linha que aquilo não saiu do acervo e
sem afirmar data, valor ou prazo da instituição. Fora desses assuntos, a recusa
continua sendo a resposta.

**2. Painel de risco de evasão com lógica fuzzy.** Frequência, desempenho e
engajamento entram num sistema Mamdani de 27 regras e saem como um score
contínuo de 0 a 1. A coordenação recebe a turma ordenada de quem precisa de
contato primeiro, com a explicação das regras que produziram cada score.

O argumento central do projeto está no cruzamento das duas: um aluno com **nota
8,6 e presença em 34%** é classificado como risco **alto**. Um critério baseado
na média de notas, que é o usado hoje na maioria das secretarias, o classificaria
como tranquilo.

## Como rodar

Requer Node 20 ou superior e um Postgres com a extensão `pgvector`.

```bash
git clone https://github.com/fabriciojunio/permaneia.git
cd permaneia
npm install

cp .env.example .env
# Preencha DATABASE_URL, DIRECT_URL e SESSION_SECRET.
# Gere o segredo com:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npm run db:push      # cria o schema
npm run db:seed      # dados sintéticos e documentos de exemplo
npm run dev
```

Abra <http://localhost:3000>.

### Ou com Docker, sem instalar nada além dele

O `docker-compose` sobe o Postgres com `pgvector`, aplica o esquema, semeia e
sobe a aplicação:

```bash
docker compose up -d
docker compose logs -f aplicacao
```

Abra <http://localhost:3000>. Para desenvolver com o Next rodando na máquina e
só o banco no contêiner:

```bash
docker compose up -d banco
```

Sem `GEMINI_API_KEY` o sistema sobe do mesmo jeito, no provedor local. O que o
compose não reproduz é o Gemini, e isso é modo de degradação projetado, não
limitação do arquivo.

### Contas da base sintética

Senha de todas: `permanencia2026`.

| Conta | Papel | O que ela mostra |
|---|---|---|
| `coordenacao@permaneia.exemplo` | coordenação | Painel de risco com os 30 alunos sintéticos, disciplinas e documentos |
| `aluno@permaneia.exemplo` | aluno | Assistente de estudos com o cronograma indexado |
| `admin@permaneia.exemplo` | administração | Gestão de contas e auditoria |

As duas primeiras não se sobrepõem: a coordenação não alcança o assistente e o
aluno não alcança o painel. Para ver as duas metades na apresentação é preciso
trocar de conta, e isso é proposital.

Qualquer pessoa também pode criar uma conta de aluno em `/cadastro`.

### A chave do Gemini é opcional

Sem `GEMINI_API_KEY`, o sistema **continua funcionando**. Ele passa a operar em
modo de leitura direta: recupera os trechos e os transcreve literalmente, com a
fonte citada, sem redigir texto novo. Perde-se fluência, não confiabilidade.

Com a chave (tier gratuito do [Google AI Studio](https://aistudio.google.com/apikey)),
as respostas passam a ser redigidas pelo modelo, sempre restritas ao contexto
recuperado.

O modo em vigor aparece na tela inicial e em cada resposta do chat: uma resposta
gerada e uma resposta transcrita têm garantias diferentes, e esconder qual das
duas o aluno está lendo seria desonesto.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm test` | 2040 testes unitários |
| `npm run test:coverage` | Testes com gate de cobertura em 90% |
| `npm run test:integration` | 77 testes contra Postgres real |
| `npm run test:e2e` | 81 testes de ponta a ponta, incluindo a verificação de celular |
| `npm run test:vistoria` | Vistoria visual da aplicação publicada, com captura de tela |
| `npm run db:seed` | Dados sintéticos e documentos de exemplo |
| `npx tsx scripts/avaliar-rag.ts` | Mede cobertura e recusa do assistente |
| `npx tsx scripts/reparar-indice.ts` | Reindexa trechos gravados no espaço vetorial errado |
| `npx tsx scripts/historico-consultas.ts exportar` | Salva as perguntas já feitas antes de resemear a base |
| `npx tsx scripts/diagnostico-fuzzy.ts` | Verifica a monotonicidade da base de regras |
| `python k8s/conferir-manifestos.py` | Confere os manifestos do Kubernetes sem precisar de cluster |
| `docker compose up -d` | Sistema inteiro em contêiner, com banco e esquema |
| `npm run gerar:apresentacao` | Gera a apresentação em PPTX |

## Arquitetura

```
Navegador
   │  HTTPS
   ▼
Next.js (App Router) na Vercel
   │
   ├── middleware.ts        sessão, anti-CSRF, papéis, cabeçalhos
   │
   ├── app/api/…            rotas REST
   │
   └── lib/
       ├── fuzzy/           motor Mamdani, escrito do zero
       │   ├── pertinencia  funções triangular e trapezoidal
       │   ├── variaveis    variáveis linguísticas e conjuntos
       │   ├── regras       base fatorial completa, 27 regras
       │   ├── motor        fuzzificação, inferência, agregação, centroide
       │   └── risco        fachada e comparação com o critério por nota
       │
       ├── rag/             chunking, busca léxica, fusão, calendário, prompt, consulta
       ├── ia/              provedor Gemini e provedor local determinístico
       └── repositorios/    Prisma e SQL da busca vetorial
   │
   ▼
Postgres (Supabase) com pgvector
```

O mapa completo das camadas, com a razão de cada uma, está em
[docs/ARQUITETURA.md](docs/ARQUITETURA.md). As decisões que exigiram argumento
estão em [docs/adr](docs/adr).

## Observabilidade

Cada requisição abre um rastro no formato `traceparent` do W3C, continuando o
do cliente quando ele manda um. Sobre esse rastro, o sistema publica um trecho
por etapa medida e **um trecho por consulta ao banco**, todos correlacionados
pelo mesmo `traceId`, que é também o identificador que aparece no envelope de
erro. Com um número só, o que a pessoa leu na tela e o que o log guardou são a
mesma coisa.

O valor dos parâmetros nunca entra num trecho: telemetria sai da aplicação, e
nome e matrícula de aluno não têm por que ir junto. O raciocínio inteiro está na
[ADR 010](docs/adr/010-rastro-distribuido.md).

`/api/health` consulta o banco de verdade, e não apenas confirma que o processo
subiu. Ele responde o commit publicado, o provedor de IA em vigor, o estado do
índice, onde os documentos são guardados e se as barreiras continuam íntegras
**dentro do pacote publicado** — este último por causa de um defeito que passava
em toda a suíte local e só existia depois do build.

## Implantação

Publicado na Vercel, com Supabase como banco. Também roda como contêiner, o que
não é enfeite: um trabalho que só sabe rodar numa plataforma não pode ser
reproduzido por quem o avalia.

| Destino | Arquivo |
|---|---|
| Local e desenvolvimento | `docker-compose.yml` |
| Imagem | `Dockerfile`, três etapas, usuário sem privilégio, raiz só de leitura |
| Kubernetes | [`k8s`](k8s), com conferidor que roda sem cluster |
| Render | `render.yaml` |
| Documentos em S3 | [ADR 012](docs/adr/012-armazenamento-de-documentos.md) |

O passo a passo, as armadilhas conhecidas e o que fazer quando algo dá errado
estão em [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md). Para apresentar o sistema,
o roteiro está em [docs/DEMONSTRACAO.md](docs/DEMONSTRACAO.md).

## Qualidade

| Métrica | Valor |
|---|---|
| Testes unitários | 2040 |
| Testes de integração | 77 |
| Testes de ponta a ponta | 81 |
| **Total** | **2198** |
| Cobertura da lógica de domínio | 97,4% |
| Cobertura do assistente | 100% das 41 perguntas respondíveis da bateria |
| Recusa correta | 100% das 8 perguntas fora do material |
| Inversões de faixa de risco | 0 em 26.460 comparações |
| Vulnerabilidades de produção | 0 |

A metodologia de avaliação do assistente, com a tabela de calibração e os nove
defeitos que ela revelou, está em [docs/AVALIACAO-RAG.md](docs/AVALIACAO-RAG.md).

## Segurança

- Sessão em JWT assinado, cookie `HttpOnly` e `SameSite=Lax`, com versão de
  sessão para revogação imediata na troca de senha
- Senha com bcrypt de custo 12 e política que prioriza comprimento
- Anti-CSRF por verificação de origem, além do `SameSite`
- Limitação de taxa em login, cadastro, ingestão e consultas ao assistente
- Papel de banco dedicado, com privilégio mínimo, e Row Level Security ligada
  em todas as tabelas, o que fecha o acesso pela API REST do Supabase
- CSP restritiva, HSTS, `X-Frame-Options`, e sem source map em produção
- `robots.txt` bloqueando buscadores e rastreadores de treinamento de modelos

Detalhes em [SECURITY.md](SECURITY.md). Como mexer no projeto, o que ele cobra
e por quê: [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacidade

A base é **inteiramente sintética**. Os 30 alunos, as notas, as frequências e os
acessos foram gerados por script com semente fixa. Nenhum registro corresponde a
uma pessoa real, e nenhum dado de colega de turma foi usado.

Os documentos indexados, ao contrário, são reais: o cronograma, o contrato
didático e o enunciado do projeto da disciplina. São documentos públicos,
divulgados pelo professor, e usá-los é o que torna a demonstração verificável ao
vivo.

O tratamento previsto para um uso real, incluindo os direitos de acesso e
portabilidade, está em [LGPD.md](LGPD.md).

## Sobre o uso de IA neste projeto

Exigência de ética do enunciado, e a íntegra está em
[docs/USO-DE-IA.md](docs/USO-DE-IA.md).

Em resumo: ferramentas de IA generativa foram usadas na escrita do código, na
estruturação da documentação e na revisão de texto. As decisões de arquitetura,
a calibração da base de regras fuzzy, o conjunto de perguntas de avaliação e a
interpretação dos resultados foram do grupo. Todos os números apresentados no
relatório saíram de scripts executáveis que estão no repositório, e podem ser
reproduzidos.

## Licença

Trabalho acadêmico, sem licença de uso comercial.
