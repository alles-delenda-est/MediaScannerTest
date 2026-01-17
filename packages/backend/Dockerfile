# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml ./

# Copy package.json files for dependency resolution
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY tsconfig.base.json ./

# Build shared package first
RUN pnpm --filter @media-scanner/shared build

# Build backend
RUN pnpm --filter @media-scanner/backend build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml ./

# Copy package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy migrations and seeds (needed at runtime)
COPY --from=builder /app/packages/backend/src/db ./packages/backend/src/db

WORKDIR /app/packages/backend

EXPOSE 3001

CMD ["node", "dist/index.js"]
