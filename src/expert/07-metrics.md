---
title: Metrics
tier: expert
platform: golang
---

# Metrics

Distributed tracing gives you end-to-end visibility into individual operations. But traces are sampled — you cannot trace every event in a high-throughput system without significant cost. Metrics fill the gap: aggregated counts, distributions, and current values that show you the health of the system at a glance.

## OTel metric types

OpenTelemetry defines four metric instruments, each suited to a different pattern:

| Instrument | Behavior | Use case |
|-----------|----------|----------|
| **Counter** | Cumulative, monotonically increasing | Events produced, events consumed, errors |
| **UpDown Counter** | Can increase or decrease | Active connections, queue depth, in-flight requests |
| **Histogram** | Distribution of values | Processing latency, message size, batch duration |
| **Gauge** | Current value at a point in time | Memory usage, CPU load, goroutine count |

### Counter

A counter sums values over time. The total only ever goes up (or resets to zero on restart). Use it for throughput metrics:

```
events_produced_total{event_type="order.created"} 42
```

Query: `rate(events_produced_total[1m])` gives you events per second.

### UpDown counter

Like a counter but supports decrement. Use it for pool sizes and queue lengths where value goes both up and down.

### Histogram

A histogram records measurements into configurable buckets and tracks count, sum, and min/max. Use it for latency:

```
event_processing_duration_ms count=42 sum=1560
```

Query: `histogram_quantile(0.99, rate(event_processing_duration_ms_bucket[1m]))` gives you the 99th percentile latency.

### Gauge

A gauge snapshots a value. Use it for instantaneous measurements that do not accumulate over time.

## Meter setup

Metrics are created through a **meter**, which is analogous to a tracer but for metrics. The `initMeter` function configures an OTLP gRPC exporter and a periodic reader that pushes metrics to the OTel Collector:

### Dependencies

```
go get go.opentelemetry.io/otel/metric \
  go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc \
  go.opentelemetry.io/otel/sdk/metric \
  go.opentelemetry.io/otel/sdk/resource
```

### initMeter function

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
    "go.opentelemetry.io/otel/sdk/metric"
    "go.opentelemetry.io/otel/sdk/resource"
    semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

func initMeter() (*metric.MeterProvider, error) {
    ctx := context.Background()

    exporter, err := otlpmetricgrpc.New(ctx,
        otlpmetricgrpc.WithEndpoint("localhost:4317"),
        otlpmetricgrpc.WithInsecure(),
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

    mp := metric.NewMeterProvider(
        metric.WithReader(metric.NewPeriodicReader(exporter)),
        metric.WithResource(res),
    )
    otel.SetMeterProvider(mp)
    return mp, nil
}
```

The periodic reader pushes metrics to the OTLP exporter at a configurable interval (default 60 seconds). For development, you can shorten this:

```go
metric.WithReader(metric.NewPeriodicReader(exporter,
    metric.WithInterval(10*time.Second),
))
```

### Shutdown

At program exit, flush remaining metric data:

```go
func shutdownMeter(ctx context.Context, mp *metric.MeterProvider) {
    _ = mp.Shutdown(ctx)
}
```

## Counters for event throughput

With the meter provider configured, create counters that track how many events are produced, consumed, and how many errors occur:

```go
meter := otel.Meter("event-processor")

eventsProduced, _ := meter.Int64Counter("events.produced",
    metric.WithDescription("Total events produced"),
)
eventsConsumed, _ := meter.Int64Counter("events.consumed",
    metric.WithDescription("Total events consumed"),
)
errorsTotal, _ := meter.Int64Counter("events.errors",
    metric.WithDescription("Total processing errors"),
)
```

### Recording counter values

In the producer, increment the produced counter after a successful write:

```go
func produceEvents(ctx context.Context, writer *kafka.Writer, events []OrderEvent) {
    meter := otel.Meter("event-processor")
    eventsProduced, _ := meter.Int64Counter("events.produced")

    for _, event := range events {
        data, _ := json.Marshal(event)
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

        eventsProduced.Add(ctx, 1,
            metric.WithAttributes(
                attribute.String("event_type", "order.created"),
            ),
        )
    }
}
```

In the consumer, increment consumed and error counters:

```go
func consumeEvents(ctx context.Context, r *kafka.Reader) {
    meter := otel.Meter("event-processor")
    eventsConsumed, _ := meter.Int64Counter("events.consumed")
    errorsTotal, _ := meter.Int64Counter("events.errors")

    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            if ctx.Err() != nil {
                return
            }
            errorsTotal.Add(ctx, 1,
                metric.WithAttributes(
                    attribute.String("error_type", "read_failed"),
                ),
            )
            continue
        }

        var event OrderEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            errorsTotal.Add(ctx, 1,
                metric.WithAttributes(
                    attribute.String("error_type", "decode_error"),
                    attribute.Int("partition", msg.Partition),
                    attribute.Int64("offset", msg.Offset),
                ),
            )
            continue
        }

        eventsConsumed.Add(ctx, 1,
            metric.WithAttributes(
                attribute.String("event_type", "order.created"),
                attribute.String("event.id", event.ID),
            ),
        )
    }
}
```

### Attributes on counter increments

Each `Add` call can carry attributes that create separate time series. The `event_type` attribute lets you query:

```
# All produce events
rate(events.produced_total[1m])

# Filtered by type
rate(events.produced_total{event_type="order.created"}[1m])

