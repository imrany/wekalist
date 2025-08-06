# Multi-stage Dockerfile for Memos
# Stage 1: Build the web frontend
FROM node:20-alpine AS web-builder

# Set up the full project structure so the relative path works correctly
WORKDIR /build

# Copy the entire project first to establish the directory structure
COPY . .

# Change to web directory and install dependencies
WORKDIR /build/web

# Install pnpm globally and install dependencies
RUN npm install -g pnpm@latest && \
    pnpm install --frozen-lockfile

# Build the frontend for release mode
# This outputs to ../server/router/frontend/dist relative to web directory
# which maps to /build/server/router/frontend/dist in our container
RUN pnpm run release

# Stage 2: Build the Go application
FROM golang:1.23-alpine AS go-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files first (for better caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy all Go source code
COPY . .

# Copy the built frontend from the previous stage
COPY --from=web-builder /build/server/router/frontend/dist ./server/router/frontend/dist

# Build the Go application
# CGO_ENABLED=0 for a static binary
# -ldflags="-w -s" to reduce binary size
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s -X github.com/usememos/memos/internal/version.version=$(git describe --tags --always --dirty)" \
    -o memos \
    ./main.go

# Stage 3: Final runtime image
FROM alpine:3.19

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata && \
    addgroup -S memos && \
    adduser -S memos -G memos

WORKDIR /opt/memos

# Copy the binary from builder stage
COPY --from=go-builder /app/memos .

# Copy any additional static files if needed
# COPY --from=go-builder /app/scripts/entrypoint.sh .

# Create data directory
RUN mkdir -p /opt/memos/data && \
    chown -R memos:memos /opt/memos

# Switch to non-root user
USER memos

# Expose the port (adjust if different)
EXPOSE 5230

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5230/healthz || exit 1

# Set environment variables
ENV MODE=prod
ENV PORT=5230
ENV DATA=/opt/memos/data

# Start the application
CMD ["./memos"]