FROM node:22-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json ./
# Always install dependencies to ensure completeness
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm ci

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

ENV PORT=8080
EXPOSE 8080

USER node

CMD ["node", "dist/main.js"]
