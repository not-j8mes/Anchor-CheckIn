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

FROM node:24-slim

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copy workspace root config needed for pnpm workspace filtering
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./

# Copy the db library (needed for preDeployCommand: drizzle-kit push)
COPY --from=builder /app/lib/db ./lib/db

# Copy node_modules from builder (includes drizzle-kit, drizzle-orm, pg, etc.)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib/db/node_modules ./lib/db/node_modules

# Copy built application artifacts
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/church-checkin/dist/public ./artifacts/church-checkin/dist/public

# Copy api-server package.json (needed for pnpm workspace resolution)
COPY --from=builder /app/artifacts/api-server/package.json ./artifacts/api-server/

ENV NODE_ENV=production
ENV STATIC_DIR=/app/artifacts/church-checkin/dist/public

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
