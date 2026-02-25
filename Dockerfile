FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/agent/package.json packages/agent/
COPY packages/cli/package.json packages/cli/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/shadow/package.json packages/shadow/
COPY packages/shadow-cli/package.json packages/shadow-cli/
COPY packages/conformance/package.json packages/conformance/
COPY packages/simulation/package.json packages/simulation/
COPY packages/experiments/package.json packages/experiments/
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts

# Production image
FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/agent/node_modules ./packages/agent/node_modules 2>/dev/null || true
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/core/ packages/core/
COPY packages/api/ packages/api/
COPY packages/agent/ packages/agent/
COPY packages/cli/ packages/cli/
COPY packages/mcp-server/ packages/mcp-server/
COPY packages/shadow/ packages/shadow/
COPY packages/shadow-cli/ packages/shadow-cli/

# Create data directory
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/los.db

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["npx", "tsx", "packages/api/src/cli.ts"]
