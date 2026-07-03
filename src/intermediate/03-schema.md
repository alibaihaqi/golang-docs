---
title: Schema
tier: intermediate
platform: golang
position: 3
---

# Schema

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate › Schema

**Goal**

Open a SQLite database and create the `items` table. After this page you have an `openDB` helper every later page imports.

**Prerequisites**

- [Project setup](./02-project-setup.md)

## How `database/sql` works

Go's standard library ships `database/sql` — a generic interface for SQL databases. It does not ship any database itself. You bring a *driver* by importing it for its side-effect (the blank import below). The driver registers itself with `database/sql` under a name; you pass that name to `sql.Open`.

For `modernc.org/sqlite` the driver name is `"sqlite"`.

## The `openDB` helper

Add a new file `db.go` to your `items/` module:

```go
package main

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS items (
		id   INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL
	)`)
	if err != nil {
		return nil, err
	}
	return db, nil
}
```

`sql.Open` does not connect to the database immediately — it validates the driver name and returns a handle. The actual connection happens on the first query. Calling `Exec` right after forces that connection and creates the table in one step.

`CREATE TABLE IF NOT EXISTS` means the table creation is idempotent — safe to call every time the server starts.

## Checkpoint

Temporarily edit `main.go` to call `openDB` and verify the file is created:

```go
package main

import "log"

func main() {
	_, err := openDB("items.db")
	if err != nil {
		log.Fatal(err)
	}
}
```

Run:

```bash
go run .
ls items.db
```

Expected:

```
items.db
```

The file is created on disk. Remove the `items.db` file before continuing — the next pages create it fresh at startup via `main`.

**Next** → [04 Store layer](./04-store-layer.md)
