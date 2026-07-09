---
title: Why event-driven
tier: expert
platform: golang
---

# Why event-driven

Most services start simple: a client sends a request, the server processes it synchronously, and returns a response. This request-response model is intuitive and works well for CRUD operations. But as systems grow, its limitations become painful.

## The request-response ceiling

Consider an e-commerce monolith. When a customer places an order, the service must:

1. Validate the order
2. Reserve inventory
3. Process payment
4. Send a confirmation email
5. Update analytics
6. Trigger a shipping workflow

In a synchronous architecture, the order handler calls each of these directly. The calling service knows the callee's address, blocks until each response arrives, and has no way to recover if a downstream service is slow or down.

```text
HTTP POST /orders
  │
  ├─► Inventory service ────► HTTP 200
  ├─► Payment service  ────► HTTP 200
  ├─► Email service    ────► HTTP 200
  ├─► Analytics        ────► HTTP 200
  └─► Shipping         ────► HTTP 200
  │
  ◄─ HTTP 201 Created
```

Every box is a direct HTTP call. The order handler couples itself to every downstream service — its code imports their client libraries, its latency is the sum of their latencies, and its failure modes are the union of their failures.

## Tight coupling

Request-response binds the caller and callee at runtime *and* at deploy time. The order handler needs:

- The network address of every downstream service
- The API contract (proto file, OpenAPI spec, or client library) of each
- The availability of each — if inventory is down, order placement fails
- The capacity of each — if payment is slow, the whole request queue backs up

This coupling makes it hard to change, scale, or replace any single piece. Adding a new consumer (e.g., a fraud detection system) means modifying the order handler and redeploying it.

## Blocking and tail latency

In synchronous chains, the caller blocks for every response. If the email service takes two seconds, the order handler takes two seconds more. If payment occasionally spikes to five seconds, the order handler occasionally spikes too.

Tail latency — the slowest 1% of requests — multiplies across every hop. In a chain of five services where each has a p99 of 500ms, the p99 end-to-end is not 500ms but far worse, because the slowest call determines the total.

## No replay

Once a synchronous response arrives, the data is gone — consumed by the caller's business logic and typically discarded. If a bug is discovered in the analytics pipeline, you cannot re-run it against last week's orders. If shipping misses an event, you cannot retry it from the point of failure. There is no history; there is only the current state.

## Scaling imbalance

When a flash sale or traffic spike hits, the order handler's request queue grows. Every downstream service must scale proportionally to handle the surge — even services that only do lightweight work. There is no buffer between them. A brief blip in one service propagates connection storms and retry avalanches across the entire graph.

## The event-driven alternative

Event-driven architecture replaces direct calls with a **durable event stream**. The producer publishes an event and moves on. Consumers subscribe independently, process at their own pace, and can be added or removed without touching the producer.

```text
┌──────────┐     ┌──────────────────┐     ┌──────────────┐
│ Producer │────►│   Kafka Topic    │────►│  Consumer    │
│ (Order   │     │  (durable log)   │     │  Group       │
│  Service)│     │                  │     │              │
└──────────┘     └──────────────────┘     ├──────────────┤
                                          │ Payment      │
                                          │ Inventory    │
                                          │ Email        │
                                          │ Analytics    │
                                          │ Shipping     │
                                          │ Fraud detect │
                                          └──────────────┘
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  Observability   │
                                    │  (logs + traces  │
                                    │   + metrics)     │
                                    └──────────────────┘
```

The producer writes a single `OrderPlaced` event to Kafka. Downstream services consume that event independently. If a new consumer needs to join (fraud detection, data lake sync), it starts reading from the topic — no producer changes required.

## Decoupling

The producer does not know who consumes its events. It only knows how to serialize the event and write it to the topic. Consumers do not know the producer's address — they only know the topic name and their consumer group.

This means:

