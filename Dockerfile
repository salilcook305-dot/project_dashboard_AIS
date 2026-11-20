# ==============================================================================
# AI Samrat Project Dashboard - Multi-Stage Production Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React 18 + Vite SPA Frontend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

RUN npm install -g pnpm

# Cache package manifests and workspace configuration
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml* frontend/.npmrc* ./
RUN pnpm install

# Copy frontend source and build optimized production bundle
COPY frontend/ ./
RUN pnpm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Python Django Backend & Gunicorn Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install python dependencies with caching and robust retry parameters
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --default-timeout=120 --retries 10 --prefer-binary -r requirements.txt

# Copy backend application, scripts, and demo datasets (kept separate from live database)
COPY backend /app/backend
COPY scripts /app/scripts
COPY static /app/static
COPY demo_data /app/demo_data
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Copy built frontend assets from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create upload directories, staticfiles cache, and persistent logs directory
RUN mkdir -p /app/uploads/roadmaps /app/uploads/vault /app/backend/staticfiles /app/logs

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
