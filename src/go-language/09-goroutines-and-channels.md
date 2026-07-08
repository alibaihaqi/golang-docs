---
title: Goroutines and channels
tier: go-language
platform: golang
---

# Goroutines and channels

[Go Language](./index.md) › 09 Goroutines and channels

## The goroutine model

A **goroutine** is a lightweight thread managed by the Go runtime — the fundamental unit of concurrency in Go.

```go
go func() {
    fmt.Println("hello from goroutine")
}()
// The program continues here without waiting for the goroutine
```

The `go` keyword spawns a function call to run concurrently. It works with anonymous closures and named functions:

```go
func printHello() { fmt.Println("hello") }
go printHello()
```

### M:N scheduling

Go's runtime uses an **M:N scheduler** — it multiplexes M goroutines across N OS threads. The scheduler is cooperatively preemptive, yielding at function calls, channel operations, memory allocation, and I/O syscalls. Goroutines are not scheduled by the OS — the Go runtime decides scheduling.

```go
runtime.GOMAXPROCS(4) // Limit to 4 OS threads
```

The default `GOMAXPROCS` matches the CPU core count and is optimal for most workloads.

### Stack management

Goroutines start with a tiny stack (~4 KB, vs ~1-8 MB per OS thread) that grows and shrinks as needed. This is why you can spawn millions of goroutines without exhausting memory.

| Resource | Goroutine | OS thread |
|----------|-----------|-----------|
| Stack start | ~4 KB | ~1-8 MB |
| Spawn cost | ~1-2 µs | ~10-100 µs |
| Max per process | Millions | Thousands |

The practical limit is blocking resources — each goroutine blocked on a syscall occupies an OS thread.

### Fire-and-forget

The simplest pattern: start a goroutine and let it complete.

```go
go func() {
    result := expensiveComputation()
    log.Printf("result: %v", result)
}()
```

A goroutine exits when its function returns. There is no `kill` — a goroutine must stop itself.

### No return values

A goroutine cannot return a value to its caller — `go` discards the return. Use channels instead:

```go
ch := make(chan int)
go func() {
    ch <- compute()
}()
result := <-ch
```

### The `main` goroutine

When `main()` returns, all goroutines are killed immediately:

```go
func main() {
    go func() { fmt.Println("may never run") }()
    // program exits immediately
}
```

Always ensure goroutines complete before `main()` returns, using channels or `sync.WaitGroup`.

## Channel basics

A **channel** is a typed conduit for sending and receiving values between goroutines. Go's motto: "Do not communicate by sharing memory; instead, share memory by communicating."

```go
ch := make(chan int) // unbuffered channel

go func() { ch <- 42 }()
value := <-ch // 42
```

### Unbuffered channels

Zero capacity. Every send blocks until a receive is ready, and every receive blocks until a send is ready. This provides **synchronisation** — both goroutines rendezvous at the channel operation.

```go
ch := make(chan int)
go func() { ch <- 1 }() // blocks until main receives
v := <-ch                // blocks until goroutine sends
```

### Buffered channels

Fixed capacity. Sends block only when the buffer is full; receives block only when empty.

```go
ch := make(chan int, 3)
ch <- 1 // does not block
ch <- 2
ch <- 3
// ch <- 4 // would block — buffer full

fmt.Println(<-ch) // 1
fmt.Println(<-ch) // 2
```

Use buffered channels when sender and receiver have different throughput rates, for bounded work queues, or to decouple producer and consumer up to the buffer size.

### Channel direction

Function parameters can constrain channel direction at compile time:

```go
func producer(ch chan<- int) { ch <- 42 }   // send-only
func consumer(ch <-chan int) { v := <-ch }  // receive-only
```

### Nil channels

A `nil` channel blocks forever on both send and receive. Useful in `select` to disable a case dynamically.

```go
var ch chan int // nil — sending or receiving blocks forever
```

## Closing and ranging

### `close(ch)`

Closing signals that no more values will be sent:

```go
ch := make(chan int)
go func() {
    for i := 0; i < 5; i++ { ch <- i }
    close(ch)
}()
for v := range ch { fmt.Println(v) } // 0, 1, 2, 3, 4
```

Rules:
- Only the sender closes a channel. Closing on the receiver side panics.
- Sending on a closed channel panics.
- Receiving from a closed, empty channel returns zero value (plus `false` from comma-ok).
- Closing an already-closed channel panics.

