---
title: Producing events
tier: expert
platform: golang
---

# Producing events

With Kafka running and the `orders` topic created, it is time to write a producer that sends structured events to the topic.

## Why typed events

Raw bytes are flexible but error-prone. A typed event struct gives you:

- **Compile-time safety** — mismatched field names and types are caught before runtime
- **Serialization discipline** — every event producer serializes the same way
- **Documentation** — the struct is the schema; anyone can read it and know the event shape

In production systems, you would evolve this into a shared protobuf or Avro schema (managed by a schema registry), but for this tier a JSON-serialized Go struct is the right starting point.

## The OrderEvent struct

Define the event that represents an order being placed:

```go
type OrderEvent struct {
    ID        string    `json:"id"`
    UserID    string    `json:"user_id"`
    Amount    float64   `json:"amount"`
    Items     []string  `json:"items"`
    Timestamp time.Time `json:"timestamp"`
}
```

Every field carries a JSON struct tag so `encoding/json` produces the expected field names. The `Timestamp` field uses Go's native `time.Time`, which serializes to RFC 3339 format by default.

## kafka-go writer setup

The `kafka.Writer` is the high-level producer API. It handles batching, retries, and connection pooling automatically:

```go
writer := &kafka.Writer{
    Addr:     kafka.TCP("localhost:9092"),
    Topic:    "orders",
    Balancer: &kafka.Hash{},
}
defer writer.Close()
```

### Balancer

The `Balancer` determines which partition each message is written to. `kafka.Hash` hashes the message key to select a partition. This guarantees that all messages with the same key (e.g., `UserID`) land on the same partition, preserving order per user.

If you do not set a key, `kafka.Hash` round-robins across partitions.

### Writer defaults

The writer has sensible defaults that work for local development:

| Setting | Default | Note |
|---------|---------|------|
| `BatchTimeout` | 1 second | Max time to wait before flushing a batch |
| `BatchSize` | 100 messages | Max messages per batch |
| `BatchBytes` | 1 MB | Max batch byte size |
| `RequiredAcks` | `RequireAll` (-1) | Wait for all in-sync replicas to acknowledge |
| `Async` | `false` | `WriteMessages` blocks until acknowledged |

## Producing with key

The key in a Kafka message determines partition assignment. By using `UserID` as the key, all events for a given user land on the same partition, which means they are consumed in order:

```go
func produceOrder(ctx context.Context, w *kafka.Writer, event OrderEvent) error {
    data, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("marshal event: %w", err)
    }

    msg := kafka.Message{
        Key:   []byte(event.UserID),
        Value: data,
        Headers: []kafka.Header{
            {Key: "event_type", Value: []byte("order.created")},
        },
    }

    return w.WriteMessages(ctx, msg)
}
```

### Headers

Kafka headers are key-value metadata pairs attached to each message. They are not indexed and do not affect partitioning, but consumers can read them without deserializing the value. Common uses:

- Message type discriminator (`event_type: order.created`)
- Content type (`content_type: application/json`)
- Trace ID for distributed tracing (`trace_id: abc123`)
- Schema version (`schema_version: 1`)

## Idempotent producer

The `kafka-go` writer is idempotent by default when `BatchTimeout > 0`. Idempotent producers prevent duplicate messages during retries by tagging each batch with a producer ID and sequence number. Kafka detects duplicate sequences and silently drops them.

This means you can safely retry `WriteMessages` on transient errors without risking duplicates in the topic — one less invariant to reason about.

## Error handling

Not all errors are retryable. A robust producer distinguishes between transient errors (retry with backoff) and permanent errors (log and skip):

```go
func produceOrderWithRetry(ctx context.Context, w *kafka.Writer, event OrderEvent) error {
    const maxRetries = 3
    var lastErr error

    for i := range maxRetries {
        err := produceOrder(ctx, w, event)
        if err == nil {
            return nil
        }

        // Permanent: log and skip
        if errors.Is(err, kafka.MessageTooLargeError) ||
            errors.Is(err, kafka.UnsupportedCompressionCodec) ||
            errors.Is(err, kafka.UnknownTopicOrPartition) {
            slog.Error("permanent error producing event, skipping",
                "event_id", event.ID,
                "error", err,
            )
            return err
        }

        // Transient: retry with backoff
        lastErr = err
        slog.Warn("transient error producing event, retrying",
            "event_id", event.ID,
            "attempt", i+1,
            "error", err,
        )

        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(time.Duration(100*(i+1)) * time.Millisecond):
        }
    }

    return fmt.Errorf("produce after %d retries: %w", maxRetries, lastErr)
}
```

This pattern:

- Classifies errors by type — `MessageTooLargeError` will never succeed on retry
- Uses exponential backoff: 100ms, 200ms, 300ms
- Respects context cancellation so the retry loop stops on shutdown
- Logs each attempt with structured fields for observability

## Complete main.go

Combine the topic creation from page 02, the event struct, the writer setup, and produce 5 sample events:

