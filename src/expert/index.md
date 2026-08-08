---
title: Expert tier — Event-Driven Go with Observability
tier: expert
platform: golang
---

# Expert tier: Event-Driven Go with Observability

Build a production-grade **Kafka event processor service** in Go, instrumented with OpenTelemetry for structured logging, distributed tracing, and Prometheus metrics.

## What you'll build

A complete event-driven service that produces and consumes Kafka messages, with:

- **Structured logging** via `log/slog` — contextual, leveled, JSON-formatted
- **Distributed tracing** with OpenTelemetry — trace messages across produce/consume boundaries
- **Prometheus metrics** — custom counters, histograms, and Go runtime instrumentation
- **Graceful shutdown** — drain in-flight messages on SIGTERM/SIGINT
- **Docker Compose** — local Kafka + Redpanda Console + Prometheus + Grafana
- **Integration tests** with Testcontainers — real Kafka in CI

## Prerequisites

Completion of the **Advanced tier** (PostgreSQL, JWT auth, Docker, CI/CD) or equivalent Go and Docker experience.

## Ladder

1. [Why event-driven](/expert/01-why-event-driven) — understand the problem domain and architectural motivation
2. [Kafka fundamentals](/expert/02-kafka-fundamentals) — topics, partitions, consumer groups, and Go clients
3. [Producing events](/expert/03-producing-events) — write a typed producer with `segmentio/kafka-go`
4. [Consuming events](/expert/04-consuming-events) — build a resilient consumer with manual offset management
5. [Structured logging](/expert/05-structured-logging) — add `slog` with JSON output and request-scoped attributes
6. [Distributed tracing](/expert/06-distributed-tracing) — instrument produce and consume with OpenTelemetry spans
7. [Metrics](/expert/07-metrics) — expose Prometheus metrics for throughput, latency, and errors
8. [Graceful shutdown](/expert/08-graceful-shutdown) — handle OS signals, flush traces, and close producers cleanly
9. [Docker Compose](/expert/09-docker-compose) — orchestrate Kafka, the processor, and the observability stack
10. [Testing](/expert/10-testing) — integration tests with Testcontainers and isolated consumer groups

## Technologies used

- **Apache Kafka** — distributed event streaming
- **segmentio/kafka-go** — pure Go Kafka client
- **OpenTelemetry Go SDK** — tracing and metrics
- **log/slog** — structured logging (Go 1.21+)
- **Testcontainers for Go** — disposable Kafka in tests
- **Prometheus + Grafana** — metrics collection and dashboards
- **Docker Compose** — local development environment

---

Ready to begin? Start with [Why event-driven →](/expert/01-why-event-driven)