# Error breakdown
rate(events.errors_total{error_type="decode_error"}[1m])
```

Keep attribute cardinality bounded — never put a unique value like the full event ID into a metric attribute unless you are certain the number of distinct values is small. The event ID example above is shown for illustration; in production, use it sparingly and prefer logging for per-event details.

## Histogram for processing latency

A histogram records the distribution of processing durations. This is the most important metric for understanding whether your system is fast, slow, or degrading:

```go
processingDuration, _ := meter.Float64Histogram("event.processing.duration",
    metric.WithDescription("Event processing duration"),
    metric.WithUnit("ms"),
)
```

Record the duration around the processing logic:

```go
func handleEvent(ctx context.Context, event OrderEvent) error {
    meter := otel.Meter("event-processor")
    processingDuration, _ := meter.Float64Histogram("event.processing.duration")

    start := time.Now()
    defer func() {
        processingDuration.Record(ctx,
            float64(time.Since(start).Milliseconds()),
            metric.WithAttributes(
                attribute.String("event_type", "order.created"),
                attribute.String("event.id", event.ID),
            ),
        )
    }()

    // Simulate processing work
    time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)

    return nil
}
```

### Prometheus queries with histograms

The histogram exports `_bucket`, `_count`, `_sum`, and `_total` time series. In PromQL:

```
# Average processing duration (last 5 minutes)
rate(event.processing.duration_sum[5m]) / rate(event.processing.duration_count[5m])

# 99th percentile
histogram_quantile(0.99, rate(event.processing.duration_bucket[5m]))

# Processing rate
rate(event.processing.duration_count[5m])
```

A rising p99 or p999 is the earliest signal that something is wrong — often before error counters even move.

## Prometheus scrape endpoint

If you use a Prometheus-compatible reader instead of (or alongside) the OTLP push model, add the Prometheus exporter:

```go
import "go.opentelemetry.io/otel/exporters/prometheus"

func initPrometheusReader() (*metric.MeterProvider, error) {
    exporter, err := prometheus.New()
    if err != nil {
        return nil, err
    }

    mp := metric.NewMeterProvider(
        metric.WithReader(exporter),
    )
    otel.SetMeterProvider(mp)
    return mp, nil
}
```

The Prometheus reader exposes a `/metrics` endpoint that you serve alongside your application's HTTP server. This is the pull model — Prometheus scrapes your service periodically instead of your service pushing metrics to a collector.

## Updated docker-compose.yml

Add Prometheus to scrape the OTel Collector's metrics endpoint:

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
    image: otel/opentelemetry-collectible-contrib:latest
    ports:
      - "4317:4317"
      - "8888:8888"
    depends_on: [jaeger]
    volumes:
      - ./otel-collector-config.yml:/etc/otel-collector-config.yml
    command: ["--config=/etc/otel-collector-config.yml"]

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "14250:14250"

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    depends_on: [otel-collector]
```

### Prometheus config

Create `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "otel-collector"
    scrape_interval: 10s
    static_configs:
      - targets: ["otel-collector:8888"]
```

The OTel Collector exposes its own metrics on port 8888, including the metrics it has ingested from your application. Prometheus scrapes this endpoint every 10 seconds.

## Running the checkpoint

With the full stack running:

```bash
# Start everything
docker compose up -d

# Run the instrumented event processor
go run main.go

# Open Prometheus
open http://localhost:9090
```

In the Prometheus UI:

1. Go to **Graph**
2. Query `rate(events.produced_total[1m])` — you should see a spike when your producer runs
3. Query `rate(event.processing.duration_count[1m])` — the consumer processing rate
4. Query `histogram_quantile(0.99, rate(event.processing.duration_bucket[1m]))` — the 99th percentile latency

### Key dashboards

Build these PromQL queries into a Grafana dashboard (covered in page 09):

| Panel | Query | Purpose |
|-------|-------|---------|
| Produce rate | `rate(events.produced_total[1m])` | Incoming event throughput |
| Consume rate | `rate(events.consumed_total[1m])` | Outgoing event throughput |
| Error rate | `rate(events.errors_total[1m])` | Failure rate by error type |
| Latency p99 | `histogram_quantile(0.99, rate(event.processing.duration_bucket[1m]))` | Tail latency |
| Latency avg | `rate(event.processing.duration_sum[1m]) / rate(event.processing.duration_count[1m])` | Average latency |

## Metric naming conventions

OTel and Prometheus share naming conventions. Follow these for consistency:

- Use dots as separators: `events.produced`, `event.processing.duration`
- Suffix counters with a unit when the unit is ambiguous: `events.produced.total`
- Suffix histograms with the unit: `event.processing.duration_ms`
- Use lowercase and underscores for attribute keys
- Include the error type in error counter attributes, not in the metric name — `events.errors{error_type="decode"}` not `events.decode.errors`

## What you learned

- OpenTelemetry provides four metric instruments: Counter, UpDown Counter, Histogram, and Gauge
- `initMeter()` configures an OTLP gRPC exporter with a periodic reader that pushes metrics to the OTel Collector
- Counters track cumulative totals for produced events, consumed events, and errors
- Histograms record processing latency distributions, enabling p99/p999 queries
- Prometheus scrapes the OTel Collector's metrics endpoint and stores the time series for querying
- `rate()`, `histogram_quantile()`, and division of `_sum` / `_count` are the core PromQL patterns for understanding throughput and latency
- Metric attributes create segmented time series but must have bounded cardinality

Your service now emits three observability signals: structured logs (page 05), distributed traces (page 06), and Prometheus metrics (this page). The next page adds graceful shutdown so in-flight traces and metrics are flushed before the process exits.

[Next → Graceful shutdown](/expert/08-graceful-shutdown)
