---
title: Why PostgreSQL
tier: advanced
platform: golang
position: 1
---

# Why PostgreSQL

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › Why PostgreSQL

**Goal**

Understand the limits of the intermediate tier's SQLite setup and why production Go services use a client-server database.

## SQLite is embedded

SQLite runs inside your process — the same process that serves HTTP requests. This works fine for a single instance, but causes problems as soon as you need to scale:

- **Concurrent writers** — SQLite serializes writes; two replicas of your API can deadlock on the same file.
- **No network access** — SQLite is file-based. You can't run your API on one machine and the database on another.
- **Process restart = lost connections** — a crash mid-query can corrupt the database file.

## PostgreSQL is a server

PostgreSQL runs as a separate process (or container) that your API connects to over TCP:

```go
// pgx connection string
postgres://user:pass@localhost:5432/itemsdb?sslmode=disable
```

Benefits:
- **Concurrent access** — Postgres handles thousands of concurrent connections.
- **Network separation** — API and database can live on different machines.
- **Connection pooling** — reuse connections across requests instead of opening a new file handle each time.
- **Rolling deploys** — run two API versions side-by-side pointing at the same database.

## When SQLite is still fine

SQLite is excellent for development, single-user tools, embedded devices, and read-heavy workloads below 100 concurrent writers. The intermediate tier made the right call using it. The advanced tier upgrades because you're building something that could run in production behind a load balancer.

**Checkpoint:** You should be able to explain in one sentence why PostgreSQL replaces SQLite in this tier. Continue to [page 2](./02-migrate-to-postgresql.md) when ready.
