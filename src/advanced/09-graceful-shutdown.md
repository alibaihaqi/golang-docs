---
title: Graceful shutdown
tier: advanced
platform: golang
position: 9
---

# Graceful shutdown

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › Graceful shutdown

**Goal**

Handle SIGINT/SIGTERM so the server drains in-flight requests and closes the database pool before exiting.

**Prerequisites**

- [Docker multistage](./06-docker-multistage.md) — the complete `main.go`

## Why graceful shutdown

Without graceful shutdown, `Ctrl+C` kills the process immediately:

- In-flight requests get truncated responses (partial JSON, broken connections).
- Database connections are closed mid-query.
- Metrics or logs are lost.

Graceful shutdown: on signal, stop accepting new requests, wait for active requests to finish (or timeout), close the database pool, then exit.

## Update main.go

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	pool, err := openPool()
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	if err := migrate(pool); err != nil {
		log.Fatal(err)
	}
	store := &Store{pool: pool}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /items", handleList(store))
	mux.HandleFunc("GET /items/{id}", handleGet(store))
	mux.HandleFunc("POST /items", handleCreate(store))

	handler := recovery(rateLimit(logging(requestID(mux))))

	srv := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	// Wait for signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	// Give in-flight requests up to 10 seconds to finish
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}
	log.Println("server stopped cleanly")
}
```

## What happens on shutdown

1. User presses Ctrl+C → kernel sends SIGINT.
2. `signal.Notify` receives it → unblocks the `<-quit` channel.
3. Log prints "shutting down...".
4. `srv.Shutdown(ctx)` stops accepting new requests, waits for active handlers to finish.
5. After `Shutdown` returns, the deferred `pool.Close()` runs, closing all database connections.
6. Process exits with code 0.

If a request takes longer than 10 seconds, the context deadline fires and the server is forcefully closed.

## Test graceful shutdown

```bash
go run .

# In another terminal:
curl http://localhost:8080/items
# Should work normally

# Now Ctrl+C on the server
# Output:
# 2026/07/05 12:00:00 shutting down...
# 2026/07/05 12:00:00 server stopped cleanly
```

## Checkpoint

The server starts normally, serves requests, and stops cleanly on SIGINT/SIGTERM. Confirm the shutdown logs appear without errors.

**Next:** [CI/CD GitHub Actions](./10-ci-cd-github-actions.md) — automate linting, testing, building, and deployment.
