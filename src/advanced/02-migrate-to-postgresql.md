---
title: Migrate to PostgreSQL
tier: advanced
platform: golang
position: 2
---

# Migrate to PostgreSQL

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › Migrate to PostgreSQL

**Goal**

Replace the SQLite driver with `pgx`, set up a connection pool, and create the `items` table in PostgreSQL.

**Prerequisites**

- [Why PostgreSQL](./01-why-postgresql.md)
- PostgreSQL running (use Docker if you don't have it locally: `docker run -d --name pg -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:17`)

## Add pgx

Remove the SQLite dependency and add pgx:

```bash
go get github.com/jackc/pgx/v5/pgxpool
go get modernc.org/sqlite  # remove with `go mod tidy` after replacing imports
```

## Connection pool

Create `db.go` with a pool instead of `*sql.DB`:

```go
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func openPool() (*pgxpool.Pool, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:pass@localhost:5432/itemsdb?sslmode=disable"
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}
```

`pgxpool.Pool` handles connection pooling internally — it opens connections lazily and reuses them across goroutines.

## Create the schema

Create `schema.go` that runs migrations on startup:

```go
package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

const schema = `
CREATE TABLE IF NOT EXISTS items (
    id   BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL
);`

func migrate(pool *pgxpool.Pool) error {
	_, err := pool.Exec(context.Background(), schema)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
```

`BIGSERIAL` auto-increments like SQLite's `INTEGER PRIMARY KEY AUTOINCREMENT`.

## Update the Store

Replace `*sql.DB` with `*pgxpool.Pool` in `store.go`:

```go
package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Item struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Store struct{ pool *pgxpool.Pool }

func (s *Store) List(ctx context.Context) ([]Item, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name FROM items ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Name); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (Item, error) {
	var it Item
	err := s.pool.QueryRow(ctx, `SELECT id, name FROM items WHERE id = $1`, id).
		Scan(&it.ID, &it.Name)
	if err != nil {
		return it, fmt.Errorf("get %d: %w", id, err)
	}
	return it, nil
}

func (s *Store) Create(ctx context.Context, name string) (Item, error) {
	var it Item
	err := s.pool.QueryRow(ctx,
		`INSERT INTO items (name) VALUES ($1) RETURNING id, name`, name).
		Scan(&it.ID, &it.Name)
	if err != nil {
		return it, fmt.Errorf("create: %w", err)
	}
	return it, nil
}
```

Key changes from the SQLite version:

- Every method now takes `context.Context` — pgx is context-aware throughout.
- `$1` placeholders instead of `?` (PostgreSQL uses `$N` syntax).
- `RETURNING id, name` replaces `LastInsertId` — pgx returns inserted rows directly.

## Update main.go

```go
package main

func main() {
	pool, err := openPool()
	if err != nil {
		panic(err)
	}
	defer pool.Close()
	if err := migrate(pool); err != nil {
		panic(err)
	}
	store := &Store{pool: pool}
	// ... handlers registered against store
}
```

## Checkpoint

```bash
go run .
# Server starts, connects to PostgreSQL, creates the items table
```

If the server starts without a database error, the migration is complete. Stop the server with Ctrl+C.

**Next:** [HTTP middleware](./03-http-middleware.md) — add logging, request ID, and panic recovery.
