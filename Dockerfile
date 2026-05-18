# --- Frontend build stage ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Backend dependencies stage ---
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

# --- Runtime ---
FROM node:20-alpine
RUN apk add --no-cache openssl tini curl
WORKDIR /app

COPY backend/ ./backend/
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://localhost:4000/api/health || exit 1

WORKDIR /app/backend
ENTRYPOINT ["/sbin/tini","--"]
CMD ["sh","-c","npx prisma migrate deploy && node src/server.js"]
