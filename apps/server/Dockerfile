FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY packages/db/ packages/db/
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/

FROM oven/bun:1.3-slim AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/server ./apps/server
EXPOSE 8787
ENV PORT=8787
ENV DOGEAR_DB_PATH=/data/dogear.sqlite
VOLUME /data
CMD ["bun", "run", "apps/server/src/index.ts"]