---
title: Store layer
tier: intermediate
platform: golang
position: 4
---

# Store layer

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate › Store layer

**Goal**

Add a `Store` type that wraps `*sql.DB` and exposes `List`, `Get`, and `Create`. After this page the SQL lives in one place and the HTTP handlers never touch it directly.

**Prerequisites**

- [Schema](./03-schema.md) — the `openDB` helper and the `items` table

## Why a store layer

Putting SQL inside HTTP handlers mixes two concerns: routing decisions (`if r.Method == "POST"`) and data access (`db.Query(...)`) end up in the same function. A store type separates them: the handler decides *what* the caller wants, the store decides *how* to fetch it from the database.

This also makes testing easier — the test can call `store.Create("pen")` directly without building an HTTP request.

## The `Item` type and `Store`

Add a new file `store.go` to your `items/` module:

```go
package main

import (
	"database/sql"
)

type Item struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Store struct{ db *sql.DB }

func (s *Store) List() ([]Item, error) {
	rows, err := s.db.Query(`SELECT id, name FROM items ORDER BY id`)
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

func (s *Store) Get(id int64) (Item, error) {
	var it Item
	err := s.db.QueryRow(`SELECT id, name FROM items WHERE id = ?`, id).Scan(&it.ID, &it.Name)
	return it, err
}

func (s *Store) Create(name string) (Item, error) {
	res, err := s.db.Exec(`INSERT INTO items (name) VALUES (?)`, name)
	if err != nil {
		return Item{}, err
	}
	id, err := res.LastInsertId()
	return Item{ID: id, Name: name}, err
}
```

A few things worth noting:

- `rows.Close()` is deferred immediately after checking `err` — if you forget this, the database connection is not returned to the pool.
- `rows.Err()` is checked after the loop. Errors that occur *during* iteration are not returned by `rows.Next()` — they surface only via `rows.Err()`.
- `?` is the placeholder style for SQLite. Never interpolate values into the SQL string directly — use placeholders to prevent SQL injection.

## Checkpoint

```bash
go build ./...
```

Expected: exits 0, no output. The `Store` methods compile but are not called yet — the next page wires them to HTTP handlers.

**Next** → [05 List and get handlers](./05-list-get-handlers.md)
