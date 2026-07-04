# Changelog

All notable changes to the Golang learning-docs site. Newest first.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

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
