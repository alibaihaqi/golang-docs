---
title: Structured logging
tier: expert
platform: golang
---

# Structured logging

The consumer from the previous page works, but its logs are plain text — human-readable but not machine-parseable. In production, you need logs that are grep-able, aggregatable, and correlatable across services. This page replaces plain logging with `log/slog` and JSON output.

## Why structured logging

Plain text logs look like this:

```
INFO produced event event_id=ord_001 user_id=user_1
INFO consumed event event_id=ord_001 user_id=user_1 amount=29.99
ERROR decode error, skipping error=unexpected end of JSON input partition=0 offset=42
```

These are fine for tailing a terminal. They break down when you need to:

- **Search by field** — grep for `user_id=user_1` works but is fragile; a field containing the string would false-match
- **Aggregate** — extract all events where `amount > 100` requires regex, not a query
- **Correlate** — link a producer log to a consumer log for the same event requires matching by event ID across separate log streams
- **Ship to aggregators** — Loki, ELK, Datadog, and CloudWatch expect structured key-value data, not prose

Structured logging outputs each field as a named key-value pair. The default format is JSON:

```json
{"time":"2026-07-09T10:30:00Z","level":"INFO","msg":"consumed event","event_id":"ord_001","user_id":"user_1","amount":29.99}
```

Every field is a top-level key. You can filter by `event_id`, aggregate by `amount`, and correlate across producers and consumers with structured identifiers.

## slog JSON handler

Go 1.21 introduced `log/slog` in the standard library. The JSON handler serializes log output as newline-delimited JSON:

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelInfo,
}))
slog.SetDefault(logger)
```

Setting the default logger means every call to `slog.Info`, `slog.Error`, `slog.Warn`, and `slog.Debug` throughout your program uses the JSON handler. No imports to change in existing call sites — just set the default once at startup.

### Handler options

| Option | Purpose |
|--------|---------|
| `Level` | Minimum log level — messages below this level are discarded |
| `AddSource` | Adds the source file and line number to each log entry |
| `ReplaceAttr` | Transform or remove specific attributes (e.g., rename `time` to `@timestamp`) |

For production, enable `AddSource` for easier debugging:

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level:     slog.LevelInfo,
    AddSource: true,
}))
```

## Contextual attributes

Most log entries in your service share common metadata — the service name, version, and current operation. Instead of repeating these on every call, use `slog.With` to create a logger that carries them:

```go
logger := slog.With(
    "service", "event-processor",
    "version", "1.0.0",
)
```

Every subsequent call from this logger includes those fields automatically:

```go
logger.Info("processing event",
    "event_id", event.ID,
    "user_id", event.UserID,
    "amount", event.Amount,
    "partition", msg.Partition,
    "offset", msg.Offset,
)
```

Output:

```json
{"time":"2026-07-09T10:30:00Z","level":"INFO","msg":"processing event","service":"event-processor","version":"1.0.0","event_id":"ord_001","user_id":"user_1","amount":29.99,"partition":0,"offset":0}
```

The `service` and `version` fields appear in every log line without repeating them. This is useful for filtering in log aggregators — a Loki query like `{service="event-processor"} | json | amount > 100` gives you every high-value event across all instances.

## Log levels

`slog` provides four levels, each for a different category of information:

| Level | Use for | Example |
|-------|---------|---------|
| `Debug` | Development details, high-frequency internal state | Partition assignment changes, batch sizes, retry timing |
| `Info` | Normal operations, expected milestones | Event produced/consumed, service started, topic created |
| `Warn` | Handled errors that may need attention | Retries exhausted, DLQ send, slow processing |
| `Error` | Unhandled errors, failures that need immediate action | Connection lost, decode failure, DLQ write failed |

Set the level based on your environment:

```go
// Development: see everything
level := slog.LevelDebug

// Production: filter noise
level := slog.LevelInfo

// Debugging an incident in production: temporarily lower
level := slog.LevelDebug
```

### Debug logging

Add debug-level logs for high-frequency events that you only need when investigating an issue:

```go
slog.Debug("fetched message",
    "partition", msg.Partition,
    "offset", msg.Offset,
    "key", string(msg.Key),
    "size", len(msg.Value),
)
```

These are discarded when the level is set to `Info` or above. In production, you can lower the level dynamically (via an HTTP endpoint or environment variable) without redeploying.

## Replacing plain log with slog

Update the producer and consumer to use structured logging throughout. Here is the complete updated `main.go`:

