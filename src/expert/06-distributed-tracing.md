---
title: Distributed tracing
tier: expert
platform: golang
---

# Distributed tracing

The structured logging from the previous page gives you JSON-formatted, queryable log entries. But logs are per-service — correlating a produce event with its corresponding consume event across a Kafka topic requires matching by event ID across separate streams. Distributed tracing solves this by propagating a trace context across service boundaries.

## What is distributed tracing

A **trace** is a tree of **spans** that represents an end-to-end unit of work as it flows through a distributed system. Each span captures:

- **Duration** — how long the operation took
- **Attributes** — key-value metadata (event ID, user ID, amount)
- **Parent relationship** — which span caused this span to start

For our event processor, the trace looks like:

```
produce_order (producer)
  └── process_order (consumer)
        └── handle_event (processEvent)
```

The produce span is the root. It propagates to the consumer via Kafka message headers. The consumer starts a child span linked to the root, and the processing function creates a nested span.

Without tracing, a slow event looks like a produce-side latency spike (producer logs show fast writes) or a consumer-side error (consumer logs show every decode). With tracing, you see exactly where the time was spent — network, decode, processing, or a downstream call.

## OpenTelemetry Go SDK

OpenTelemetry (OTel) is the vendor-neutral observability framework. The Go SDK provides a `TracerProvider` that creates `Tracer` instances, which in turn create `Span` instances.

### Dependencies

Add the OTel Go modules to your `go.mod`:

```
go get go.opentelemetry.io/otel \
  go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc \
  go.opentelemetry.io/otel/sdk/resource \
  go.opentelemetry.io/otel/sdk/trace \
  go.opentelemetry.io/otel/semconv/v1.24.0 \
  go.opentelemetry.io/otel/attribute
```

### initTracer function

The `initTracer` function creates an OTLP gRPC exporter that sends spans to an OpenTelemetry Collector, configures a batch span processor, and registers the tracer provider as the global instance:

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/sdk/resource"
    "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

func initTracer() (*trace.TracerProvider, error) {
    ctx := context.Background()

    exporter, err := otlptracegrpc.New(ctx,
        otlptracegrpc.WithEndpoint("localhost:4317"),
        otlptracegrpc.WithInsecure(),
    )
    if err != nil {
        return nil, err
    }

    res, err := resource.New(ctx,
        resource.WithAttributes(
            semconv.ServiceNameKey.String("event-processor"),
        ),
    )
    if err != nil {
        return nil, err
    }

    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
        trace.WithResource(res),
    )
    otel.SetTracerProvider(tp)
    return tp, nil
}
```

Key points:

- `otlptracegrpc.WithEndpoint("localhost:4317")` — sends to the OTel Collector running locally
- `otlptracegrpc.WithInsecure()` — no TLS for local development
- `trace.WithBatcher(exporter)` — batches spans before export for efficiency
- `resource.NewWithAttributes` — attaches service identity metadata to every span
- `otel.SetTracerProvider(tp)` — makes this the global provider so any package can call `otel.Tracer()`

### Shutdown

At program exit, flush and shut down the tracer provider so no spans are lost:

```go
func shutdownTracer(ctx context.Context, tp *trace.TracerProvider) {
    _ = tp.Shutdown(ctx)
}
```

## Creating spans

With the global tracer provider configured, create a tracer and start spans:

```go
tracer := otel.Tracer("event-processor")

ctx, span := tracer.Start(ctx, "produce_order")
defer span.End()

span.SetAttributes(
    attribute.String("event.id", event.ID),
    attribute.String("event.user_id", event.UserID),
    attribute.Float64("event.amount", event.Amount),
)
```

### Span lifecycle

| Step | Code | Purpose |
|------|------|---------|
| Start | `tracer.Start(ctx, "name")` | Creates a span; returns a new context carrying the span |
| Set attributes | `span.SetAttributes(...)` | Annotate the span with metadata |
| End | `defer span.End()` | Records the duration and sends the span to the exporter |

The `context.Context` returned by `tracer.Start` carries the span internally. You pass this context to downstream operations so they can create child spans.

### Child spans

When you call `tracer.Start(ctx, "name")` with a context that already contains a span, the new span becomes a child of the existing one:

```go
func handleEvent(ctx context.Context, event OrderEvent) {
    // ctx already carries the parent span from the consumer
    _, span := tracer.Start(ctx, "handle_event")
    defer span.End()

    // processing logic...
}
```

The span tree automatically reflects the nesting:

```
produce_order (root, duration 5ms)
  └── process_order (child, duration 4ms)
        └── handle_event (child, duration 2ms)
```

## Context propagation across Kafka

The challenge with async messaging: the producer and consumer run in different processes, possibly on different machines. The trace context must be serialized, sent with the message, and deserialized on the consumer side.

OTel provides the `propagation.TraceContext` propagator that follows the W3C Trace Context specification. It reads and writes the `traceparent` header.

### Producer side — inject

Before producing a Kafka message, inject the current trace context into the message headers:

```go
import "go.opentelemetry.io/otel/propagation"

propagator := propagation.TraceContext{}

