# ── Stage 1: Build ──
FROM node:20-alpine AS builder

# OpenSSL + compatibility libraries for Prisma on Alpine
RUN apk update && apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Compile seed separately (it's outside src/)
RUN npx tsc --esModuleInterop --module commonjs --target es2020 --outDir dist/seed prisma/seed.ts --skipLibCheck || true

# ── Stage 2: Production ──
FROM node:20-alpine AS runner

# OpenSSL + compatibility libraries for Prisma runtime
RUN apk update && apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# Generate Prisma client in production image
RUN npx prisma generate

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3001

# Start command: run migrations, seed data, then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed/seed.js 2>/dev/null; node dist/index.js"]
