---
title: Sync primitives and Context
tier: go-language
platform: golang
---

# Sync primitives and Context

[Go Language](./index.md) › 10 Sync primitives and Context

## `sync.WaitGroup`

A `WaitGroup` waits for a collection of goroutines to finish — a counter where `Add` increments, `Done` decrements, and `Wait` blocks until the counter reaches zero.

```go
var wg sync.WaitGroup

for i := 0; i < 5; i++ {
    wg.Add(1)
    go func(id int) {
        defer wg.Done()
        fmt.Printf("goroutine %d done\n", id)
    }(i)
}

wg.Wait()
fmt.Println("all goroutines finished")
```

### Rules

- `Add` must be called **before** the goroutine starts, not inside it — otherwise `Wait` might return prematurely.
- `Done` via `defer` so it executes even on panic.
- Create a new `WaitGroup` for each batch — not designed to be copied after first use.

### Error collection

```go
var wg sync.WaitGroup
errs := make([]error, numJobs)

for i := 0; i < numJobs; i++ {
    wg.Add(1)
    go func(i int) {
        defer wg.Done()
        if err := process(i); err != nil {
            errs[i] = err
        }
    }(i)
}

wg.Wait()
```

Works when goroutines write to disjoint indices. For shared state, use `sync.Mutex`.

## `sync.Mutex` and `sync.RWMutex`

### Mutex

Exclusive access — only one goroutine can hold the lock at a time:

```go
type Counter struct {
    mu    sync.Mutex
    value int
}

func (c *Counter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.value++
}
```

Discipline: lock late, unlock early. Always use `defer`. Never copy a mutex — pass mutex-containing structs by pointer.

### RWMutex

Distinguishes readers and writers:

- `RLock` — shared read lock (multiple readers).
- `Lock` — exclusive write lock (blocks readers and other writers).

```go
type Config struct {
    mu     sync.RWMutex
    values map[string]string
}

func (c *Config) Get(key string) (string, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    v, ok := c.values[key]
    return v, ok
}

func (c *Config) Set(key, value string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.values[key] = value
}
```

RWMutex excels in read-heavy workloads (80%+ reads). For simpler cases, a plain `sync.Mutex` is faster and simpler.

## `sync.Once`

Runs a function exactly once, race-free:

```go
var (
    once     sync.Once
    instance *Database
)

func GetDatabase() *Database {
    once.Do(func() {
        instance = connectToDatabase()
    })
    return instance
}
```

### Uses
- Singleton initialisation, lazy configuration, one-time registration.
- If the function panics, `Do` considers the call completed — subsequent calls will not retry.

## `sync.Cond`

Condition variable for goroutines waiting on state changes. Rarely needed — channels cover most coordination patterns.

```go
var (
    mu    sync.Mutex
    cond  = sync.NewCond(&mu)
    ready bool
)

func waitForReady() {
    mu.Lock()
    for !ready { cond.Wait() }
    mu.Unlock()
}

func setReady() {
    mu.Lock()
    ready = true
    cond.Broadcast()
    mu.Unlock()
}
```

`Signal()` wakes one, `Broadcast()` wakes all. Prefer channels in most cases.

## `sync.Map`

Concurrent-safe map for specific workloads (Go 1.9+). Not a general `map + RWMutex` replacement.

```go
var m sync.Map

m.Store("key", "value")
v, ok := m.Load("key")
m.LoadOrStore("key2", "default")
m.Delete("key")
m.Range(func(key, value any) bool {
    fmt.Println(key, value)
    return true
})
```

### When to use

- Write-once, read-many (config maps, registries).
- Read-heavy with disjoint keys.
- You have a benchmark proving it is faster.

In all other cases, use `map + RWMutex` — it is simpler.

## `sync/atomic`

Lock-free atomic operations on integers, pointers, and booleans.

```go
var counter atomic.Int64 // Go 1.19+

for i := 0; i < 100; i++ {
    go func() { counter.Add(1) }()
}

fmt.Println(counter.Load()) // 100
```

Before Go 1.19:

```go
var counter int64
atomic.AddInt64(&counter, 1)
value := atomic.LoadInt64(&counter)
```

### `atomic.Value`

Lock-free load/store of any type — useful for immutable config snapshots:

