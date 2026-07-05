---
title: Rate limiting
tier: advanced
platform: golang
position: 5
---

# Rate limiting

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › Rate limiting

**Goal**

Add a per-IP token bucket rate limiter. Clients exceeding 10 requests/second get a 429 response.

**Prerequisites**

- [JWT auth middleware](./04-jwt-auth-middleware.md)

## Token bucket algorithm

A token bucket starts with N tokens. Each request consumes one token. Tokens refill at a fixed rate. When the bucket is empty, the request is rejected.

This allows short bursts (up to N requests) while enforcing a sustained rate limit.

## Rate limiter middleware

Create `ratelimit.go`:

```go
package main

import (
	"log"
	"net/http"
	"sync"
	"time"
)

type bucket struct {
	tokens    int
	lastRefill time.Time
	max       int
	interval  time.Duration
}

type rateLimiter struct {
	mu    sync.Mutex
	buckets map[string]*bucket
	max   int
	rate  time.Duration
}

func newRateLimiter(max int, interval time.Duration) *rateLimiter {
	return &rateLimiter{
		buckets: make(map[string]*bucket),
		max:     max,
		rate:    interval,
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[ip]
	if !ok {
		rl.buckets[ip] = &bucket{
			tokens:    rl.max,
			max:       rl.max,
			interval:  rl.rate,
			lastRefill: time.Now(),
		}
		b = rl.buckets[ip]
	}
	// Refill
	elapsed := time.Since(b.lastRefill)
	b.tokens += int(elapsed / b.interval)
	if b.tokens > b.max {
		b.tokens = b.max
	}
	b.lastRefill = time.Now()

	if b.tokens == 0 {
		return false
	}
	b.tokens--
	return true
}
```

## Wire it as middleware

Add the rate limiter middleware:

```go
func rateLimit(next http.Handler) http.Handler {
	rl := newRateLimiter(10, time.Second) // 10 req/s
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if !rl.allow(ip) {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

## Update middleware chain

In `main.go`, add rate limiting after recovery but before routing:

```go
handler := recovery(rateLimit(logging(requestID(mux))))
```

Now every endpoint is rate-limited regardless of auth status. The `/login` endpoint is also protected against brute force.

## Checkpoint

```bash
go run .
# Rapid-fire requests:
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/items
done
# First ~10 return 200, then 429
```

**Next:** [Docker multistage](./06-docker-multistage.md) — containerize the API with a production Dockerfile.
