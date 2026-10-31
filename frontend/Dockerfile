FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests for dependency resolution
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all workspace dependencies required for Vite build
RUN npm ci

# Copy frontend source code
COPY frontend ./frontend

# API URL prefix
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL

# Build the frontend production bundle into frontend/dist
RUN npm run build --workspace=frontend

# -------------------------------------------------------------
# Production Stage: High-performance Nginx web server
# -------------------------------------------------------------
FROM nginx:alpine AS production

# Copy custom Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

# Health check verifying Nginx responds to HTTP requests
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