```go
var config atomic.Value
config.Store(&Config{Addr: ":8080"})
cfg := config.Load().(*Config)
```

### When to use atomic

- Simple counters and flags (metrics, status indicators).
- Lock-free config (single value replaced occasionally).
- Performance-critical paths where mutex overhead matters.

Atomics cannot protect complex structures — use a mutex for those.

## Context

`context.Context` carries deadlines, cancellation signals, and request-scoped values. It is the standard mechanism for propagating cancellation through a Go program.

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done() <-chan struct{}
    Err() error
    Value(key any) any
}
```

### Creating contexts

```go
ctx := context.Background()                        // root, never cancelled
ctx := context.TODO()                               // placeholder

ctx, cancel := context.WithCancel(context.Background())
defer cancel()

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(5*time.Second))
defer cancel()
```

### Context tree

Contexts form a tree — parent cancellation propagates to all children:

```go
parent, parentCancel := context.WithCancel(context.Background())
child, _ := context.WithTimeout(parent, 5*time.Second)

parentCancel() // child is cancelled immediately
```

### Using context in functions

Pass `ctx` as the first argument to any blocking or I/O function:

```go
func FetchData(ctx context.Context, url string) ([]byte, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil { return nil, err }
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return nil, err }
    defer resp.Body.Close()
    return io.ReadAll(resp.Body)
}
```

### Checking cancellation

```go
func Process(ctx context.Context, data []byte) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
    }
    result, err := expensiveOperation(ctx, data)
    if errors.Is(err, context.Canceled) {
        return nil // caller cancelled, clean exit
    }
    return err
}
```

### Context values

```go
type contextKey string
const requestIDKey contextKey = "request_id"

func WithRequestID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, requestIDKey, id)
}

func GetRequestID(ctx context.Context) (string, bool) {
    id, ok := ctx.Value(requestIDKey).(string)
    return id, ok
}
```

Guidelines:
- Use unexported context keys to avoid collisions.
- Only for request-scoped data (request IDs, auth tokens, tracing spans).
- Not for optional function parameters — those belong in the signature.

## `errgroup` pattern

`golang.org/x/sync/errgroup` extends `sync.WaitGroup` with error propagation and context cancellation:

```go
import "golang.org/x/sync/errgroup"

func main() {
    g, ctx := errgroup.WithContext(context.Background())

    urls := []string{
        "https://example.com/1",
        "https://example.com/2",
        "https://example.com/3",
    }

    for _, url := range urls {
        url := url
        g.Go(func() error {
            return fetchURL(ctx, url)
        })
    }

    if err := g.Wait(); err != nil {
        fmt.Printf("fetch failed: %v\n", err)
    }
}

func fetchURL(ctx context.Context, url string) error {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil { return err }
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return err }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("unexpected status %d", resp.StatusCode)
    }
    return nil
}
```

### How it works

- `g.Go(f)` launches `f` in a goroutine.
- On first non-nil error, the derived context is cancelled.
- `g.Wait()` blocks until all finish, returns the first non-nil error.

### Limited concurrency

```go
g, ctx := errgroup.WithContext(context.Background())
g.SetLimit(10) // max 10 goroutines concurrently

for _, item := range items {
    item := item
    g.Go(func() error { return processItem(ctx, item) })
}

if err := g.Wait(); err != nil {
    log.Fatal(err)
}
```

### errgroup vs WaitGroup

| | WaitGroup | errgroup |
|--|-----------|----------|
| Error handling | Manual | Automatic (first error) |
| Context cancellation | Manual | Built-in |
| Concurrency limit | Manual | SetLimit |
| Std library | `sync` | `golang.org/x/sync` |

Use `errgroup` when goroutines are homogeneous and the first error should abort the rest. Use `WaitGroup` when goroutines are independent and all must finish.

## Links to existing tiers

The [Advanced tier's graceful shutdown](../advanced/09-graceful-shutdown.md) uses `signal.NotifyContext` — a context cancelled by OS signals. The Intermediate tier's `Store` methods accept `context.Context` for operation cancellation. The `sync.Mutex` pattern appears in the Advanced tier's rate limiter.

---

**Next:** [11 Standard library tour](./11-standard-library-tour.md)
