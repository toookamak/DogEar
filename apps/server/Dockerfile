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
# monolith：快照执行器（L3）的外部二进制——抓公开页产出单 HTML（CC0）。
# 若你的基础镜像源没有该包，可改用 `cargo install monolith` 或挂载预编译二进制
# 并设 DOGEAR_MONOLITH_BIN 指向它；摘除时删除本行 + src/archive/snapshot-monolith.ts。
RUN apk add --no-cache monolith
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/server ./apps/server
EXPOSE 8787
ENV PORT=8787
ENV DOGEAR_DB_PATH=/data/dogear.sqlite
VOLUME /data
CMD ["bun", "run", "apps/server/src/index.ts"]