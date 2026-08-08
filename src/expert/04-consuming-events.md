---
title: Consuming events
tier: expert
platform: golang
---

# Consuming events

With a producer writing events to the `orders` topic, the next step is building a consumer that reads, decodes, and processes them. This page covers consumer groups, offset management, error handling, and running producer and consumer together.

## Consumer group setup

A `kafka.Reader` in `kafka-go` represents a single consumer within a consumer group. The group coordinates partition assignment across all readers that share the same `GroupID`:

```go
reader := kafka.NewReader(kafka.ReaderConfig{
    Brokers:   []string{"localhost:9092"},
    GroupID:   "order-processor",
    Topic:     "orders",
    MinBytes:  10e3,    // 10KB
    MaxBytes:  10e6,    // 10MB
    MaxWait:   1 * time.Second,
})
defer reader.Close()
```

### Reader config fields

| Field | Purpose |
|-------|---------|
| `Brokers` | List of Kafka broker addresses |
| `GroupID` | Consumer group name — all readers with the same ID share partition assignment |
| `Topic` | The topic to consume from |
| `MinBytes` | Minimum bytes the broker should accumulate before responding (batching efficiency) |
| `MaxBytes` | Maximum bytes the broker will return in a single fetch |
| `MaxWait` | Maximum time to wait if `MinBytes` is not yet satisfied |

The `MinBytes`/`MaxBytes` pair controls the fetch trade-off. Low `MinBytes` means low latency but more network round trips. High `MinBytes` means better throughput but slower individual message delivery. `MaxWait` caps how long the broker holds a request when there is not enough data yet.

## Processing loop

The consumer reads messages in an infinite loop, decodes the JSON value, and processes each event:

```go
func consume(ctx context.Context, r *kafka.Reader) {
    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            if ctx.Err() != nil {
                return // context cancelled — graceful shutdown
            }
            slog.Error("failed to read message", "error", err)
            continue
        }
        var event OrderEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            slog.Error("failed to decode event",
                "error", err,
                "partition", msg.Partition,
                "offset", msg.Offset,
            )
            continue
        }
        processEvent(ctx, event)
        slog.Info("processed event",
            "event_id", event.ID,
            "user_id", event.UserID,
            "partition", msg.Partition,
            "offset", msg.Offset,
        )
    }
}
```

### ReadMessage behavior

`ReadMessage` blocks until a message is available or the context is cancelled. On success it returns a `kafka.Message` containing:

- `Key` — the partition key (in our case, the `UserID`)
- `Value` — the raw bytes (JSON-serialized `OrderEvent`)
- `Topic` — which topic the message came from
- `Partition` — which partition it was read from
- `Offset` — its position within the partition

The loop checks `ctx.Err()` after any read failure to distinguish between a genuine error and a context cancellation from signal handling.

## At-least-once semantics

The `kafka-go` Reader commits offsets automatically after `ReadMessage` returns. This gives you **at-least-once delivery**: every message is delivered at least once, but may be delivered more than once.

Why duplicates? Consider this sequence:

1. `ReadMessage` returns event A
2. The consumer processes event A
3. The process crashes before the offset is committed
4. On restart, the consumer reads from the last committed offset
5. Event A is delivered again

