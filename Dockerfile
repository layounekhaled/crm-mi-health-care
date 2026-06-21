# syntax=docker/dockerfile:1.7

# ─── Stage 1: deps ──────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install ALL dependencies (including dev — needed for the build: @tailwindcss/postcss, typescript, etc.)
# Coolify injects NODE_ENV=production as a build arg, which makes npm ci skip devDependencies.
# Force NODE_ENV=development during install so devDependencies are installed.
# postinstall script runs `prisma generate` automatically.
RUN NODE_ENV=development npm ci --include=dev

# ─── Stage 2: builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ─── Stage 3: runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Standalone server (already includes next + react + deps traced)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Static chunks (must be served separately)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma generated client (just in case tracing missed it)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
