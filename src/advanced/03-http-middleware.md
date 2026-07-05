---
title: HTTP middleware
tier: advanced
platform: golang
position: 3
---

# HTTP middleware

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › HTTP middleware

**Goal**

Add logging, request ID, and panic recovery middleware that wraps every HTTP handler.

**Prerequisites**

- [Migrate to PostgreSQL](./02-migrate-to-postgresql.md)

## Why middleware

A middleware is a function that wraps an `http.Handler`, runs before/after it, and can modify the request or response. Middleware keeps cross-cutting concerns like logging, timing, and error recovery out of your business logic.

Create `middleware.go`:

```go
package main

import (
	"log"
	"net/http"
	"time"
	"crypto/rand"
	"fmt"
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}
```

## Request ID middleware

Assign a unique ID to every request. The handler can read it via `context.Context`:

```go
type ctxKey string

const reqIDKey ctxKey = "request_id"

func requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, _ := rand.Prime(rand.Reader, 32)
		reqID := fmt.Sprintf("%x", id)
		ctx := context.WithValue(r.Context(), reqIDKey, reqID)
		w.Header().Set("X-Request-ID", reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
```

## Logging middleware

Log every request — method, path, status, and duration:

```go
func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		log.Printf("%s %s %d %s",
			r.Method, r.URL.Path, rw.status, time.Since(start))
	})
}
```

## Panic recovery middleware

If a handler panics, recover, log the stack trace, and return 500:

```go
func recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("panic: %v", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
```

## Wire middlewares together

Update `main.go` to chain the middlewares:

```go
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

	mux := http.NewServeMux()
	mux.HandleFunc("GET /items", handleList(store))
	mux.HandleFunc("GET /items/{id}", handleGet(store))
	mux.HandleFunc("POST /items", handleCreate(store))

	handler := recovery(logging(requestID(mux)))

	log.Println("listening on :8080")
	http.ListenAndServe(":8080", handler)
}
```

## Checkpoint

```bash
go run .
# In another terminal:
curl -i http://localhost:8080/items
# Response includes X-Request-ID header
# Server logs: GET /items 200 1.2ms
```

**Next:** [JWT auth middleware](./04-jwt-auth-middleware.md) — protect endpoints with bearer tokens.
