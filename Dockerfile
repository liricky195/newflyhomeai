# ── Stage 1: install dependencies (needs build tools for better-sqlite3) ──────
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

# ── Stage 2: build Next.js app + compile monitor script ───────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: lean production image ────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled Next.js output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy compiled monitor script (output of tsc --project tsconfig.scripts.json)
COPY --from=builder /app/.scripts-dist ./.scripts-dist

# Copy runtime config and schema migrations
COPY --from=builder /app/migrations ./migrations
COPY package.json next.config.mjs tsconfig.json ./

# Copy node_modules (includes native better-sqlite3 compiled for this image)
COPY --from=deps /app/node_modules ./node_modules

# Persistent data directory — Railway mounts its volume here
RUN mkdir -p /data

COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000
CMD ["./start.sh"]
