# ── Stage 1: Build ──
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

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

# ── Stage 2: Production ──
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# Generate Prisma client in production image
RUN npx prisma generate

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3001

# Start command: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
