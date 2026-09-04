# ADR 011: migração que não derruba a versão anterior

Status: aceita
Data: 4 de setembro de 2026

## Contexto

Publicar na Vercel não é trocar uma versão pela outra num instante. A versão
nova sobe, o tráfego migra, e por algum tempo as duas atendem ao mesmo tempo: a
antiga continua servindo quem já estava com a página aberta e a requisição que
já estava no meio do caminho.

O banco, no meio disso, é um só.

Uma migração que apaga uma coluna ainda lida pela versão anterior transforma
essa janela em erro na cara de quem estava usando o sistema. O mesmo vale para
renomear coluna, para trocar o tipo dela e para passar a exigir valor onde antes
havia nulo. Nada disso é pego por teste: a suíte roda contra o schema novo, e o
schema novo está correto. O que está errado é a combinação de schema novo com
código velho, que existe só durante a publicação e some antes de alguém olhar.

O risco aqui é real e não teórico: o sistema tem um painel que a coordenação
deixa aberto, e o assistente é usado no horário da aula. Publicar no meio da
tarde é o caso normal.

## Decisão

Expandir, migrar e contrair, em três publicações separadas:

1. **Expandir.** A coluna nova entra ao lado da antiga, aceitando nulo. O código
   escreve nas duas e lê da antiga. Nada quebra, porque nada saiu.
2. **Migrar.** Os dados são copiados para a coluna nova e o código passa a ler
   dela. A antiga continua lá, ainda escrita, para o caso de precisar voltar.
3. **Contrair.** Só quando a versão anterior não existe mais em lugar nenhum, a
   coluna antiga sai.

E um teste, `__tests__/migracao-sem-quebra.test.ts`, que varre
`prisma/migrations` e reprova o build quando encontra um comando destrutivo.

O teste **não impede** o terceiro passo. Ele exige que quem o escreveu diga, no
próprio arquivo, que sabe o que está fazendo:

```sql
-- contrair: a coluna resposta saiu do código na publicação de 02/09/2026
alter table consulta drop column resposta;
```

A marca sem motivo não libera. Exigir a justificativa, e não só a palavra, é o
que separa uma decisão de um comentário colado para o teste passar.

## Consequências

Toda mudança de coluna passa a custar três publicações em vez de uma. É caro, e
é o preço de publicar com o sistema no ar. A alternativa honesta seria avisar a
turma e publicar de madrugada, o que não se sustenta num semestre inteiro.

O teste é um alarme com falso positivo possível: um `drop column` numa migração
que também cria a tabela, no mesmo arquivo, seria reprovado sem precisar. Nesse
caso a marca resolve, e a frase escrita ao lado dela fica no histórico.

`drop table` ficou de fora da lista de propósito. Tabela inteira sumindo é
grande demais para passar despercebido numa revisão, e a lista existe para pegar
o que passa.

## Alternativas descartadas

**Confiar na revisão.** É onde isto tem que ser pego, e é exatamente onde não é:
o arquivo de migração é o último do diff, depois de duzentas linhas de código, e
o comando destrutivo tem uma linha.

**Publicar com o sistema fora do ar.** Resolve de vez, e um sistema que a
coordenação abre no meio do expediente não pode sair do ar para trocar de
versão.

**Guardar as duas versões do schema e comparar.** Pega mais casos e exige
manter um artefato paralelo em dia. O ganho não paga o custo num sistema com uma
única migração de estrutura até aqui.