```go
package main

import (
    "context"
    "encoding/json"
    "log/slog"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/segmentio/kafka-go"
)

type OrderEvent struct {
    ID        string    `json:"id"`
    UserID    string    `json:"user_id"`
    Amount    float64   `json:"amount"`
    Items     []string  `json:"items"`
    Timestamp time.Time `json:"timestamp"`
}

func main() {
    // Set up structured JSON logging
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))
    slog.SetDefault(logger)

    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    addr := kafka.TCP("localhost:9092")
    ensureTopic(ctx, addr, "orders", 3)

    // Producer goroutine
    go produceEvents(ctx, addr)

    // Consumer on main goroutine
    reader := kafka.NewReader(kafka.ReaderConfig{
        Brokers:   []string{"localhost:9092"},
        GroupID:   "order-processor",
        Topic:     "orders",
        MinBytes:  10e3,
        MaxBytes:  10e6,
        MaxWait:   1 * time.Second,
    })
    defer reader.Close()

    slog.Info("consumer started")
    consume(ctx, reader)
    slog.Info("consumer stopped")
}

func produceEvents(ctx context.Context, addr kafka.Addr) {
    time.Sleep(2 * time.Second)

    log := slog.With("component", "producer")

    writer := &kafka.Writer{
        Addr:     addr,
        Topic:    "orders",
        Balancer: &kafka.Hash{},
    }
    defer writer.Close()

    events := []OrderEvent{
        {ID: "ord_001", UserID: "user_1", Amount: 29.99, Items: []string{"widget-a"}, Timestamp: time.Now()},
        {ID: "ord_002", UserID: "user_1", Amount: 49.50, Items: []string{"widget-b", "widget-c"}, Timestamp: time.Now()},
        {ID: "ord_003", UserID: "user_2", Amount: 9.99, Items: []string{"widget-d"}, Timestamp: time.Now()},
        {ID: "ord_004", UserID: "user_3", Amount: 199.00, Items: []string{"widget-e", "widget-f", "widget-g"}, Timestamp: time.Now()},
        {ID: "ord_005", UserID: "user_2", Amount: 14.99, Items: []string{"widget-h"}, Timestamp: time.Now()},
    }

    for _, event := range events {
        data, err := json.Marshal(event)
        if err != nil {
            log.Error("marshal failed", "event_id", event.ID, "error", err)
            continue
        }

        msg := kafka.Message{
            Key:   []byte(event.UserID),
            Value: data,
            Headers: []kafka.Header{
                {Key: "event_type", Value: []byte("order.created")},
            },
        }

        if err := writer.WriteMessages(ctx, msg); err != nil {
            log.Error("produce failed", "event_id", event.ID, "error", err)
            continue
        }
        log.Info("produced event",
            "event_id", event.ID,
            "user_id", event.UserID,
            "amount", event.Amount,
            "items", event.Items,
        )
    }

    log.Info("all events produced", "count", len(events))
}

func consume(ctx context.Context, r *kafka.Reader) {
    log := slog.With("component", "consumer")

    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            if ctx.Err() != nil {
                return
            }
            log.Error("read failed", "error", err)
            continue
        }

        log.Debug("message received",
            "partition", msg.Partition,
            "offset", msg.Offset,
            "key", string(msg.Key),
            "size", len(msg.Value),
        )

        var event OrderEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            log.Error("decode error, skipping",
                "error", err,
                "partition", msg.Partition,
                "offset", msg.Offset,
            )
            continue
        }

        log.Info("consumed event",
            "event_id", event.ID,
            "user_id", event.UserID,
            "amount", event.Amount,
            "items", event.Items,
            "partition", msg.Partition,
            "offset", msg.Offset,
        )
    }
}

func ensureTopic(ctx context.Context, addr kafka.Addr, topic string, partitions int) {
    log := slog.With("component", "admin")

    conn, err := kafka.DialContext(ctx, "tcp", "localhost:9092")
    if err != nil {
        log.Error("failed to dial", "error", err)
        os.Exit(1)
    }
    defer conn.Close()

    existingPartitions, err := conn.ReadPartitions()
    if err != nil {
        log.Error("failed to read partitions", "error", err)
        os.Exit(1)
    }

    for _, p := range existingPartitions {
        if p.Topic == topic {
            log.Info("topic already exists", "topic", topic)
            return
        }
    }

    admin := kafka.NewAdmin(addr)
    defer admin.Close()

    err = admin.CreateTopics(ctx, kafka.TopicConfig{
        Topic:             topic,
        NumPartitions:     partitions,
        ReplicationFactor: 1,
    })
    if err != nil {
        log.Error("failed to create topic", "topic", topic, "error", err)
        os.Exit(1)
    }

    log.Info("created topic", "topic", topic, "partitions", partitions)
}
```

