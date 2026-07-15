# BB Sports — Next.js standalone production image
# Multi-stage build for a tiny final image and fast cold starts on Railway.

# ---------- 1. deps stage ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# ---------- 2. build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm run ops:bundle:publication-db

# ---------- 3. runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone server output (next.config.mjs `output: 'standalone'`)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Articles are read at runtime via fs — make sure content/ ships
COPY --from=builder --chown=nextjs:nodejs /app/content ./content
# Self-contained disposable-Postgres verifier for explicit Railway SSH use.
COPY --from=builder --chown=nextjs:nodejs /app/.ops ./ops
# Defensive: ensure traversal/read perms across the runtime filesystem
RUN chmod -R a+rX ./public ./.next ./content ./ops ./node_modules 2>/dev/null || true

USER nextjs
EXPOSE 3000

# Healthcheck: simple HTTP probe of the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
