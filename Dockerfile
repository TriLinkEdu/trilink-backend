# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
# Copy pre-installed node_modules from host if present, otherwise install
COPY node_modules* ./node_modules/
RUN if [ ! -d "node_modules/.bin" ]; then \
      npm config set fetch-retry-mintimeout 20000 && \
      npm config set fetch-retry-maxtimeout 120000 && \
      npm config set fetch-retries 5 && \
      npm ci; \
    fi

COPY . .
RUN npm run build

# --- runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads && chown -R node:node /app

EXPOSE 4000

USER node

CMD ["node", "dist/main.js"]
