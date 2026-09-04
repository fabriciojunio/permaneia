# Implantação

Quatro destinos possíveis, um em uso. Cada seção diz o que é preciso, o que dá
errado e por quê.

## Onde está hoje

| Peça | Onde | Por quê |
|---|---|---|
| Aplicação | Vercel, camada gratuita | Publicação por push, sem hibernação da função |
| Banco | Neon, camada gratuita, `aws-sa-east-1` | Traz `pgvector`, não expira e acorda sozinho ([ADR 013](adr/013-banco-no-neon.md)) |
| Provedor de IA | Google AI Studio, camada gratuita | Opcional: sem chave, o provedor local assume |
| Documento original | Disco ou S3 | Ver [ADR 012](adr/012-armazenamento-de-documentos.md) |

## Vercel

O repositório está ligado ao projeto e cada push em `main` publica. As variáveis
obrigatórias são `DATABASE_URL`, `DIRECT_URL` e `SESSION_SECRET`; as demais têm
padrão razoável e estão em `.env.example`.

**As duas URLs não são só endereços diferentes: são papéis diferentes.**

`DATABASE_URL` aponta para o endpoint com pooler e usa `permaneia_web`, o papel
da aplicação, que só lê e escreve linha. Função serverless abre e fecha conexão
o tempo todo, e sem o pooler o Postgres esgota o limite em minutos.

`DIRECT_URL` aponta para o endpoint sem pooler e usa `permaneia_app`, o dono do
banco, único que pode criar e alterar tabela. Aplicar esquema precisa de sessão,
e pelo pooler falha com um erro sobre transação preparada que não ajuda ninguém
a achar a causa.

No Neon, o endereço do pooler é o mesmo do direto com `-pooler` antes da região.

### O que confere se deu certo

O fluxo `conferir-publicacao.yml` espera o commit publicado aparecer em
`/api/health` e só então roda a bateria adversarial pela rede. Esperar por HTTP
200 não serviria: a versão antiga continua atendendo enquanto a nova constrói, e
o passo ficaria verde em segundos sem ter conferido nada.

### A armadilha do banco que dorme, e o que ela custou

O banco morava no Supabase, e **a camada gratuita de lá pausa o projeto depois
de sete dias sem nenhuma conexão**, com despausar manual pelo painel. Em
04/09/2026 foi o que aconteceu: o host do projeto sumiu do DNS, o assistente e o
painel pararam, e a página inicial continuou respondendo 200 — porque página
respondendo não prova banco. A base teve que ser semeada de novo, e as perguntas
já feitas ao assistente se perderam.

Daí a mudança para o Neon, registrada na [ADR 013](adr/013-banco-no-neon.md): lá
o compute suspende e **acorda sozinho** na conexão seguinte, em cerca de meio
segundo, sem ninguém clicar em nada.

O fluxo `manter-banco-acordado.yml` continua, com propósito menor: manter o
compute quente, para quem abrir o link não esperar nem isso, e servir de monitor
de fumaça diário. Ele bate no `/api/health`, que consulta o banco de verdade;
bater na página inicial não abriria conexão nenhuma e ficaria verde à toa.

Note a diferença para o Render: lá quem hiberna é a aplicação. Na Vercel a
função sobe a frio em milissegundos.

## Docker

```bash
docker compose up -d          # banco, esquema e aplicação
docker compose logs -f aplicacao
```

A imagem é de três etapas e a final leva só a saída autocontida do Next: sem
compilador, sem código-fonte e sem o `node_modules` de desenvolvimento. Roda
como usuário sem privilégio, com a raiz só de leitura.

O commit e o ramo entram como argumento de construção, porque não existe git
dentro da imagem:

```bash
docker build --build-arg APP_COMMIT=$(git rev-parse HEAD) \
             --build-arg APP_RAMO=$(git branch --show-current) \
             -t permaneia:local .
```

Para exercitar o armazenamento em S3 sem conta na AWS, o perfil `aws` sobe o
LocalStack e cria o bucket:

```bash
docker compose --profile aws up -d localstack bucket
export S3_BUCKET=permaneia-documentos
export S3_ENDERECO=http://localhost:4566
export AWS_ACCESS_KEY_ID=teste AWS_SECRET_ACCESS_KEY=teste
```