### What changed

Each component (`producer`, `consumer`, `admin`) gets its own `slog.With` logger that includes the component name. This means every log line from the consumer automatically carries `"component":"consumer"`, making it easy to filter in a log aggregator.

## Before and after

### Before — plain text logging

```
INFO produced event event_id=ord_001 user_id=user_1
INFO consumed event event_id=ord_001 user_id=user_1 amount=29.99
ERROR decode error, skipping error=unexpected end of JSON input partition=0 offset=42
```

### After — structured JSON logging

```json
{"time":"2026-07-09T10:30:00Z","level":"INFO","msg":"produced event","component":"producer","event_id":"ord_001","user_id":"user_1","amount":29.99,"items":["widget-a"]}
{"time":"2026-07-09T10:30:00Z","level":"INFO","msg":"consumed event","component":"consumer","event_id":"ord_001","user_id":"user_1","amount":29.99,"items":["widget-a"],"partition":0,"offset":0}
{"time":"2026-07-09T10:30:00Z","level":"ERROR","msg":"decode error, skipping","component":"consumer","error":"unexpected end of JSON input","partition":0,"offset":42}
```

The JSON output is parseable by every log aggregator. Pipe it through `jq` for ad-hoc queries:

```bash
go run main.go 2>&1 | jq 'select(.level == "ERROR")'
go run main.go 2>&1 | jq 'select(.amount > 100)'
go run main.go 2>&1 | jq 'select(.user_id == "user_2")'
```

## Using AddSource for debugging

Enable source location to see which file and line number produced each log entry:

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level:     slog.LevelDebug,
    AddSource: true,
}))
```

Output includes the source file and line:

```json
{"time":"2026-07-09T10:30:00Z","level":"INFO","source":{"function":"main.produceEvents","file":"main.go","line":72},"msg":"produced event",...}
```

This is invaluable when you have multiple packages logging — you can see exactly where each log line originated without searching for the message string.

## Running the checkpoint

With Kafka running:

```bash
go run main.go | jq .
```

The `jq` filter pretty-prints each JSON log line. You should see structured output with every field as a named key:

```json
{
  "time": "2026-07-09T10:30:00Z",
  "level": "INFO",
  "msg": "consumer started"
}
{
  "time": "2026-07-09T10:30:02Z",
  "level": "INFO",
  "msg": "produced event",
  "component": "producer",
  "event_id": "ord_001",
  "user_id": "user_1",
  "amount": 29.99,
  "items": ["widget-a"]
}
{
  "time": "2026-07-09T10:30:02Z",
  "level": "INFO",
  "msg": "consumed event",
  "component": "consumer",
  "event_id": "ord_001",
  "user_id": "user_1",
  "amount": 29.99,
  "items": ["widget-a"],
  "partition": 0,
  "offset": 0
}
```

### Querying the logs

With the output piping to `jq`, you can answer questions in real time:

```bash
# All errors
go run main.go 2>&1 | jq 'select(.level == "ERROR")'

# Events for a specific user
go run main.go 2>&1 | jq 'select(.user_id == "user_2")'

# High-value orders
go run main.go 2>&1 | jq 'select(.amount > 50)'

# Only consumer logs
go run main.go 2>&1 | jq 'select(.component == "consumer")'
```

This is the payoff of structured logging — every field is queryable without regex or text parsing.

## What you learned

- `log/slog` with `JSONHandler` outputs newline-delimited JSON, parseable by log aggregators
- `slog.With` creates loggers with contextual attributes that appear in every entry
- Four log levels (Debug, Info, Warn, Error) separate noise from signal
- `AddSource` adds file and line numbers for debugging across packages
- Structured fields are directly queryable with `jq` and log aggregation tools like Loki and ELK
- Replacing plain `log.Println` calls with `slog` is a mechanical change that pays dividends in production

Your service now has structured, leveled, JSON-formatted logging. The next page adds distributed tracing with OpenTelemetry to correlate events across producer and consumer boundaries.

[Next → Distributed tracing](/expert/06-distributed-tracing)
