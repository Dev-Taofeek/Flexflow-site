FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

RUN corepack enable pnpm

WORKDIR /app

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY prisma ./prisma
RUN pnpm prisma generate

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "pnpm prisma migrate deploy && node src/server.js"]