## Kubernetes

Os manifestos estão em [`k8s`](../k8s) e descrevem a topologia inteira: duas
réplicas, sondas, orçamento de interrupção, escala automática, regra de rede e
o Job que aplica o esquema antes da aplicação subir.

```bash
python k8s/conferir-manifestos.py     # sem cluster e sem kubectl
kubectl apply -f k8s/
```

O conferidor roda antes de propósito. Ele pega o que nenhuma validação de
esquema pega: alvo de escala que não existe, seletor que não acha pod, chave de
segredo não declarada, volume montado sem ter sido criado. Tudo isso passa no
`apply` sem uma linha de erro, e o sintoma aparece depois como "não tem nada
respondendo".

Os `Secret` do repositório são **modelos**, com `TROCAR` no lugar do valor. Em
produção isso vem de um gerenciador de segredos.

### Por que a sonda de vivacidade é folgada

A prontidão passa pelo `/api/health`, que consulta o banco: um pod vivo com o
banco fora do ar não deve receber tráfego. Já a vivacidade tolera seis falhas
seguidas, com trinta segundos entre elas. Se o banco cair e a vivacidade for
estrita, o Kubernetes reinicia todos os pods em laço, o que não traz o banco de
volta e tira o sistema do ar de vez.

## Render

`render.yaml` é um blueprint: em New > Blueprint, apontando para este
repositório, o Render cria o serviço sozinho a partir do Dockerfile.

**O banco não está no blueprint de propósito.** O Postgres gratuito do Render
expira em trinta dias, o que mataria a demonstração no meio do semestre, e não
traz `pgvector`, sem o qual metade da recuperação não funciona.

Aqui o serviço hiberna depois de quinze minutos sem tráfego, e a primeira visita
depois disso espera a subida.

## AWS

A imagem roda em qualquer executor de contêiner. O que a AWS acrescenta de fato
ao sistema é o armazenamento dos documentos originais em S3, que é o único
destino que sobrevive numa função serverless — o disco dela é só de leitura, e
`/tmp` some entre invocações.

Credencial **não** se configura no código nem em variável, rodando na AWS: a
cadeia padrão do SDK pega o papel da instância ou da tarefa, que é o caminho
certo. Chave em variável de ambiente é para quem não tem papel, como o
LocalStack.

O bucket precisa de:

- bloqueio de acesso público ligado (o conteúdo é material de disciplina, e o
  caminho carrega o identificador da disciplina e do documento);
- criptografia em repouso, embora a gravação já peça `AES256` explicitamente,
  porque o padrão do bucket pode mudar por fora;
- política de ciclo de vida coerente com a retenção declarada em
  [`LGPD.md`](../LGPD.md).

## Variáveis

Todas estão documentadas em `.env.example`, com o motivo de cada uma. As três
obrigatórias:

| Variável | O que acontece sem ela |
|---|---|
| `DATABASE_URL` | A aplicação não sobe |
| `DIRECT_URL` | O esquema não é aplicado |
| `SESSION_SECRET` | A aplicação se recusa a subir com menos de 32 caracteres |

## Migração de esquema

Expandir, migrar e contrair, em três publicações separadas. O teste
`__tests__/migracao-sem-quebra.test.ts` reprova o build quando encontra comando
destrutivo sem a marca `-- contrair:` com o motivo. O raciocínio inteiro está na
[ADR 011](adr/011-migracao-sem-parada.md).

## Quando algo dá errado

| Sintoma | Causa provável |
|---|---|
| Erro de banco em toda chamada | Conferir o projeto no painel do Neon e as credenciais na Vercel |
| `/api/health` com `indice.misturado: true` | Índice partido: rodar `scripts/reparar-indice.ts` |
| Assistente diz que não achou um documento que está lá | O mesmo índice partido |
| Erro sobre transação preparada ao aplicar esquema | Esquema sendo aplicado pelo pooler, e não pela conexão direta |
| Ingestão falha na Vercel com "sem S3_BUCKET" | É de propósito: o disco da função some entre invocações |
