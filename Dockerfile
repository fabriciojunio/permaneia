# Imagem da aplicação, para rodar fora da Vercel.
#
# A publicação de verdade é na Vercel, e esta imagem existe por dois motivos
# concretos: o docker-compose sobe o sistema inteiro com um banco pgvector de
# verdade em um comando, e a aplicação deixa de estar presa a uma plataforma
# específica, que é o que a avaliação de um trabalho de faculdade não deveria
# exigir de quem for reproduzir.
#
# Três etapas. A primeira instala as dependências, a segunda constrói, e a
# imagem final leva só o servidor autocontido: sem compilador, sem código-fonte
# e sem o node_modules de desenvolvimento, que sozinho passa de 500 MB.

# ------------------------------------------------------------- dependências
FROM node:22-alpine AS dependencias

# O Prisma NÃO funciona no Alpine sem isto. Os engines são binários ligados ao
# OpenSSL, e a imagem base do Node no Alpine não o traz: a falha é um
# "Error relocating ... SSL_CTX_set_ver" na hora de carregar o engine, e não um
# erro de conexão, o que manda a investigação para o lado errado.
#
# libc6-compat entra junto porque parte dos binários pré-compilados espera a
# glibc, e o musl sozinho não os satisfaz.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /construcao

# Só os manifestos primeiro: enquanto nenhuma dependência mudar, esta camada
# fica em cache e a construção seguinte não baixa tudo de novo.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# `npm ci` respeita o lock e falha quando ele está fora de sincronia com o
# package.json, que é exatamente o que se quer numa construção reprodutível.
# O postinstall gera o cliente do Prisma, e por isso o schema veio antes.
RUN npm ci

# ---------------------------------------------------------------- construção
FROM node:22-alpine AS construcao

RUN apk add --no-cache openssl libc6-compat

WORKDIR /construcao

COPY --from=dependencias /construcao/node_modules ./node_modules
COPY . .

# O commit e o ramo entram como argumento de construção porque não existe git
# dentro da imagem. É o mesmo par que a Vercel publica no ambiente da função, e
# é o que /api/health devolve para o fluxo de publicação conferir.
ARG APP_COMMIT=desconhecido
ARG APP_RAMO=desconhecido
ENV APP_COMMIT=${APP_COMMIT}
ENV APP_RAMO=${APP_RAMO}

ENV NODE_ENV=production

# A construção do Next precisa de um valor para as variáveis obrigatórias, que
# a aplicação valida ao carregar. Nenhum deles é usado: não há conexão com
# banco nem chamada ao provedor de IA durante o build, e os valores de verdade
# chegam no arranque do contêiner.
#
# Passados no próprio RUN, e não como ENV ou ARG: assim eles não ficam gravados
# em camada nenhuma da imagem. Vale mesmo sendo valor de mentira, porque a
# forma é o que alguém vai copiar no dia em que o valor for de verdade.
RUN DATABASE_URL="postgresql://construcao:construcao@localhost:5432/construcao" \
    DIRECT_URL="postgresql://construcao:construcao@localhost:5432/construcao" \
    SESSION_SECRET="apenas-para-a-construcao-nao-vale-em-execucao-nenhuma" \
    npm run build

# --------------------------------------------------------------- ferramentas
# Imagem de manutenção: aplicar esquema, semear, ingerir documento, reparar
# índice.
#
# Existe porque a imagem de execução NÃO serve para isso. A saída autocontida
# do Next traz apenas o que o servidor usa em tempo de execução, e o CLI do
# Prisma e o tsx não estão entre eles: um `prisma db push` ali dentro falha
# com "comando não encontrado". Levar as ferramentas para a imagem de execução
# resolveria e desfaria o motivo de ela existir, que é não carregar nada além
# do necessário para atender.
#
# É o estágio de construção com outro nome, e o nome importa: quem lê o
# compose ou o Job precisa ver que aquilo é outra coisa.
FROM construcao AS ferramentas
WORKDIR /construcao
# A imagem base já traz o usuário `node`, de identificador 1000. A posse é
# passada porque a construção rodou como root, e um comando de manutenção que
# precise escrever, como a semeadura, falharia sem isso.
RUN chown -R node:node /construcao
USER node
CMD ["node_modules/.bin/prisma", "db", "push", "--skip-generate"]

# -------------------------------------------------------------------- imagem
FROM node:22-alpine AS execucao

# Pelo mesmo motivo do estágio de construção: o cliente do Prisma carrega o
# engine em tempo de execução, e sem o OpenSSL toda consulta falha. O sintoma é
# traiçoeiro: /api/health captura a exceção e responde 503 com "banco
# indisponível", que é indistinguível de um banco de fato fora do ar.
RUN apk add --no-cache openssl libc6-compat

# Usuário sem privilégio: um processo que não precisa de root não roda como
# root, e um servidor Node é justamente o caso em que isso nunca é necessário.
RUN addgroup -S permaneia && adduser -S permaneia -G permaneia

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# A saída autocontida do Next já traz o servidor e as dependências que ele usa
# de fato. O estático vem à parte porque fica fora dela.
#
# Não há `public/` para copiar: o ícone e o robots.txt são rotas do App Router
# (app/icon.svg e app/robots.ts), e entram no pacote. Um COPY de uma pasta
# inexistente não é ignorado, ele quebra a construção.
COPY --from=construcao --chown=permaneia:permaneia /construcao/.next/standalone ./
COPY --from=construcao --chown=permaneia:permaneia /construcao/.next/static ./.next/static

# O schema e as migrações entram para que dê para aplicar o esquema a partir do
# próprio contêiner, sem precisar de uma segunda imagem só para isso.
COPY --from=construcao --chown=permaneia:permaneia /construcao/prisma ./prisma

USER permaneia
EXPOSE 3000

# O health consulta o banco de verdade, então o contêiner só é declarado
# saudável quando ele consegue atender de fato. O período de partida cobre a
# subida do Next; a espera pelo banco quem faz é o compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