This is the fundamental trade-off of distributed systems — exactly-once delivery across a network is not possible without coordination that adds significant complexity (and Kafka's exactly-once semantics only apply within Kafka itself, not to external side effects).

The practical solution is **idempotent processing**: design your `processEvent` so that processing the same event twice produces the same result. Common patterns:

- **Database upserts** — use the event ID as a unique key; duplicate writes overwrite with the same data
- **Conditional writes** — check a version number or timestamp before applying
- **Idempotency tables** — record processed event IDs and skip duplicates

For this tier, we accept at-least-once semantics and rely on idempotent processing.

## Manual commit

For more control over when offsets are committed, disable auto-commit and call `CommitMessages` explicitly:

```go
reader := kafka.NewReader(kafka.ReaderConfig{
    Brokers:  []string{"localhost:9092"},
    GroupID:  "order-processor",
    Topic:    "orders",
    MinBytes: 10e3,
    MaxBytes: 10e6,
    MaxWait:  1 * time.Second,
})
```

With manual commit, the processing loop commits after each message is fully processed:

```go
func consume(ctx context.Context, r *kafka.Reader) {
    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            if ctx.Err() != nil {
                return
            }
            slog.Error("failed to read message", "error", err)
            continue
        }

        var event OrderEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            slog.Error("failed to decode event", "error", err)
            continue
        }

        if err := processEvent(ctx, event); err != nil {
            slog.Error("processing failed, not committing", "event_id", event.ID, "error", err)
            continue
        }

        if err := r.CommitMessages(ctx, msg); err != nil {
            slog.Error("failed to commit offset", "error", err)
        }
    }
}
```

The difference: with auto-commit, a crash after processing but before commit replays the message. With manual commit, the offset is committed only after `processEvent` succeeds, reducing (but not eliminating) the window for duplicates.

## Error handling

Not all errors should be treated the same way. The consumer needs to distinguish between decode errors (the message is malformed) and processing errors (a transient failure).

### Decode errors — log and skip

A JSON decode error means the message payload is corrupt or incompatible with the current `OrderEvent` struct. Retrying will not help:

```go
if err := json.Unmarshal(msg.Value, &event); err != nil {
    slog.Error("failed to decode event, skipping",
        "error", err,
        "partition", msg.Partition,
        "offset", msg.Offset,
        "raw_value", string(msg.Value),
    )
    continue
}
```

Log the raw value for debugging, skip the message, and move on. In production, you would also emit this to a monitoring system (Prometheus counter, Datadog metric).

### Processing errors — retry then DLQ

Processing errors are often transient — a downstream service is temporarily unavailable, a database connection dropped, a rate limit kicked in. Retry a few times with backoff, then send the message to a dead-letter queue (DLQ):

```go
func processWithRetry(ctx context.Context, r *kafka.Reader, msg kafka.Message, event OrderEvent) error {
    const maxRetries = 3

    for i := range maxRetries {
        err := processEvent(ctx, event)
        if err == nil {
            return nil
        }

        slog.Warn("processing failed, retrying",
            "event_id", event.ID,
            "attempt", i+1,
            "error", err,
        )

        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(min(100*time.Millisecond<<i, 5*time.Second)):
        }
    }

    // All retries exhausted — send to DLQ
    slog.Error("sending to dead-letter queue",
        "event_id", event.ID,
        "partition", msg.Partition,
        "offset", msg.Offset,
    )
    sendToDLQ(ctx, msg)
    return nil
}

func sendToDLQ(ctx context.Context, msg kafka.Message) {
    writer := &kafka.Writer{
        Addr:     kafka.TCP("localhost:9092"),
        Topic:    "orders.dlq",
        Balancer: &kafka.Hash{},
    }
    defer writer.Close()

    if err := writer.WriteMessages(ctx, msg); err != nil {
        slog.Error("failed to write to DLQ", "error", err)
    }
}
```

### Dead-letter queue pattern

A DLQ is a separate topic where messages land after all retries are exhausted. This keeps the main topic flowing while isolating problematic messages for later inspection:

```text
orders topic ──► consumer ──► processEvent()
                                  │
                                  ├── success → commit offset
                                  │
                                  └── 3 failures → orders.dlq topic
                                                         │
                                                         └── manual inspection / replay
```

Messages in the DLQ can be inspected with `kcat`, fixed (if the bug was in the consumer code), and replayed by producing them back to the main topic.

## Rebalancing

When a consumer joins or leaves a consumer group, Kafka reassigns partitions across the remaining members. This is called **rebalancing**.

### What triggers a rebalance

- A new consumer joins the group (scale up)
- A consumer leaves (scale down or crash)
- A consumer fails to heartbeat within the session timeout
- A consumer takes too long to process (exceeds `MaxPollInterval`)

### What happens during rebalance

1. All consumers in the group stop reading
2. Kafka reassigns partitions to the remaining consumers
3. Each consumer resumes reading from its newly assigned partitions

Rebalancing is automatic — `kafka-go`'s Reader handles it transparently. The cost is a brief pause in consumption. For most workloads this is acceptable. If rebalancing becomes a bottleneck (e.g., very large consumer groups), you can tune session timeouts and heartbeat intervals.

### Rebalancing in practice

With a single consumer and 3 partitions, there is no rebalancing to worry about. Add a second consumer to the same group, and Kafka assigns some partitions to the new consumer:

```text
Before:
  Consumer 1 (order-processor): p0, p1, p2

After consumer 2 joins:
  Consumer 1 (order-processor): p0, p1
  Consumer 2 (order-processor): p2
```

Remove consumer 2, and all partitions shift back to consumer 1. The entire transition is handled by the Reader's background goroutines.

## Running producer and consumer together

Combine everything into a single `main.go` that runs the producer in a goroutine, then starts the consumer on the main goroutine:

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
    Email     string    `json:"email"`
    Items     []string  `json:"items"`
    Timestamp time.Time `json:"timestamp"`
}

func main() {
    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    addr := kafka.TCP("localhost:9092")

    // 1. Ensure topic exists
    ensureTopic(ctx, addr, "orders", 3)

    // 2. Start producer in background
    go produceEvents(ctx, addr)

    // 3. Start consumer on main goroutine
    reader := kafka.NewReader(kafka.ReaderConfig{
        Brokers:   []string{"localhost:9092"},
        GroupID:   "order-processor",
        Topic:     "orders",
        MinBytes:  10e3,
        MaxBytes:  10e6,
        MaxWait:   1 * time.Second,
    })
    defer reader.Close()

    slog.Info("consumer started, waiting for events...")
    consume(ctx, reader)
    slog.Info("consumer stopped")
}

