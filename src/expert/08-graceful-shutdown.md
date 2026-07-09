---
title: Graceful shutdown
tier: expert
platform: golang
---

# Graceful shutdown

Your event processor emits structured logs, distributed traces, and Prometheus metrics. But a hard `SIGKILL` (`kill -9`) or an unhandled `SIGINT` (Ctrl-C) drops in-flight messages and loses the last few spans and metric data points. Graceful shutdown fixes this: catch the OS signal, signal all components to stop, flush observability data, and only then exit.

## Signal handling with os/signal

The `os/signal` package provides a channel-based mechanism to receive OS signals. Create a buffered channel (buffer of 1 so the signal is never missed), register for the signals you care about, and block on the channel:

```go
import (
    "os/signal"
    "syscall"
)

sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
```

- **SIGINT** — sent by Ctrl-C in the terminal
- **SIGTERM** — sent by Docker or orchestration systems (Kubernetes, Nomad) to request a graceful stop
- **Buffered channel** — ensures `signal.Notify` never blocks even if the channel is not being read yet

When a signal arrives, the program should stop accepting new work, finish in-flight work, flush buffers, and exit.

## Shutdown orchestration

The `context.WithCancel` pattern is the idiomatic way to signal goroutines to stop. Create a cancellable context in `main`, start your goroutines with it, then cancel on signal.

The complete shutdown sequence:

1. Cancel the context — consumers and other goroutines see `ctx.Done()` and return
2. Close the Kafka reader — commits offsets for the current batch
3. Shut down the tracer provider — flushes remaining spans to the OTel Collector
4. Shut down the meter provider — flushes remaining metric data
5. Log completion — confirmation in the logs

```go
func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // —snip— init log/slog, tracer, meter, Kafka reader…

    go consume(ctx, reader, logger, tracer, meter)
    go serveHealthEndpoints()

    <-sigCh                    // block until signal
    logger.Info("shutting down")

    cancel()                   // signals consumer to stop
    reader.Close()             // commits offsets, closes connection
    tp.Shutdown(ctx)           // flushes remaining spans
    mp.Shutdown(ctx)           // flushes remaining metrics
    logger.Info("shutdown complete")
}
```

The goroutines do not need to synchronise on exit — `cancel()` signals them all at once, and they return from their read loops when they see the cancelled context.

## Consumer loop respects ctx.Done()

The Kafka consumer loop is the critical path. When the context is cancelled, `reader.ReadMessage(ctx)` returns immediately with `context.Canceled`. The loop must recognise this error and return instead of treating it as a Kafka error:

```go
func consume(ctx context.Context, r *kafka.Reader, logger *slog.Logger, tracer trace.Tracer, meter metric.Meter) {
    propagator := propagation.TraceContext{}
    eventsConsumed, _ := meter.Int64Counter("events.consumed")
    errorsTotal, _ := meter.Int64Counter("events.errors")
    processingDuration, _ := meter.Float64Histogram("event.processing.duration")

    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            if errors.Is(err, context.Canceled) {
                return // graceful shutdown
            }
            logger.Error("read error", "error", err)
            errorsTotal.Add(ctx, 1,
                metric.WithAttributes(attribute.String("error_type", "read_failed")),
            )
            continue
        }

        // Extract trace context and process
        carrier := propagation.MapCarrier{}
        for _, h := range msg.Headers {
            carrier[h.Key] = string(h.Value)
        }
        ctx = propagator.Extract(ctx, carrier)

        _, span := tracer.Start(ctx, "process_order")
        start := time.Now()

        var event OrderEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            span.SetAttributes(attribute.String("error", err.Error()))
            span.End()
            errorsTotal.Add(ctx, 1,
                metric.WithAttributes(attribute.String("error_type", "decode_error")),
            )
            continue
        }

        span.SetAttributes(
            attribute.String("event.id", event.ID),
            attribute.Float64("event.amount", event.Amount),
        )
        logger.Info("event processed",
            "event_id", event.ID,
            "user_id", event.UserID,
            "amount", event.Amount,
        )

        eventsConsumed.Add(ctx, 1,
            metric.WithAttributes(attribute.String("event_type", "order.created")),
        )
        processingDuration.Record(ctx,
            float64(time.Since(start).Milliseconds()),
            metric.WithAttributes(attribute.String("event_type", "order.created")),
        )
        span.End()
    }
}
```

The key line: `if errors.Is(err, context.Canceled) { return }`. Without this check the consumer treats context cancellation as a transient error and logs/spins until the process is killed.

## Health check HTTP endpoints

Alongside the consumer, run a small HTTP server that Kubernetes, Docker Compose, or a load balancer can poll for liveness and readiness:

```go
func serveHealthEndpoints() {
    mux := http.NewServeMux()

    mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })

    mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
    })

    slog.Info("health endpoints listening on :8080")
    http.ListenAndServe(":8080", mux)
}
```

- `/healthz` — liveness probe: is the process alive?
- `/readyz` — readiness probe: is the process ready to accept traffic?

For production, the readiness check would verify that the Kafka connection is still open. For this tutorial, both return `200 OK` immediately.

## Complete integrated main.go

All components from pages 01–07 converge in a single `main.go`. Here is the complete file with graceful shutdown wired in:

