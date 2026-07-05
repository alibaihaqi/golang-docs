---
title: Golang Advanced — production-ready CRUD API
tier: advanced
platform: golang
---

# Golang Advanced

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced

## What you'll build

You upgrade the SQLite-backed CRUD API from Intermediate into a production-ready REST service with PostgreSQL, JWT authentication, HTTP middleware, Docker deployment, integration tests, and CI/CD. By the end you have a containerized API running against PostgreSQL with auth, rate limiting, graceful shutdown, and benchmarks.

## Prerequisites

- Complete the [Intermediate tier](../intermediate/) (SQLite CRUD /items API)
- Docker installed (`docker --version`) — see the [Docker appendix](https://alibaihaqi.github.io/learning-docs/docker/01-what-is-docker.html) if you're new to Docker
- Go 1.22+

## The ladder

1. [01 Why PostgreSQL](./01-why-postgresql.md) — SQLite limits in production
2. [02 Migrate to PostgreSQL](./02-migrate-to-postgresql.md) — pgx, connection pool, schema
3. [03 HTTP middleware](./03-http-middleware.md) — logging, request ID, recovery
4. [04 JWT auth middleware](./04-jwt-auth-middleware.md) — sign and verify tokens
5. [05 Rate limiting](./05-rate-limiting.md) — per-IP token bucket
6. [06 Docker multistage](./06-docker-multistage.md) — Dockerfile + docker-compose with Postgres
7. [07 Integration tests](./07-integration-tests.md) — Testcontainers for Postgres
8. [08 Benchmarks and profiling](./08-benchmarks-and-profiling.md) — pprof, benchmarks
9. [09 Graceful shutdown](./09-graceful-shutdown.md) — signal handling, context cancel
10. [10 CI/CD GitHub Actions](./10-ci-cd-github-actions.md) — lint, test, build, push, deploy

**Start** → [01 Why PostgreSQL](./01-why-postgresql.md)