func produceEvents(ctx context.Context, addr kafka.Addr) {
    // Give the consumer a moment to start
    time.Sleep(2 * time.Second)

    writer := &kafka.Writer{
        Addr:     addr,
        Topic:    "orders",
        Balancer: &kafka.Hash{},
    }
    defer writer.Close()

    events := []OrderEvent{
        {ID: "ord_001", UserID: "user_1", Amount: 29.99, Email: "user@example.com", Items: []string{"widget-a"}, Timestamp: time.Now()},
        {ID: "ord_002", UserID: "user_1", Amount: 49.50, Email: "user@example.com", Items: []string{"widget-b", "widget-c"}, Timestamp: time.Now()},
        {ID: "ord_003", UserID: "user_2", Amount: 9.99, Email: "user@example.com", Items: []string{"widget-d"}, Timestamp: time.Now()},
        {ID: "ord_004", UserID: "user_3", Amount: 199.00, Email: "user@example.com", Items: []string{"widget-e", "widget-f", "widget-g"}, Timestamp: time.Now()},
        {ID: "ord_005", UserID: "user_2", Amount: 14.99, Email: "user@example.com", Items: []string{"widget-h"}, Timestamp: time.Now()},
    }

    for _, event := range events {
        data, err := json.Marshal(event)
        if err != nil {
            slog.Error("marshal failed", "event_id", event.ID, "error", err)
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
            slog.Error("produce failed", "event_id", event.ID, "error", err)
            continue
        }
        slog.Info("produced event", "event_id", event.ID, "user_id", event.UserID)
    }

    slog.Info("all events produced")
}

func consume(ctx context.Context, r *kafka.Reader) {
    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            if ctx.Err() != nil {
                return
            }
            slog.Error("read error", "error", err)
            continue
        }

        var event OrderEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            slog.Error("decode error, skipping",
                "error", err,
                "partition", msg.Partition,
                "offset", msg.Offset,
            )
            continue
        }

        slog.Info("consumed event",
            "event_id", event.ID,
            "user_id", event.UserID,
            "amount", event.Amount,
            "partition", msg.Partition,
            "offset", msg.Offset,
        )
    }
}

func processEvent(ctx context.Context, event OrderEvent) error {
    // Placeholder — page 05 adds structured logging
    return nil
}

func ensureTopic(ctx context.Context, addr kafka.Addr, topic string, partitions int) {
    conn, err := kafka.DialContext(ctx, "tcp", "localhost:9092")
    if err != nil {
        slog.Error("failed to dial", "error", err)
        os.Exit(1)
    }
    defer conn.Close()

    existingPartitions, err := conn.ReadPartitions()
    if err != nil {
        slog.Error("failed to read partitions", "error", err)
        os.Exit(1)
    }

    for _, p := range existingPartitions {
        if p.Topic == topic {
            slog.Info("topic already exists", "topic", topic)
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
        slog.Error("failed to create topic", "topic", topic, "error", err)
        os.Exit(1)
    }

    slog.Info("created topic", "topic", topic, "partitions", partitions)
}
```

## Running the checkpoint

With Kafka running:

```bash
go run main.go
```

Expected output — the producer fires 5 events after a 2-second delay, and the consumer processes them:

```
INFO topic already exists topic=orders
INFO consumer started, waiting for events...
INFO produced event event_id=ord_001 user_id=user_1
INFO produced event event_id=ord_002 user_id=user_1
INFO consumed event event_id=ord_001 user_id=user_1 amount=29.99 partition=0 offset=0
INFO consumed event event_id=ord_002 user_id=user_1 amount=49.5 partition=0 offset=1
INFO produced event event_id=ord_003 user_id=user_2
INFO consumed event event_id=ord_003 user_id=user_2 amount=9.99 partition=1 offset=0
INFO produced event event_id=ord_004 user_id=user_3
INFO consumed event event_id=ord_004 user_id=user_3 amount=199 partition=2 offset=0
INFO produced event event_id=ord_005 user_id=user_2
INFO consumed event event_id=ord_005 user_id=user_2 amount=14.99 partition=1 offset=1
INFO all events produced
```

Notice that events for the same user land on the same partition (`user_1` on partition 0, `user_2` on partition 1) because the producer uses `kafka.Hash` with the `UserID` as the key.

Press `Ctrl+C` to trigger graceful shutdown — the consumer exits its loop and the program terminates cleanly.

## What you learned

- `kafka.Reader` with a `GroupID` creates a consumer that participates in group-based partition assignment
- `MinBytes`/`MaxBytes`/`MaxWait` control the fetch latency vs. throughput trade-off
- Auto-commit gives at-least-once semantics — duplicates are possible on crashes
- Manual commit with `CommitMessages` narrows the duplicate window but does not eliminate it
- Decode errors should be logged and skipped; processing errors should be retried and then sent to a DLQ
- Rebalancing happens automatically when consumers join or leave the group
- A single `main.go` can run producer and consumer together using goroutines

You now have events flowing from producer to consumer. The logging is functional but uses plain text — grep-able in a pinch but not parseable by log aggregators. The next page replaces every `slog.Info`/`slog.Error` call with structured, JSON-formatted output.

[Next → Structured logging](/expert/05-structured-logging)
