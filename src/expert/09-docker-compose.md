---
title: Docker Compose
tier: expert
platform: golang
---

# Docker Compose

So far you have run Kafka in Docker but the event processor as a bare `go run main.go` process. Docker Compose orchestrates the full stack — Kafka, the OTel Collector, Jaeger, Prometheus, and the event processor itself — so the entire system boots with one command.

## Final docker-compose.yml

Create `docker-compose.yml` at the root of your project:

```yaml
services:
  kafka:
    image: confluentinc/cp-kafka:7.6
    ports:
      - "9092:9092"
    depends_on:
      zookeeper:
        condition: service_started
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    healthcheck:
      test: ["CMD-SHELL", "kafka-broker-api-versions --bootstrap-server localhost:9092"]
      interval: 10s
      timeout: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.6
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports:
      - "4317:4317"   # gRPC OTLP — app sends traces/metrics here
      - "8888:8888"   # Prometheus metrics — prometheus scrapes here
    depends_on:
      - jaeger
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    command: ["--config", "/etc/otel-collector-config.yaml"]

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686" # UI
    environment:
      COLLECTOR_OTLP_ENABLED: "true"

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    depends_on:
      - otel-collector

  event-processor:
    build: .
    ports:
      - "8080:8080"   # health endpoints
    depends_on:
      kafka:
        condition: service_healthy
      otel-collector:
        condition: service_started
    environment:
      KAFKA_BROKER: kafka:9092
      OTEL_EXPORTER_OTLP_ENDPOINT: otel-collector:4317
```

### Port allocation

| Port | Service | Purpose |
|------|---------|---------|
| `9092` | Kafka | Producer/consumer connections |
| `2181` | Zookeeper | Kafka metadata |
| `4317` | OTel Collector | OTLP gRPC ingestion (app sends here) |
| `8888` | OTel Collector | Prometheus metrics endpoint |
| `16686` | Jaeger | Web UI |
| `9090` | Prometheus | Web UI |
| `8080` | Event processor | Health check endpoints |

The OTel Collector is the single ingestion point. The app sends traces and metrics to `otel-collector:4317` via OTLP gRPC. The Collector processes and fans out: traces go to Jaeger, metrics are exposed on `:8888` for Prometheus to scrape.

## OTel Collector config

Create `otel-collector-config.yaml` alongside docker-compose.yml:

```yaml
receivers:
  otlp:
    protocols:
      grpc:

exporters:
  prometheus:
    endpoint: "0.0.0.0:8888"
  otlp:
    endpoint: jaeger:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      exporters: [prometheus]
```

The pipeline flow:

```
App (OTLP gRPC)
  │
  ▼
OTel Collector
  │
  ├── traces pipeline ──► OTLP exporter ──► Jaeger (port 4317)
  │
  └── metrics pipeline ──► Prometheus exporter ──► scraped by Prometheus
```

Note the difference from the tracing-only config in page 06: here we define two pipelines — `traces` and `metrics`. The traces pipeline uses the OTLP exporter (which forwards to Jaeger via its OTLP gRPC port), while the metrics pipeline uses the Prometheus exporter (which exposes a `/metrics` endpoint on port 8888 for Prometheus to scrape).

## Prometheus config

Create `prometheus.yml` alongside docker-compose.yml:

```yaml
scrape_configs:
  - job_name: "otel-collector"
    scrape_interval: 10s
    static_configs:
      - targets: ["otel-collector:8888"]
```

Prometheus scrapes the OTel Collector's metrics endpoint every 10 seconds. The Collector exposes both the metrics it has ingested from the app and its own internal metrics (memory, gRPC requests, exporter failures).

## Dockerfile multi-stage build

Create a `Dockerfile` at the root of your project. The multi-stage build compiles the Go binary in a build stage, then copies only the binary into a minimal runtime image:

```dockerfile
# ---- Build stage ----
FROM golang:1.22-alpine AS builder
WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o event-processor .

# ---- Runtime stage ----
FROM alpine:3.19
RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /build/event-processor .

EXPOSE 8080
CMD ["./event-processor"]
```

Key points:

- `CGO_ENABLED=0` — produces a statically linked binary that runs on any Linux without C libraries
- `GOOS=linux` — cross-compile for Linux (the Docker runtime)
- `alpine:3.19` — minimal runtime image (~5 MB plus the binary)
- `ca-certificates` — needed for TLS verification if your app connects to external services

Build the image:

```bash
docker build -t event-processor:latest .
```

## End-to-end verification

With all config files in place:

```bash
# 1. Start the full stack
docker compose up -d

# 2. Verify all services are running
docker compose ps

# 3. Check the logs of the event processor
docker compose logs -f event-processor
```

You should see the health endpoint message in the logs:

```
{"time":"...","level":"INFO","msg":"health endpoints listening on :8080"}
```

Produce a test event from the host:

```bash
echo '{"id":"ord_001","user_id":"user_1","amount":100}' | kcat -P -b localhost:9092 -t orders
```

Check that the processor picks it up:

```
{"time":"...","level":"INFO","msg":"event processed","event_id":"ord_001","user_id":"user_1","amount":100}
```

### Verify observability

**Jaeger UI** — open http://localhost:16686:

1. Select **event-processor** from the Service dropdown
2. Click **Find Traces**
3. Verify you see a trace with spans for the processed event

**Prometheus UI** — open http://localhost:9090:

1. Go to **Graph**
2. Query `rate(events.consumed_total[1m])` — you should see a data point for the event you produced
3. Query `rate(event.processing.duration_count[1m])` — processing rate

**Health endpoints** — verify readiness:

```bash
curl http://localhost:8080/healthz
# {"status":"ok"}
curl http://localhost:8080/readyz
# {"status":"ready"}
```

### Clean shutdown

Docker Compose sends SIGTERM to each container when you bring the stack down. The event processor's signal handler catches it and shuts down gracefully:

```bash
docker compose down
```

The logs show the graceful shutdown sequence:

```
event-processor  | {"time":"...","level":"INFO","msg":"shutting down"}
event-processor  | {"time":"...","level":"INFO","msg":"shutdown complete"}
```

To clean up volumes (delete Kafka data):

```bash
docker compose down -v
```

## What you learned

- Docker Compose orchestrates Kafka, Zookeeper, OTel Collector, Jaeger, Prometheus, and the event processor
- The OTel Collector fans out traces to Jaeger and exposes metrics for Prometheus scraping
- The Prometheus exporter in the Collector is configured with `endpoint: "0.0.0.0:8888"` and Prometheus scrapes it on the `otel-collector:8888` target
- The OTel pipeline now handles both traces and metrics in separate pipelines
- Multi-stage Dockerfile produces a 5 MB runtime image from a Go build
- `healthcheck` on the Kafka service ensures the processor only starts when Kafka is ready
- `docker compose down` sends SIGTERM, which triggers the graceful shutdown handler from page 08

The full event-driven observability stack is now containerised and ready for production-like environments. The next and final page adds integration tests with Testcontainers so you can verify the entire pipeline in CI.

[Next → Testing](/expert/10-testing)