- **Producer and consumers deploy independently.** A new version of shipping does not require redeploying the order service.
- **Consumers can be added or removed at any time.** The producer never changes.
- **The event schema is the contract.** Not a client library, not an API endpoint — just a JSON or protobuf schema. The producer guarantees it, consumers interpret it.

## Asynchronous processing

The producer writes the event and returns immediately. Downstream processing happens in its own time. This eliminates the tail-latency multiplication problem: each consumer processes at its own pace, and slow consumers do not block fast ones.

```go
// Synchronous: caller blocks until shipping responds
if err := shippingService.Ship(order); err != nil {
    return err
}

// Event-driven: publish and return immediately
if err := producer.ProduceOrder(ctx, event); err != nil {
    return err // only fails if Kafka is unreachable
}
// Shipping handles this asynchronously
```

## Replay

Because events are durably stored in a log, you can rewind and reprocess them at any time. This is invaluable for:

- **Bug fixes:** Deploy a fixed consumer and replay events from before the bug was introduced.
- **Backfilling:** A new consumer (e.g., a search indexer) reads the entire event history to build its initial state.
- **Auditing:** Every state-changing action is recorded. You can trace exactly what happened, in order.

In Kafka, replay is as simple as resetting a consumer group's offset to an earlier point — no data migration, no snapshots, no downtime.

## Backpressure

The event stream acts as a shock absorber. When a traffic spike hits, events accumulate in the topic. Consumers process them at their maximum sustainable rate. When the spike passes, the backlog drains naturally.

This is the opposite of request-response, where a spike either drops requests or forces every service to scale simultaneously. With event-driven architecture, only the consumer that cannot keep up needs attention.

## Use cases

### Order processing

When an order is placed, the `OrderPlaced` event fans out to payment, inventory, shipping, email, analytics, and fraud detection. Each consumer handles its own concern. If fraud detection takes 10 seconds to run, it does not delay the email confirmation.

### Audit logging

Every state change — order placed, payment received, shipping label created — is an immutable event in the stream. Auditors can reconstruct the full timeline of any entity by replaying its events. This is far more reliable than querying a `updated_at` column in a database.

### Clickstream analytics

User interactions (page views, clicks, searches) are produced as high-volume events. Consumers aggregate them into real-time dashboards, session reconstructions, and funnel analyses. The event stream handles millions of events per second without backpressure on the web servers.

### CQRS — Command Query Responsibility Segregation

Events become the write model. The read model is built by consuming those events and projecting them into query-optimized views. This lets you scale reads and writes independently, use different storage engines for each, and evolve them on different schedules.

## Kafka's role

Apache Kafka is the most widely adopted event streaming platform. It provides:

- **Durable commit log** — events are written to disk and replicated across brokers. No data loss even if a broker crashes.
- **Partitioned for scale** — topics are split into partitions, each ordered and parallel. Throughput scales with partition count.
- **Replayable from any offset** — consumers choose where to start reading: beginning, end, or a specific timestamp.
- **Built for streaming** — designed from the ground up for high-throughput, low-latency event streaming, not bolted onto a message queue.

Kafka is not the only option — RabbitMQ, NATS, and Redpanda (a Kafka-compatible alternative) exist — but Kafka's ecosystem, durability guarantees, and Go client maturity make it the standard choice for production event-driven systems.

## What this tier builds

Over the next nine pages, you will build a production-grade **Kafka event processor** in Go:

1. Kafka fundamentals (topics, partitions, consumer groups) — next
2. A typed producer writing structured events
3. A resilient consumer with manual offset management
4. Structured logging with `log/slog`
5. Distributed tracing with OpenTelemetry
6. Prometheus metrics for throughput, latency, and errors
7. Graceful shutdown on OS signals
8. Docker Compose orchestrating the full observability stack
9. Integration tests with Testcontainers

Each page ends with a runnable checkpoint. By page 10, you will have a service you can run locally, observe with Grafana dashboards, and test in CI.

[Next → Kafka fundamentals](/expert/02-kafka-fundamentals)
