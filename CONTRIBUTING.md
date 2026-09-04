# Como mexer neste projeto

Escrito para o grupo, e para quem pegar o projeto depois da entrega.

## Subindo pela primeira vez

Precisa de Node 20 ou superior e um Postgres com `pgvector`. Com Docker, o
compose resolve os dois:

```bash
docker compose up -d          # banco, esquema, dados sintéticos e aplicação
```

Sem Docker, com um Postgres à mão:

```bash
npm install
cp .env.example .env          # preencher DATABASE_URL, DIRECT_URL, SESSION_SECRET
npm run db:push
npm run db:seed
npm run dev
```

A chave do Gemini é opcional: sem ela o provedor local assume e o sistema
continua respondendo, de forma extrativa. Não é limitação do ambiente de
desenvolvimento, é modo de degradação projetado.

## Antes de abrir uma proposta de mudança

```bash
npm run typecheck
npm run lint
npm run test:coverage         # o piso de cobertura da lógica de domínio é 90%
```

Se mexeu em tela, rode também os testes de navegador:

```bash
npm run test:e2e
```

Se mexeu em manifesto do Kubernetes:

```bash
python k8s/conferir-manifestos.py
```

## O que o projeto cobra, e por quê

**Acento correto em todo texto em português.** Vale para mensagem de erro, log,
nome de teste, rótulo de fluxo do CI e comentário. Texto sem acento num sistema
que fala português é defeito de acabamento, e aparece justamente na tela que
alguém vai avaliar.

**Nunca escreva marca combinante literal numa expressão regular.** Use os
escapes `\u0300-\u036f`, escritos em ASCII. A forma literal funciona no código-fonte e falha no
pacote publicado: as barreiras do assistente já quebraram exatamente assim, e o
sintoma foi injeção de prompt COM acento passando pela recusa. Há um teste que
reprova isso, e ele existe porque o defeito é real.

**Migração destrutiva precisa de justificativa escrita.** Apagar ou renomear
coluna que a versão anterior ainda lê quebra quem estiver com a página aberta
durante a publicação. O caminho é expandir, migrar e contrair, e o teste
`migracao-sem-quebra` cobra a marca `-- contrair:` com o motivo.

**Teste que não pode falhar não vale nada.** Todo teste que varre arquivos tem
um irmão que verifica que ele encontrou arquivos para varrer.

## Branch e commit

Branch a partir de `main`, com prefixo pelo tipo:

```
feat/agenda-da-proxima-aula
fix/pergunta-curta-recusada
docs/decisao-do-armazenamento
```

Commit no padrão convencional, em português, **sem travessão**. O escopo fica em
ASCII, porque casa com nome de pasta e precisa continuar filtrável no terminal;
a prosa depois dos dois-pontos vai acentuada:

```
feat(rag): responde sobre a próxima aula pela agenda calculada
fix(migracao): liga ordem fora de sequência
docs(adr): registra por que o original do documento sai do banco
```

O corpo explica **por que**, não o que: o que mudou já está no diff.

## Estrutura

O mapa das camadas e a razão de cada uma está em
[docs/ARQUITETURA.md](docs/ARQUITETURA.md). As decisões que exigiram argumento
estão em [docs/adr](docs/adr), e uma decisão nova entra como arquivo novo, com
contexto, decisão, consequências e o que foi descartado.

Duas regras que organizam o resto:

- `lib/fuzzy` e a maior parte de `lib/rag` **não fazem I/O**. É por isso que a
  cobertura passa de 95% sem um único objeto de mentira. Se você precisou de um
  mock para testar lógica de domínio, a lógica está no lugar errado.
- Onde há I/O, há uma porta e um adaptador: provedor de IA e armazenamento de
  documentos são os dois exemplos para copiar.

## Segurança

Não abra issue pública para vulnerabilidade. O caminho está em
[SECURITY.md](SECURITY.md).

Nunca commite `.env`, chave de API ou string de conexão. O `.gitignore` e o
`.dockerignore` já cobrem os casos conhecidos, e o que passar deles é
responsabilidade de quem revisa.
