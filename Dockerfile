# syntax=docker/dockerfile:1
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Production Stage ─────────────────────────────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="SSHFM"
LABEL org.opencontainers.image.description="SSH File Manager — sleek, modern, open source"
LABEL org.opencontainers.image.version="1.0.0"

ENV NODE_ENV=production

WORKDIR /app

# Install backend deps
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend from builder stage
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

EXPOSE 6969

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:6969/api/health || exit 1

CMD ["node", "server.js"]