```go
package main

import (
    "context"
    "encoding/json"
    "errors"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/segmentio/kafka-go"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/metric"
    "go.opentelemetry.io/otel/propagation"
    sdkmetric "go.opentelemetry.io/otel/sdk/metric"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    "go.opentelemetry.io/otel/sdk/resource"
    semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
    "go.opentelemetry.io/otel/trace"
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
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
    slog.SetDefault(logger)

    tp, err := initTracer()
    if err != nil {
        logger.Error("failed to init tracer", "error", err)
        os.Exit(1)
    }
    mp, err := initMeter()
    if err != nil {
        logger.Error("failed to init meter", "error", err)
        os.Exit(1)
    }

    tracer := otel.Tracer("event-processor")
    meter := otel.Meter("event-processor")

    reader := kafka.NewReader(kafka.ReaderConfig{
        Brokers:   []string{"localhost:9092"},
        Topic:     "orders",
        GroupID:   "event-processor",
        MinBytes:  10,
        MaxBytes:  10e6,
        MaxWait:   time.Second,
    })

    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

    go consume(ctx, reader, logger, tracer, meter)
    go serveHealthEndpoints()

    <-sigCh
    logger.Info("shutting down")

    cancel()
    if err := reader.Close(); err != nil {
        logger.Error("reader close error", "error", err)
    }
    if err := tp.Shutdown(ctx); err != nil {
        logger.Error("tracer shutdown error", "error", err)
    }
    if err := mp.Shutdown(ctx); err != nil {
        logger.Error("meter shutdown error", "error", err)
    }
    logger.Info("shutdown complete")
}

func consume(ctx context.Context, r *kafka.Reader, logger *slog.Logger, tracer trace.Tracer, meter metric.Meter) {
    propagator := propagation.TraceContext{}
    eventsConsumed, _ := meter.Int64Counter("events.consumed")
    errorsTotal, _ := meter.Int64Counter("events.errors")
    processingDuration, _ := meter.Float64Histogram("event.processing.duration")

    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            if errors.Is(err, context.Canceled) {
                return
            }
            logger.Error("read error", "error", err)
            errorsTotal.Add(ctx, 1,
                metric.WithAttributes(attribute.String("error_type", "read_failed")),
            )
            continue
        }

        carrier := propagation.MapCarrier{}
        for _, h := range msg.Headers {
            carrier[h.Key] = string(h.Value)
        }
        ctx = propagator.Extract(ctx, carrier)

        _, span := tracer.Start(ctx, "process_order")
        start := time.Now()

        var event OrderEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            span.SetAttributes(attribute.String("error", err.Error()))
            span.End()
            errorsTotal.Add(ctx, 1,
                metric.WithAttributes(attribute.String("error_type", "decode_error")),
            )
            continue
        }

        span.SetAttributes(
            attribute.String("event.id", event.ID),
            attribute.Float64("event.amount", event.Amount),
        )
        logger.Info("event processed",
            "event_id", event.ID,
            "user_id", event.UserID,
            "amount", event.Amount,
        )

        eventsConsumed.Add(ctx, 1,
            metric.WithAttributes(attribute.String("event_type", "order.created")),
        )
        processingDuration.Record(ctx,
            float64(time.Since(start).Milliseconds()),
            metric.WithAttributes(attribute.String("event_type", "order.created")),
        )
        span.End()
    }
}

func serveHealthEndpoints() {
    mux := http.NewServeMux()
    mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })
    mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
    })

    slog.Info("health endpoints listening on :8080")
    http.ListenAndServe(":8080", mux)
}

func initTracer() (*sdktrace.TracerProvider, error) {
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

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(res),
    )
    otel.SetTracerProvider(tp)
    return tp, nil
}

func initMeter() (*sdkmetric.MeterProvider, error) {
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

    mp := sdkmetric.NewMeterProvider(
        sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter)),
        sdkmetric.WithResource(res),
    )
    otel.SetMeterProvider(mp)
    return mp, nil
}
```

## Running the checkpoint

Start the service and verify graceful shutdown:

```bash
# Ensure Kafka is running (docker compose up -d kafka if not already)
go run main.go

# In another terminal, produce a few events:
echo '{"id":"ord_001","user_id":"user_1","amount":100}' | kcat -P -b localhost:9092 -t orders
echo '{"id":"ord_002","user_id":"user_2","amount":50}'  | kcat -P -b localhost:9092 -t orders

# Hit Ctrl-C in the service terminal
^C
```

Expected logs:

```
{"time":"...","level":"INFO","msg":"health endpoints listening on :8080"}
{"time":"...","level":"INFO","msg":"event processed","event_id":"ord_001","user_id":"user_1","amount":100}
{"time":"...","level":"INFO","msg":"event processed","event_id":"ord_002","user_id":"user_2","amount":50}
{"time":"...","level":"INFO","msg":"shutting down"}
{"time":"...","level":"INFO","msg":"shutdown complete"}
```

The consumer processes the in-flight message, the reader commits the offset, the tracer and meter flush their buffers, and the process exits cleanly. No dropped messages, no lost spans, no lost metric data points.

## What you learned

- `os/signal` and `signal.Notify` catch OS signals on a buffered channel
- `context.WithCancel` signals all goroutines to stop simultaneously
- The consumer loop recognises `context.Canceled` and returns instead of logging an error
- `reader.Close()` commits offsets so the consumer group resumes from the correct position
- `tp.Shutdown(ctx)` and `mp.Shutdown(ctx)` flush remaining observability data
- `/healthz` and `/readyz` HTTP endpoints provide liveness and readiness probes
- A single `main.go` integrates signal handling, Kafka, logging, tracing, and metrics

Your event processor is now production-ready: it starts cleanly, runs reliably, and stops without data loss. The next page packages everything into Docker Compose so you can run the full stack with a single command.

[Next → Docker Compose](/expert/09-docker-compose)
