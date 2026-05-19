FROM node:20-alpine
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@9

# Copy package manifest and install all dependencies
# No lockfile here (monorepo lockfile lives at repo root), so skip frozen check
COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# Copy Prisma schema and generate the client
COPY prisma ./prisma
RUN pnpm prisma generate

# Copy application source
COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "pnpm prisma migrate deploy && node src/server.js"]