### Comma-ok receive

```go
v, ok := <-ch
// ok == true  → value was delivered by a send
// ok == false → channel was closed and empty
```

### `for range` on channels

```go
func sumValues(ch <-chan int) int {
    total := 0
    for v := range ch { total += v }
    return total
}
```

The loop ends automatically when the channel is closed and drained.

## `select`

`select` waits on multiple channel operations simultaneously:

```go
select {
case v := <-ch1:
    fmt.Println("received from ch1:", v)
case ch2 <- value:
    fmt.Println("sent to ch2")
case <-time.After(1 * time.Second):
    fmt.Println("timeout — neither case ready")
default:
    fmt.Println("non-blocking — neither ready")
}
```

### Select rules
- Blocks until one case can proceed.
- If multiple are ready, one is chosen uniformly at random.
- `default` runs immediately if no other case is ready (non-blocking).
- A `nil` channel case is never chosen.

### Timeout pattern

```go
select {
case v := <-ch:
    fmt.Println(v)
case <-time.After(1 * time.Second):
    fmt.Println("timeout")
}
```

### Non-blocking send/receive

```go
select {
case ch <- v:
    fmt.Println("sent")
default:
    fmt.Println("dropped — channel not ready")
}
```

Useful for rate limiting and lossy channels.

### Fan-in

```go
func fanIn(ch1, ch2 <-chan string) <-chan string {
    out := make(chan string)
    go func() {
        for {
            select {
            case v := <-ch1: out <- v
            case v := <-ch2: out <- v
            }
        }
    }()
    return out
}
```

## Worker pool pattern

The canonical Go concurrency pattern: fixed workers consume jobs from a shared channel and send results to another channel.

```go
func worker(id int, jobs <-chan int, results chan<- int) {
    for j := range jobs {
        fmt.Printf("worker %d processing job %d\n", id, j)
        time.Sleep(time.Second)
        results <- j * 2
    }
}

func main() {
    const numJobs = 10
    const numWorkers = 3

    jobs := make(chan int, numJobs)
    results := make(chan int, numJobs)

    for w := 1; w <= numWorkers; w++ {
        go worker(w, jobs, results)
    }

    for j := 1; j <= numJobs; j++ {
        jobs <- j
    }
    close(jobs)

    for r := 1; r <= numJobs; r++ {
        <-results
    }
}
```

### Properties

- **Fixed parallelism:** bounded by `numWorkers`, not `numJobs`.
- **Backpressure:** the buffered jobs channel provides limited backpressure.
- **Fan-out/fan-in:** jobs fanned out across workers, results fanned back.

### Tuning

```go
// CPU-bound: match GOMAXPROCS
numWorkers := runtime.GOMAXPROCS(0)

// I/O-bound: higher than CPU count
numWorkers := 100 // empirical tuning needed
```

### Error handling

```go
type Result struct {
    Value int
    Err   error
}

func worker(id int, jobs <-chan int, results chan<- Result) {
    for j := range jobs {
        v, err := process(j)
        results <- Result{Value: v, Err: err}
    }
}
```

## Common mistakes

### Goroutine leaks

```go
ch := make(chan int)
go func() {
    ch <- expensiveOperation() // blocks forever — nobody receives
}()
// goroutine never exits
```

Fix: ensure every send has a corresponding receive, or use context cancellation.

### Sending on a closed channel

```go
ch := make(chan int)
close(ch)
ch <- 1 // panic
```

Ensure sends complete before closing.

### Closing from the receiver

Only the sender should close. Coordinate multi-sender shutdown with `sync.WaitGroup`.

### Using `time.Sleep` for synchronisation

```go
// Bad
go func() { globalResult = compute() }()
time.Sleep(100 * time.Millisecond) // fragile, race-prone

// Good
ch := make(chan int)
go func() { ch <- compute() }()
result := <-ch
```

### Unbuffered channel deadlock

```go
ch := make(chan int)
ch <- 1 // blocks forever in same goroutine — no receiver
v := <-ch // never reached
```

Sender and receiver must be in different goroutines (or use a buffered channel).

## Links to existing tiers

The Intermediate tier's HTTP server uses `go func()` in test helpers for concurrent requests. The [Advanced tier's graceful shutdown](../advanced/09-graceful-shutdown.md) uses signal channels with `signal.Notify`.

---

**Next:** [10 Sync primitives and Context](./10-sync-primitives-and-context.md)
