---
title: Tests
tier: intermediate
platform: golang
position: 8
---

# Tests

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate › Tests

**Goal**

Write table-driven store tests and handler tests using an in-memory SQLite database and `net/http/httptest`. After this page `go test ./...` passes and the project is complete.

**Prerequisites**

- [Config](./07-config.md) — the complete `main.go` and all helper files

## Why in-memory SQLite for tests

Passing `":memory:"` to `openDB` opens a database that lives entirely in RAM and is discarded when the connection closes. Tests run fast and leave no files on disk.

## The test helper

Add a file `items_test.go` to your `items/` module:

```go
package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := openDB(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	return &Store{db: db}
}
```

`t.Helper()` marks `newTestStore` as a helper — if it calls `t.Fatal`, the error line number reported in the test output points at the calling test, not at `newTestStore` itself.

## Store tests

```go
func TestStoreCreateAndGet(t *testing.T) {
	s := newTestStore(t)
	created, err := s.Create("pen")
	if err != nil {
		t.Fatal(err)
	}
	got, err := s.Get(created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "pen" {
		t.Fatalf("got %q want pen", got.Name)
	}
}
```

This test exercises the full round-trip through the store without an HTTP server: create an item, then read it back by ID.

## Handler tests

```go
func TestHandleCreateValidation(t *testing.T) {
	s := newTestStore(t)
	cases := []struct {
		body string
		code int
	}{
		{`{"name":"pen"}`, http.StatusCreated},
		{`{"name":""}`, http.StatusBadRequest},
		{`not json`, http.StatusBadRequest},
	}
	for _, c := range cases {
		req := httptest.NewRequest("POST", "/items", strings.NewReader(c.body))
		rec := httptest.NewRecorder()
		handleCreate(s)(rec, req)
		if rec.Code != c.code {
			t.Errorf("body %q: got %d want %d", c.body, rec.Code, c.code)
		}
	}
}
```

`httptest.NewRequest` builds a fake `*http.Request`. `httptest.NewRecorder` captures the response — status code, headers, body — without starting a real server. Together they let you call a handler function directly and inspect the result.

The table has three cases: valid input (201), empty name (400), and malformed JSON (400).

## Checkpoint

```bash
go test ./...
```

Expected:

```
ok  	items	0.012s
```

If you see a failure on the `{"name":"pen"}` case returning 200 instead of 201, check that `w.WriteHeader(http.StatusCreated)` is present in `handleCreate` before `json.NewEncoder(w).Encode`.

---

## You finished the intermediate tier. What's next?

You now have a SQLite-backed CRUD API with a store layer, config, and tests — all pure Go. Two paths from here.

1. **Deploy it.** The AWS beginner tier on the [Hub](https://alibaihaqi.github.io/learning-docs/) shows you how to run this server on a cloud instance.
2. **Add more endpoints.** Delete (`DELETE /items/{id}`) and update (`PUT /items/{id}`) follow the same store + handler pattern you learned on pages 04–06.
