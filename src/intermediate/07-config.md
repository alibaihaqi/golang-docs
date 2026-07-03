---
title: Config
tier: intermediate
platform: golang
position: 7
---

# Config

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate › Config

**Goal**

Make the database path configurable via an environment variable and assemble the complete `main` function. After this page you have the full runnable server.

**Prerequisites**

- [Create handler](./06-create-handler.md) — all three handlers wired to the mux

## Environment variable config

Hard-coding `"items.db"` in `main` means tests and production share the same file path. A single environment variable (`ITEMS_DB`) fixes that: the caller sets a path; the binary defaults to `items.db` if the variable is absent.

## The complete `main.go`

Replace `main.go` with the final version:

```go
package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	path := os.Getenv("ITEMS_DB")
	if path == "" {
		path = "items.db"
	}
	db, err := openDB(path)
	if err != nil {
		log.Fatal(err)
	}
	store := &Store{db: db}
	mux := http.NewServeMux()
	mux.Handle("GET /items", handleList(store))
	mux.Handle("GET /items/{id}", handleGet(store))
	mux.Handle("POST /items", handleCreate(store))
	log.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

`os.Getenv` returns an empty string if the variable is not set — the `if path == ""` guard applies the default. This pattern avoids importing a config library for a single value.

## Checkpoint

Run with a custom path:

```bash
ITEMS_DB=/tmp/x.db go run .
```

Expected output (then Ctrl-C):

```
2024/01/01 00:00:00 listening on :8080
```

Verify the file was created at the custom path:

```bash
ls /tmp/x.db
```

Expected:

```
/tmp/x.db
```

Run without the variable to confirm the default:

```bash
go run .
```

A fresh `items.db` is created in the current directory.

**Next** → [08 Tests](./08-tests.md)
