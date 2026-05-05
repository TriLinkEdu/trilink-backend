# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads && chown -R node:node /app

EXPOSE 4000

USER node

CMD ["node", "dist/main.js"]