```go
package main

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "log/slog"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/segmentio/kafka-go"
)

func main() {
    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    // 1. Ensure topic exists
    addr := kafka.TCP("localhost:9092")
    ensureTopic(ctx, addr, "orders", 3)

    // 2. Create writer
    writer := &kafka.Writer{
        Addr:     addr,
        Topic:    "orders",
        Balancer: &kafka.Hash{},
    }
    defer writer.Close()

    // 3. Produce sample events
    events := []OrderEvent{
        {ID: "ord_001", UserID: "user_1", Amount: 29.99, Items: []string{"widget-a"}, Timestamp: time.Now()},
        {ID: "ord_002", UserID: "user_1", Amount: 49.50, Items: []string{"widget-b", "widget-c"}, Timestamp: time.Now()},
        {ID: "ord_003", UserID: "user_2", Amount: 9.99, Items: []string{"widget-d"}, Timestamp: time.Now()},
        {ID: "ord_004", UserID: "user_3", Amount: 199.00, Items: []string{"widget-e", "widget-f", "widget-g"}, Timestamp: time.Now()},
        {ID: "ord_005", UserID: "user_2", Amount: 14.99, Items: []string{"widget-h"}, Timestamp: time.Now()},
    }

    for _, event := range events {
        if err := produceOrder(ctx, writer, event); err != nil {
            slog.Error("failed to produce", "event_id", event.ID, "error", err)
            os.Exit(1)
        }
        slog.Info("produced event", "event_id", event.ID, "user_id", event.UserID)
    }

    slog.Info("all events produced successfully")
}

type OrderEvent struct {
    ID        string    `json:"id"`
    UserID    string    `json:"user_id"`
    Amount    float64   `json:"amount"`
    Items     []string  `json:"items"`
    Timestamp time.Time `json:"timestamp"`
}

func produceOrder(ctx context.Context, w *kafka.Writer, event OrderEvent) error {
    data, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("marshal event: %w", err)
    }

    msg := kafka.Message{
        Key:   []byte(event.UserID),
        Value: data,
        Headers: []kafka.Header{
            {Key: "event_type", Value: []byte("order.created")},
        },
    }

    return w.WriteMessages(ctx, msg)
}

func produceOrderWithRetry(ctx context.Context, w *kafka.Writer, event OrderEvent) error {
    const maxRetries = 3
    var lastErr error

    for i := range maxRetries {
        err := produceOrder(ctx, w, event)
        if err == nil {
            return nil
        }

        if errors.Is(err, kafka.MessageTooLargeError) ||
            errors.Is(err, kafka.UnsupportedCompressionCodec) ||
            errors.Is(err, kafka.UnknownTopicOrPartition) {
            slog.Error("permanent error producing event, skipping",
                "event_id", event.ID,
                "error", err,
            )
            return err
        }

        lastErr = err
        slog.Warn("transient error producing event, retrying",
            "event_id", event.ID,
            "attempt", i+1,
            "error", err,
        )

        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(time.Duration(100*(i+1)) * time.Millisecond):
        }
    }

    return fmt.Errorf("produce after %d retries: %w", maxRetries, lastErr)
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

With Kafka still running from page 02:

```bash
go run main.go
```

Expected output (timestamps and log levels formatted by slog):

```
INFO created topic topic=orders partitions=3
INFO produced event event_id=ord_001 user_id=user_1
INFO produced event event_id=ord_002 user_id=user_1
INFO produced event event_id=ord_003 user_id=user_2
INFO produced event event_id=ord_004 user_id=user_3
INFO produced event event_id=ord_005 user_id=user_2
INFO all events produced successfully
```

## Verifying the events

You can read the events back using `kcat` (formerly `kafkacat`):

```bash
# Install kcat: brew install kcat
kcat -C -b localhost:9092 -t orders -o beginning -e
```

Or use Redpanda Console (add to docker-compose.yml and visit `http://localhost:8080`). The output shows 5 messages, each with the JSON-serialized `OrderEvent` as the value and `user_id` as the key.

### What happened on the Kafka side

Each call to `WriteMessages`:

1. Serializes the event to JSON
2. Creates a `kafka.Message` with the `UserID` as the key
3. Passes the message to the writer's internal buffer
4. The writer hashes the key to select a partition
5. When the batch is full or `BatchTimeout` expires, the writer sends the batch to the partition leader
6. The leader appends the messages to its log and responds with the offset of each

Because `user_1` has two events and `user_2` has two, the hash balancer places them on the same partitions as their peers, preserving order per user.

## What you learned

- A typed event struct with JSON tags provides compile-time safety and serialization discipline
- The `kafka.Writer` with `Hash` balancer routes messages by key to ensure ordering per key
- Kafka headers carry metadata independent of the message value
- Idempotent producers prevent duplicates during retry (enabled by default)
- Error handling distinguishes transient errors (retry with backoff) from permanent errors (log and skip)
- A complete producer script creates the topic, writes 5 events, and exits cleanly

You have a working producer that writes structured, keyed events to Kafka. The next page builds the consumer that reads and processes them.

[Next → Consuming events](/expert/04-consuming-events)
