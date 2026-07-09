# Changelog

All notable changes to the Golang learning-docs site. Newest first.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 2026-07-09 — feat: add Expert tier (Kafka + OpenTelemetry)

### Added
- **Expert tier** (`src/expert/`, 10 pages + index): build a Kafka event processor with full observability — why event-driven architecture, Kafka KRaft fundamentals, producing events with `segmentio/kafka-go`, consuming events with consumer groups, structured logging with `log/slog`, distributed tracing with OpenTelemetry (OTLP gRPC), Prometheus metrics (counters/histograms), graceful shutdown with signal handling, Docker Compose integration (Kafka + OTel Collector + Jaeger + Prometheus), and Testcontainers integration tests.
- Wired into sidebar (after Go Language), nav, and home feature card.
- Internal dead-link checking preserved for all localhost reference URLs.

## 2026-07-07 — feat: add Go Language deep-dive section

### Added
- **Go Language section** (`src/go-language/`, 14 pages + index): comprehensive language tour — design philosophy, types/constants, control flow/functions, structs/methods, interfaces, generics, error handling, packages/modules, goroutines/channels, sync primitives/Context, standard library, testing/benchmarking, reflection/code generation, CGO interop.
- Wired into sidebar (after Advanced), nav, and home feature card.

## 2026-07-05 — Advanced tier

### Added
- **Advanced tier** (`src/advanced/`, 10 pages + index): upgrades the SQLite CRUD API to a production-ready REST service — PostgreSQL (pgx/pgxpool), JWT auth (`golang-jwt/v5`), HTTP middleware (logging, request ID, recovery, rate limiting), Docker multistage build + docker-compose, Testcontainers integration tests, pprof benchmarks, graceful shutdown, and CI/CD GitHub Actions. Wired into the sidebar, nav, and home feature card.

## 2026-07-04 — Intermediate tier + CI

### Added
- **Intermediate tier** (`src/intermediate/`, 8 pages): extends the beginner
  `GET /items` endpoint into a SQLite-backed CRUD API — `openDB`/schema, a
  `Store` layer, `GET /items`, `GET /items/{id}`, `POST /items` via Go 1.22
  `http.ServeMux` patterns, env-var config, and table-driven + `httptest` tests.
  Pure-Go `modernc.org/sqlite` driver (no cgo). Wired into the sidebar, nav, and
  home feature card.
- **`CLAUDE.md`** — public-safe repo conventions (tier/ladder pattern,
  frontmatter schema, add-a-page/tier steps, build commands, no-secrets rule).

### Changed
- **CI:** pinned Node to `26.4.0` (`.node-version` + `deploy` workflow).

## 2026-06 — Beginner tier + refresh

### Added
- **Beginner tier**: numbered ladder building one std-library `GET /items`
  endpoint returning fixed JSON (`go run main.go` + `curl`).
- Hub back-link on the home page.

### Changed
- Bumped VitePress to 1.6.4; bumped deprecated GitHub Actions.

## 2023 — Initial documentation

### Added
- Initial Golang docs site (VitePress): Go basics, types, control flow, `net/http`
  mux, JSON encoding, and serving JSON; deploy workflow to GitHub Pages; migrated
  package manager from yarn to pnpm.
