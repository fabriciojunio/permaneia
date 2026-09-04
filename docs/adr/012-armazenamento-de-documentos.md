# ADR 012: onde fica o arquivo original de um documento

Status: aceita
Data: 4 de setembro de 2026

## Contexto

A ingestão lia o PDF, extraía o texto, fatiava em trechos, gerava os vetores,
gravava tudo no banco e **jogava o arquivo fora**.

Enquanto o provedor de embedding não muda, ninguém sente falta. Ele mudou. E a
reindexação, hoje feita por `scripts/reparar-indice.ts`, só tem o texto já
fatiado para trabalhar: a sobreposição escolhida, a quebra de página e o que a
extração fez com as tabelas já viraram o que viraram. Refazer com outro tamanho
de trecho, ou com outro extrator, exige o original, e o original está na pasta
de downloads de alguém.

Há um segundo caso, menor e igualmente concreto: a resposta cita a fonte, e o
aluno não tem como abrir a fonte. A citação diz "cronograma, página 2" e não
existe cronograma para clicar.

Guardar o binário no Postgres foi a primeira ideia e foi descartada: o banco da
camada gratuita tem 500 MB, os PDFs da disciplina somam mais de 30 MB, e é
espaço que a busca vetorial vai querer. Isso, mais um `bytea` grande em toda
consulta que não pediu por ele.

## Decisão

Um contrato, `ArmazenamentoDeDocumentos`, com dois destinos:

- **disco**, para desenvolvimento, para o `docker-compose` e para os testes;
- **S3**, ou qualquer serviço que fale o mesmo protocolo, para produção e para o
  LocalStack.

Quem escolhe é o ambiente: com `S3_BUCKET` configurado vai para o armazenamento
de objetos, sem ele vai para o disco.

**Menos o terceiro caso, que é o que importa:** na Vercel sem `S3_BUCKET`, a
chamada falha na hora, com uma mensagem que diz o que configurar. O sistema de
arquivos da função é só de leitura, com exceção de `/tmp`, que some entre
invocações. Cair no disco lá daria certo na gravação, daria certo na leitura
logo em seguida, e perderia o arquivo em algum momento depois, sem erro nenhum.
Falhar na hora é melhor que perder documento em silêncio.

A chave é `disciplinas/<disciplina>/<documento>/<nome saneado>`. Organizar por
disciplina permite apagar tudo de uma disciplina por prefixo quando ela sair, o
que é exigência de retenção (ver `LGPD.md`), em vez de varrer a listagem inteira
procurando o que é dela. O nome original entra saneado e por último: nome de
arquivo com barra, acento ou `..` vira outro caminho, e `..` vira caminho para
fora da pasta prevista.

A falha ao guardar **não desfaz a indexação**. O sistema continua respondendo
sobre o documento; o que se perde é poder refatiar sem o arquivo em mãos de
novo, e isso não justifica jogar fora um trabalho que já deu certo.

## Consequências

O `docker-compose` ganhou um perfil `aws` com LocalStack e a criação do bucket.
É o mesmo protocolo, num contêiner, sem cartão de crédito e sem risco de
esquecer um bucket ligado. Quem for reproduzir o trabalho não precisa de conta
na AWS para ver o sistema inteiro funcionando, que é o ponto.

Credencial nunca é lida do código: em execução na AWS a cadeia padrão do SDK
pega o papel da instância ou da tarefa, que é o caminho certo. Chave em variável
de ambiente é o caminho de quem não tem papel, como o LocalStack, e continua
funcionando por tabela.

A gravação pede `ServerSideEncryption: AES256` explicitamente em vez de confiar
no padrão do bucket, que pode mudar por fora sem ninguém do lado de cá saber.

`/api/health` passou a dizer o destino configurado, sem credencial e sem
endereço. É para a configuração errada aparecer antes da primeira ingestão, e
não no meio dela.

Custo: uma dependência nova, `@aws-sdk/client-s3`, que só é carregada no
servidor.

## Alternativas descartadas

**Guardar no Postgres, em `bytea`.** Simples e sem dependência nova. Consome o
espaço que a busca vetorial vai precisar, num banco de 500 MB.

**Guardar no repositório, junto com o código.** É o que acontece hoje com o
material de exemplo, e funciona para material de exemplo. Não funciona para
documento enviado pela coordenação, que passaria a exigir um commit.

**Vercel Blob.** Resolveria com menos código e prenderia o sistema à plataforma,
justamente o que o Dockerfile e o compose existem para evitar. O protocolo do S3
roda na AWS, no LocalStack e em vários serviços compatíveis.
