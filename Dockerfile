FROM node:24-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./

COPY lib/db/package.json lib/db/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/church-checkin/package.json artifacts/church-checkin/

RUN pnpm install

COPY . .

RUN PORT=3000 BASE_PATH=/ pnpm --filter @workspace/church-checkin run build

RUN pnpm --filter @workspace/api-server run build

RUN pnpm --filter @workspace/db run push

FROM node:24-slim

WORKDIR /app

COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/church-checkin/dist/public ./artifacts/church-checkin/dist/public

ENV NODE_ENV=production
ENV STATIC_DIR=/app/artifacts/church-checkin/dist/public

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
