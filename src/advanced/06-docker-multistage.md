---
title: Docker multistage
tier: advanced
platform: golang
position: 6
---

# Docker multistage

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › Docker multistage

**Goal**

Create a production Dockerfile using multistage builds and run the API alongside PostgreSQL with docker-compose.

**Prerequisites**

- [Rate limiting](./05-rate-limiting.md)
- Docker installed — see the [Docker appendix](https://alibaihaqi.github.io/learning-docs/docker/01-what-is-docker.html)

## Multistage Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
# Stage 1: build
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app .

# Stage 2: runtime
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app /app
EXPOSE 8080
ENTRYPOINT ["/app"]
```

Two stages keep the final image small (under 20 MB vs 800+ MB with the full Go toolchain).

## docker-compose.yml

Create `docker-compose.yml`:

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://postgres:pass@db:5432/itemsdb?sslmode=disable
      - JWT_SECRET=compose-secret-change-in-production
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: itemsdb
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      retries: 5
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

The `condition: service_healthy` ensures the API waits for PostgreSQL to accept connections before starting.

## .dockerignore

Create `.dockerignore` to keep the build context small:

```
.git
node_modules
*.md
```

## Run

```bash
docker compose up --build
# API starts at http://localhost:8080
```

## Checkpoint

```bash
# In another terminal:
curl http://localhost:8080/items
# → []  (empty list, connected to Postgres)

# Stop when done:
docker compose down -v  # -v removes the volume too
```

**Next:** [Integration tests](./07-integration-tests.md) — test against a real PostgreSQL with Testcontainers.
