FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy pre-installed node_modules from host (avoids npm ci download)
COPY node_modules ./node_modules
COPY package.json package-lock.json ./

COPY . .
RUN npm run build

# --- runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

COPY package.json package-lock.json ./
# Copy only production node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Multer uploads to /app/uploads at runtime; ensure non-root node user can write.
RUN mkdir -p /app/uploads && chown -R node:node /app

EXPOSE 4000

USER node

CMD ["node", "dist/main.js"]