func produceTraced(ctx context.Context, writer *kafka.Writer, event OrderEvent) error {
    tracer := otel.Tracer("event-processor")
    ctx, span := tracer.Start(ctx, "produce_order")
    defer span.End()

    span.SetAttributes(
        attribute.String("event.id", event.ID),
        attribute.String("event.user_id", event.UserID),
        attribute.Float64("event.amount", event.Amount),
        attribute.String("event_type", "order.created"),
    )

    data, _ := json.Marshal(event)

    msg := kafka.Message{
        Key:   []byte(event.UserID),
        Value: data,
        Headers: []kafka.Header{
            {Key: "event_type", Value: []byte("order.created")},
        },
    }

    // Inject trace context into message headers
    carrier := propagation.MapCarrier{}
    propagator.Inject(ctx, carrier)
    for k, v := range carrier {
        msg.Headers = append(msg.Headers, kafka.Header{Key: k, Value: []byte(v)})
    }

    return writer.WriteMessages(ctx, msg)
}
```

The `propagation.MapCarrier` is a `map[string]string` wrapper. The propagator writes the `traceparent` (and optionally `tracestate`) headers into it, and we copy those into the Kafka message headers.

### Consumer side — extract

On the consumer side, extract the trace context from the message headers before starting the consumer span:

```go
func consumeTraced(ctx context.Context, r *kafka.Reader) {
    propagator := propagation.TraceContext{}
    tracer := otel.Tracer("event-processor")

    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            if ctx.Err() != nil {
                return
            }
            slog.Error("read failed", "error", err)
            continue
        }

        // Build carrier from Kafka message headers
        carrier := propagation.MapCarrier{}
        for _, h := range msg.Headers {
            carrier[h.Key] = string(h.Value)
        }

        // Extract trace context — links this consumer span to the producer span
        ctx = propagator.Extract(ctx, carrier)

        // Start a child span linked to the producer's trace
        ctx, span := tracer.Start(ctx, "process_order")
        span.SetAttributes(
            attribute.String("event.id", event.ID),
            attribute.String("event.user_id", event.UserID),
            attribute.Float64("event.amount", event.Amount),
            attribute.Int("partition", msg.Partition),
            attribute.Int64("offset", msg.Offset),
        )

        handleEvent(ctx, event)

        span.End()
    }
}
```

### Full trace flow

With injection and extraction wired up, a single trace spans both processes:

```
Producer                           Consumer
───────                            ────────
produce_order span
  │
  ├── marshal event to JSON
  ├── inject traceparent into msg.Headers
  ├── kafka.WriteMessages
  │                                     ┌── msg arrives on partition
  │                                     │
  │                                     process_order span (linked via traceparent)
  │                                       │
  │                                       ├── extract traceparent from headers
  │                                       ├── json.Unmarshal
  │                                       └── handle_event span
  │                                             │
  │                                             └── business logic
  │
  └── span.End()
```

In Jaeger or any OTel-compatible backend, these two spans appear under the same trace ID. You can click into the trace and see the full end-to-end timeline, including the gap between produce and consume (the Kafka storage latency).

## Updated docker-compose.yml

The OTel Collector acts as the ingestion gateway. It receives spans via OTLP gRPC, processes them, and forwards to Jaeger for storage and UI.

```yaml
version: "3.8"
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.6
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.6
    ports:
      - "9092:9092"
    depends_on: [zookeeper]
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports:
      - "4317:4317"   # OTLP gRPC
      - "8888:8888"   # Prometheus metrics (self)
    depends_on: [jaeger]
    volumes:
      - ./otel-collector-config.yml:/etc/otel-collector-config.yml
    command: ["--config=/etc/otel-collector-config.yml"]

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686" # UI
      - "14250:14250" # Jaeger gRPC
```

### OTel Collector config

Create `otel-collector-config.yml` alongside your docker-compose:

```yaml
receivers:
  otlp:
    protocols:
      grpc:

processors:
  batch:

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger]
```

The pipeline: OTLP gRPC (from your Go app) → batch processor → Jaeger exporter.

## Running the checkpoint

With Docker Compose running (Kafka + OTel Collector + Jaeger):

```bash
# Start the observability stack
docker compose up -d kafka otel-collector jaeger

# Run the instrumented event processor
go run main.go

# View traces
open http://localhost:16686
```

In the Jaeger UI:

1. Select **event-processor** from the Service dropdown
2. Click **Find Traces**
3. You should see traces in the results list
4. Click a trace to see the span tree — `produce_order` → `process_order` → `handle_event`

Each span shows:
- **Start time** and **duration** — exact timing of each operation
- **Tags** — the attributes you set (event ID, user ID, amount, partition)
- **Process** — service name and instance metadata

The trace view immediately reveals anomalies: a long `produce_order` span suggests a broker issue; a long `handle_event` span points to slow processing logic.

## Span attributes best practices

| Attribute | Example | Why it matters |
|-----------|---------|----------------|
| `event.id` | `ord_001` | Correlate with logs — `slog.With("event_id", id)` in the log entry matches the span tag |
| `event.user_id` | `user_1` | Filter all traces for a specific user |
| `event.amount` | `29.99` | Identify high-value transactions in traces |
| `partition` | `0` | Debug partition skew — one partition slower than others |
| `offset` | `42` | Pinpoint exact message position in the topic |

## What you learned

- Distributed tracing models a request as a tree of spans, each with a duration and attributes
- OpenTelemetry provides a Go SDK with OTLP gRPC export, batch processing, and resource metadata
- `tracer.Start(ctx, name)` creates a span; the returned context carries it for child span creation
- `propagation.TraceContext` injects the trace context into Kafka message headers using the W3C `traceparent` format
- On the consumer side, `propagator.Extract` restores the trace context so new spans link to the producer
- Jaeger visualizes traces so you can see the full end-to-end flow across process boundaries
- The OTel Collector acts as a gateway, receiving OTLP and forwarding to Jaeger

Your event processor now emits distributed traces that connect produce and consume operations under a single trace ID. The next page adds Prometheus metrics for throughput, latency, and error rates.

[Next → Metrics](/expert/07-metrics)
