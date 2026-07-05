---
title: Benchmarks and profiling
tier: advanced
platform: golang
position: 8
---

# Benchmarks and profiling

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › Benchmarks and profiling

**Goal**

Add Go benchmarks for the Store layer, expose pprof endpoints, and profile the running API.

**Prerequisites**

- [Integration tests](./07-integration-tests.md)

## Benchmarks

Create `store_bench_test.go`:

```go
package main

import (
	"context"
	"fmt"
	"testing"
)

func BenchmarkStoreCreate(b *testing.B) {
	s := setupTestDB(b)
	ctx := context.Background()

	b.ResetTimer()
	for i := range b.N {
		_, err := s.Create(ctx, fmt.Sprintf("item-%d", i))
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkStoreList(b *testing.B) {
	s := setupTestDB(b)
	ctx := context.Background()
	for i := range 100 {
		s.Create(ctx, fmt.Sprintf("item-%d", i))
	}
	b.ResetTimer()

	for range b.N {
		_, err := s.List(ctx)
		if err != nil {
			b.Fatal(err)
		}
	}
}
```

Run benchmarks:

```bash
go test -bench=. -benchmem -timeout 120s .
```

Output:

```
BenchmarkStoreCreate-12    265   4.5 ms/op   1.2 KB/op   28 allocs/op
BenchmarkStoreList-12      412   2.9 ms/op   3.1 KB/op   54 allocs/op
```

## pprof endpoints

Add the `net/http/pprof` import to `main.go`:

```go
import (
	"log"
	"net/http"
	_ "net/http/pprof" // registers /debug/pprof handlers
	"os"
	"time"
)
```

The blank import registers pprof handlers on the default ServeMux. Because your app uses a custom mux, register them manually:

```go
import "runtime/pprof"

// In main(), after setting up the mux:
mux.HandleFunc("GET /debug/pprof/profile", func(w http.ResponseWriter, r *http.Request) {
	pprof.Profile(w, r)
})
```

A simpler approach is to start a separate pprof server on a different port:

```go
// Separate goroutine for profiling
go func() {
	log.Println("pprof on :6060")
	log.Println(http.ListenAndServe("localhost:6060", nil))
}()
```

## Profile a running server

```bash
# Terminal 1: start the server
go run .

# Terminal 2: generate some load
go run tools/load.go  # or a simple loop: for i in $(seq 100); do curl -s localhost:8080/items > /dev/null; done

# Terminal 3: capture a CPU profile
go tool pprof -http=:9090 http://localhost:6060/debug/pprof/profile?seconds=30
```

This opens a web UI showing which functions consume the most CPU time. Common findings:
- `encoding/json.Marshal` — serialization cost
- `pgxpool.(*Pool).Query` — database query time
- `context.Background` — context propagation overhead

## Memory profiling

```bash
# Heap profile
go tool pprof -http=:9091 http://localhost:6060/debug/pprof/heap
```

## Checkpoint

```bash
go test -bench=. -benchmem -timeout 120s . 2>&1 | head -5
# Benchmarks run against a real Postgres (Testcontainers)
# Output shows ops/ns, bytes/op, allocs/op
```

**Next:** [Graceful shutdown](./09-graceful-shutdown.md) — handle OS signals and drain connections cleanly.
