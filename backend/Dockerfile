# ============================================================
# STAGE 1: BUILD — Compilar TypeScript
# ============================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" pnpm exec prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ============================================================
# STAGE 2: RUNTIME
# ============================================================
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Instalar TODAS las deps (prisma y tsx estan en dependencies)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# Prisma: schema + migrations + config (para migrate deploy)
# + data CSVs + seed.ts (para seeding con tsx)
COPY prisma ./prisma
COPY prisma.config.ts ./

# Regenerar Prisma client en runtime (va a node_modules/@prisma/client)
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" pnpm exec prisma generate

# JavaScript compilado de la app
COPY --from=builder /app/dist ./dist

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3001

CMD ["./entrypoint.sh"]
