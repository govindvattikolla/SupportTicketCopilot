FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests for dependency resolution
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies for compilation
RUN npm ci

# Copy backend source code and configurations
COPY backend ./backend

# Build TypeScript to JavaScript in backend/dist
RUN npm run build --workspace=backend

# Prune devDependencies to keep the production image lean
RUN npm prune --omit=dev

# -------------------------------------------------------------
# Production Stage
# -------------------------------------------------------------
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy production dependencies and compiled artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/dist ./backend/dist

# Ensure upload directories exist for local file storage
RUN mkdir -p /app/uploads /app/backend/uploads

EXPOSE 5000

# Native health check using Node 22 built-in fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/api/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "backend/dist/server.js"]
