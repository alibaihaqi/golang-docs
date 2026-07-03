---
title: Create handler
tier: intermediate
platform: golang
position: 6
---

# Create handler

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate › Create handler

**Goal**

Add `POST /items` with input validation. After this page you can create items through the API and read them back with `GET /items`.

**Prerequisites**

- [List and get handlers](./05-list-get-handlers.md) — the mux and the `Store`

## What the handler does

`POST /items` expects a JSON body with a `name` field. The handler:

1. Decodes the body.
2. Rejects an empty name (a `name` of only whitespace is treated as empty).
3. Calls `store.Create` to insert the row.
4. Returns the new item as JSON with status `201 Created`.

## The handler

Add `handleCreate` to `handlers.go`:

```go
package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func handleCreate(s *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Name string `json:"name"` }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(in.Name) == "" {
			http.Error(w, "name required", http.StatusBadRequest)
			return
		}
		it, err := s.Create(in.Name)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(it)
	}
}
```

`w.WriteHeader(http.StatusCreated)` must come *after* setting headers and *before* writing the body. Calling `WriteHeader` sends the status line and all headers set so far — anything you add after that is ignored.

## Wiring

Add the route to `main.go`:

```go
mux.Handle("POST /items", handleCreate(store))
```

Your full mux block now looks like:

```go
mux := http.NewServeMux()
mux.Handle("GET /items", handleList(store))
mux.Handle("GET /items/{id}", handleGet(store))
mux.Handle("POST /items", handleCreate(store))
```

## Checkpoint

```bash
go run .
```

In a second terminal, create an item:

```bash
curl -s -X POST http://localhost:8080/items \
  -H "Content-Type: application/json" \
  -d '{"name":"pen"}'
```

Expected (status 201):

```json
{"id":1,"name":"pen"}
```

List all items:

```bash
curl http://localhost:8080/items
```

Expected:

```json
[{"id":1,"name":"pen"}]
```

Test validation — send an empty name:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/items \
  -H "Content-Type: application/json" \
  -d '{"name":""}'
```

Expected: `400`

Stop the server with `Ctrl-C`.

**Next** → [07 Config](./07-config.md)
