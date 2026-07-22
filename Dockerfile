# === Build Stage ===
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# === Production Stage ===
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -S kirospec && adduser -S kirospec -G kirospec

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Copy spec templates and static assets
COPY .kiro/ ./.kiro/

# Set ownership
RUN chown -R kirospec:kirospec /app

USER kirospec

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV KIROSPEC_LLM_PROVIDER=ollama
ENV OLLAMA_BASE_URL=http://ollama:11434
ENV OLLAMA_MODEL=llama3
ENV OUTPUT_DIR=.kiro/specs
ENV LOG_LEVEL=info

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "dist/infrastructure/cli/index.js", "--serve"]
