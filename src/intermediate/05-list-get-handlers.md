---
title: List and get handlers
tier: intermediate
platform: golang
position: 5
---

# List and get handlers

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate › List and get handlers

**Goal**

Add `GET /items` and `GET /items/{id}` using Go 1.22 `http.ServeMux` pattern routing. After this page the server returns items from SQLite.

**Prerequisites**

- [Store layer](./04-store-layer.md) — the `Store` type with `List` and `Get`

## Go 1.22 ServeMux patterns

Go 1.22 added method and wildcard support to `http.ServeMux`. You can now write:

```go
mux.Handle("GET /items", handler)
mux.Handle("GET /items/{id}", handler)
```

The leading `GET` restricts the route to GET requests only. `{id}` is a wildcard — its value is available inside the handler via `r.PathValue("id")`. No third-party router is needed.

## The handlers

Add a new file `handlers.go` to your `items/` module:

```go
package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
)

func handleList(s *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		items, err := s.List()
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	}
}

func handleGet(s *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "bad id", http.StatusBadRequest)
			return
		}
		it, err := s.Get(id)
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		} else if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(it)
	}
}
```

Each handler is a *constructor function* — it takes a `*Store` and returns an `http.HandlerFunc`. The store is captured in a closure, so the handler always uses the same store instance.

`handleGet` distinguishes two error cases: `sql.ErrNoRows` means the ID does not exist (404), any other error is a server fault (500).

## Wiring

Update `main.go` to create the mux and register both routes (you will replace `main.go` with the full version on page 07 — for now this skeleton is enough to test):

```go
package main

import (
	"log"
	"net/http"
)

func main() {
	db, err := openDB("items.db")
	if err != nil {
		log.Fatal(err)
	}
	store := &Store{db: db}

	mux := http.NewServeMux()
	mux.Handle("GET /items", handleList(store))
	mux.Handle("GET /items/{id}", handleGet(store))

	log.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

## Checkpoint

```bash
go run .
```

In a second terminal:

```bash
curl http://localhost:8080/items
```

Expected output (empty database, so an empty array):

```
null
```

> **Note:** `json.NewEncoder.Encode` encodes a nil slice as `null`. If you want `[]` for an empty list, initialise `items` as `[]Item{}` inside `List`. Either is valid JSON — the tests on page 08 use the nil form.

```bash
curl http://localhost:8080/items/1
```

Expected:

```
not found
```

Stop the server with `Ctrl-C`.

**Next** → [06 Create handler](./06-create-handler.md)
