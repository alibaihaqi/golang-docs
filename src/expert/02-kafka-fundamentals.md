---
title: Kafka fundamentals
tier: expert
platform: golang
---

# Kafka fundamentals

Apache Kafka is a distributed event streaming platform. Before we write any Go code, you need to understand its core data model and how to run it locally.

## Core concepts

### Topic

A topic is a named stream of events — think of it as a table in a database, but append-only. Events are written to a topic and read from it by consumers. Topics are the unit of organization: `orders`, `payments`, `page_views`, `audit_log`.

### Partition

Every topic is split into partitions. A partition is an ordered, immutable sequence of events. Each event within a partition has a monotonically increasing offset — its position in the partition.

```text
Topic: "orders"
├── Partition 0: [ev0, ev1, ev2, ev3, ...]  offset 0→N
├── Partition 1: [ev0, ev1, ev2, ...]       offset 0→M
└── Partition 2: [ev0, ev1, ev2, ev3, ...]  offset 0→P
```

Partitions are the unit of parallelism. Kafka guarantees order *within* a partition, but not across partitions. If you need order for a specific entity (e.g., all events for `user_42`), you use a consistent partition key — more on that in the producing page.

### Producer

A producer writes events to topic partitions. It can specify a partition directly, or let Kafka choose based on a key. Producers batch events for efficiency and can configure durability vs. throughput trade-offs (acknowledge when the leader has written, when all replicas have written, or fire-and-forget).

### Consumer

A consumer reads events from topic partitions. Each consumer tracks its position — the offset of the last event it read. This offset is committed to Kafka so the consumer can resume from where it left off after a restart.

### Consumer group

A consumer group is a set of consumers that divide a topic's partitions among themselves. Each partition is assigned to exactly one consumer in the group. This is how you scale consumption: if a topic has 6 partitions, a group of 3 consumers gets 2 partitions each.

```text
Topic "orders" (6 partitions)
         │
    Consumer Group "order-processor"
         │
  ┌──────┼──────┐
  │      │      │
  c1     c2     c3
  p0,p1  p2,p3  p4,p5
```

If a consumer crashes, its partitions are rebalanced to the remaining consumers. If a new consumer joins, partitions are reassigned. This rebalancing is automatic but not free — it briefly pauses consumption for the group.

## Running Kafka locally

Modern Kafka runs without ZooKeeper using **KRaft** — Kafka's built-in consensus protocol. This simplifies local development significantly.

### docker-compose.yml

Create a `docker-compose.yml` for a single-node KRaft broker:

```yaml
version: '3.8'
services:
  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

Start Kafka:

```bash
docker compose up -d
```

Verify it is running:

```bash
docker compose logs kafka | grep -i "started"
```

## Project structure

Create the project directory and initialize a Go module:

```bash
mkdir event-processor && cd event-processor
go mod init event-processor
```

You should see:

```
event-processor/
├── go.mod         # module event-processor
└── main.go        # we'll build this next
```

## Installing kafka-go

The `segmentio/kafka-go` library is the most popular pure-Go Kafka client. Install it:

```bash
go get github.com/segmentio/kafka-go
```

This adds the dependency to `go.mod` and creates `go.sum`. No CGo, no librdkafka — it compiles in seconds and cross-compiles to any target without hassle.

## Creating a topic programmatically

Kafka auto-creates topics when a producer writes to them, but in production you typically create topics explicitly with the right partition count and replication factor.

With `kafka-go`, use the `AdminClient`:

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"
    "os/signal"
    "syscall"

    "github.com/segmentio/kafka-go"
)

func main() {
    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    addr := kafka.TCP("localhost:9092")

    conn, err := kafka.DialContext(ctx, "tcp", "localhost:9092")
    if err != nil {
        log.Fatalf("failed to dial: %v", err)
    }
    defer conn.Close()

    // Fetch existing topics
    partitions, err := conn.ReadPartitions()
    if err != nil {
        log.Fatalf("failed to read partitions: %v", err)
    }

    topicExists := false
    for _, p := range partitions {
        if p.Topic == "orders" {
            topicExists = true
            break
        }
    }

    if topicExists {
        fmt.Println("Topic 'orders' already exists")
        return
    }

    // Create the topic with 3 partitions, replication factor 1
    admin := kafka.NewAdmin(addr)
    defer admin.Close()

    err = admin.CreateTopics(ctx, kafka.TopicConfig{
        Topic:             "orders",
        NumPartitions:     3,
        ReplicationFactor: 1,
    })
    if err != nil {
        log.Fatalf("failed to create topic: %v", err)
    }

    fmt.Println("Created topic 'orders' with 3 partitions")

    // Verify the topic was created
    partitions, err = conn.ReadPartitions()
    if err != nil {
        log.Fatalf("failed to read partitions: %v", err)
    }

    for _, p := range partitions {
        if p.Topic == "orders" {
            fmt.Printf("  Partition %d: leader=%d\n", p.ID, p.Leader)
        }
    }
}
```

### Running the checkpoint

With Kafka running, execute the program:

```bash
go run main.go
```

Expected output:

```
Created topic 'orders' with 3 partitions
  Partition 0: leader=1
  Partition 1: leader=1
  Partition 2: leader=1
```

Run it a second time — it should detect the topic already exists and exit cleanly:

```
Topic 'orders' already exists
```

## Understanding the admin code

The program follows a create-if-not-exists pattern:

1. **Dial** a raw connection to verify Kafka is reachable
2. **Read partitions** across all topics to check if `orders` exists
3. **Skip creation** if the topic already exists — this makes the script idempotent
4. **Create the topic** with 3 partitions and replication factor 1 (single-broker cluster)
5. **Verify** by listing partitions and printing the leader for each

This pattern is common in development and test tooling. In production, you would manage topic creation through infrastructure-as-code (Terraform, Helm, or a dedicated migration step in CI), not from application code.

## Why 3 partitions?

Three partitions is a reasonable default for development:

- It allows up to 3 consumers in a group (one per partition)
- It spreads write load across partitions
- It is small enough to reason about locally

Production partition count depends on your throughput requirements, key cardinality, and consumer parallelism. A common rule: start with `max(3, expected_consumer_count * 2)` and monitor partition imbalance.

## What you learned

- Topics are named event streams; partitions provide ordering and parallelism
- Producers write events; consumers read them; consumer groups distribute partitions
- KRaft mode runs Kafka without ZooKeeper — single Docker container for dev
- `segmentio/kafka-go` is a pure-Go Kafka client with no C dependencies
- `AdminClient.CreateTopics` creates topics with explicit configuration
- The create-if-not-exists pattern keeps local dev scripts idempotent

Your local Kafka is running, the Go module is initialized, and the `orders` topic exists with 3 partitions. In the next page, you will write a producer that sends structured events to this topic.

[Next → Producing events](/expert/03-producing-events)
