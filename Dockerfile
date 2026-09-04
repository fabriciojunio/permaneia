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

# A construção do Next precisa de um valor para as variáveis obrigatórias, e
# nenhum deles é usado: não há conexão com banco nem chamada ao provedor de IA
# durante o build. Os valores de verdade chegam no arranque do contêiner.
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://construcao:construcao@localhost:5432/construcao"
ENV DIRECT_URL="postgresql://construcao:construcao@localhost:5432/construcao"
ENV SESSION_SECRET="apenas-para-a-construcao-nao-vale-em-execucao-nenhuma"

RUN npm run build

# -------------------------------------------------------------------- imagem
FROM node:22-alpine AS execucao

# Usuário sem privilégio: um processo que não precisa de root não roda como
# root, e um servidor Node é justamente o caso em que isso nunca é necessário.
RUN addgroup -S permaneia && adduser -S permaneia -G permaneia

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# A saída autocontida do Next já traz o servidor e as dependências que ele usa
# de fato. O estático e o público vêm à parte porque ficam fora dela.
COPY --from=construcao --chown=permaneia:permaneia /construcao/.next/standalone ./
COPY --from=construcao --chown=permaneia:permaneia /construcao/.next/static ./.next/static
COPY --from=construcao --chown=permaneia:permaneia /construcao/public ./public

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
