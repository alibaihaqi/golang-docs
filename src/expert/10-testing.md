---
title: Testing
tier: expert
platform: golang
---

# Testing

Your event processor is a distributed system: Kafka on one side, OTel on another, and your application logic in the middle. Unit tests alone cannot catch producer-consumer mismatches, trace propagation errors, or metric sequence issues. Integration tests with **Testcontainers** give you a real Kafka broker inside your test run — no mocks, no stubs, no half-truths.

## Testcontainers for Kafka

[Testcontainers for Go](https://golang.testcontainers.org/) starts Docker containers programmatically from your test code. The Kafka module handles broker configuration, cluster ID, and port mapping automatically.

### Dependencies

```bash
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/kafka
```

### Create a topic

Testcontainers provides a helper to create topics on the running Kafka container:

```go
import (
    "context"
    "testing"

    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/kafka"
)

func TestWithKafkaContainer(t *testing.T) {
    ctx := context.Background()

    kafkaContainer, err := kafka.RunContainer(ctx,
        kafka.WithClusterID("test-cluster"),
    )
    if err != nil {
        t.Fatal(err)
    }
    defer kafkaContainer.Terminate(ctx)

    brokers, err := kafkaContainer.Brokers(ctx)
    if err != nil {
        t.Fatal(err)
    }

    // createTopic is a test helper that creates a topic via kafka admin
    createTopic(ctx, t, brokers[0], "test-orders")
}
```

The `kafka.RunContainer` call:
1. Pulls the `confluentinc/confluent-local` image (a single-node Kafka in a container)
2. Starts the container
3. Waits until the broker is ready
4. Returns the connection address

## Integration test: produce → consume → assert

The full integration test writes a message to a topic with the producer, reads it back with the consumer, and asserts the event fields match:

```go
func TestOrderEventFlow(t *testing.T) {
    ctx := context.Background()

    kafkaContainer, err := kafka.RunContainer(ctx,
        kafka.WithClusterID("test-cluster"),
    )
    if err != nil {
        t.Fatal(err)
    }
    defer kafkaContainer.Terminate(ctx)

    brokers, err := kafkaContainer.Brokers(ctx)
    if err != nil {
        t.Fatal(err)
    }
    brokerAddr := brokers[0]
    topic := "test-orders"
    createTopic(ctx, t, brokerAddr, topic)

    producer := &kafka.Writer{
        Addr:     kafka.TCP(brokerAddr),
        Topic:    topic,
        Balancer: &kafka.LeastBytes{},
    }
    defer producer.Close()

    event := OrderEvent{ID: "ord_test_1", UserID: "user_test", Amount: 49.99}
    data, _ := json.Marshal(event)
    err = producer.WriteMessages(ctx, kafka.Message{
        Key:   []byte(event.UserID),
        Value: data,
    })
    if err != nil {
        t.Fatal(err)
    }

    reader := kafka.NewReader(kafka.ReaderConfig{
        Brokers:   []string{brokerAddr},
        Topic:     topic,
        GroupID:   "test-group",
        MinBytes:  10,
        MaxBytes:  10e6,
        MaxWait:   time.Second,
    })
    defer reader.Close()

    msg, err := reader.ReadMessage(ctx)
    if err != nil {
        t.Fatal(err)
    }

    var got OrderEvent
    if err := json.Unmarshal(msg.Value, &got); err != nil {
        t.Fatal(err)
    }

    if got.ID != event.ID {
        t.Errorf("expected event ID %s, got %s", event.ID, got.ID)
    }
    if got.Amount != event.Amount {
        t.Errorf("expected amount %f, got %f", event.Amount, got.Amount)
    }
}
```

The test does not need a pre-existing Kafka cluster. Testcontainers creates one, the test uses it, and `defer kafkaContainer.Terminate(ctx)` destroys it when the test finishes.

### createTopic helper

```go
func createTopic(ctx context.Context, t *testing.T, broker, topic string) {
    t.Helper()

    conn, err := kafka.Dial("tcp", broker)
    if err != nil {
        t.Fatal(err)
    }
    defer conn.Close()

    controller, err := conn.Controller()
    if err != nil {
        t.Fatal(err)
    }

    controllerConn, err := kafka.Dial("tcp", controller.Host+":"+strconv.Itoa(controller.Port))
    if err != nil {
        t.Fatal(err)
    }
    defer controllerConn.Close()

    topicConfig := kafka.TopicConfig{
        Topic:             topic,
        NumPartitions:     1,
        ReplicationFactor: 1,
    }
    if err := controllerConn.CreateTopics(topicConfig); err != nil {
        t.Fatal(err)
    }
}
```

## Testing tracing with test tracer provider

The test tracer provider captures spans in memory instead of sending them to an OTel Collector. This lets you assert that spans were created with the correct attributes:

```go
import (
    "go.opentelemetry.io/otel/sdk/trace"
    "go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func TestTracing(t *testing.T) {
    // Create an in-memory exporter
    exp := tracetest.NewInMemoryExporter()

    tp := trace.NewTracerProvider(
        trace.WithBatcher(exp),
    )
    otel.SetTracerProvider(tp)
    defer tp.Shutdown(context.Background())

    tracer := otel.Tracer("test")
    _, span := tracer.Start(context.Background(), "test_span")
    span.SetAttributes(attribute.String("event.id", "ord_test_1"))
    span.End()

    // Flush the batcher
    tp.ForceFlush(context.Background())

    spans := exp.GetSpans()
    if len(spans) != 1 {
        t.Fatalf("expected 1 span, got %d", len(spans))
    }

    if spans[0].Name() != "test_span" {
        t.Errorf("expected span name 'test_span', got %s", spans[0].Name())
    }

    attrs := spans[0].Attributes()
    found := false
    for _, attr := range attrs {
        if attr.Key == "event.id" && attr.Value.AsString() == "ord_test_1" {
            found = true
            break
        }
    }
    if !found {
        t.Error("expected event.id attribute on span")
    }
}
```

`tracetest.NewInMemoryExporter()` stores spans in a slice that you inspect after flushing. This pattern applies to any traced operation — replace the OTel exporter in your main function with an in-memory one in tests.

## Testing metrics with test meter provider

Similarly, the test meter provider records metric data in memory so you can assert counter values and histogram buckets:

```go
import (
    "go.opentelemetry.io/otel/sdk/metric"
    "go.opentelemetry.io/otel/sdk/metric/metricdata"
)

func TestMetrics(t *testing.T) {
    // Create a manual reader that lets you inspect metric data
    reader := metric.NewManualReader()

    mp := metric.NewMeterProvider(
        metric.WithReader(reader),
    )
    otel.SetMeterProvider(mp)
    defer mp.Shutdown(context.Background())

    meter := otel.Meter("test")
    counter, _ := meter.Int64Counter("events.test")
    counter.Add(context.Background(), 1)

    // Collect metric data from the reader
    rm := metricdata.ResourceMetrics{}
    err := reader.Collect(context.Background(), &rm)
    if err != nil {
        t.Fatal(err)
    }

    // Navigate the metric data structure to find the counter value
    if len(rm.ScopeMetrics) == 0 || len(rm.ScopeMetrics[0].Metrics) == 0 {
        t.Fatal("no metrics collected")
    }

    data := rm.ScopeMetrics[0].Metrics[0].Data
    agg, ok := data.(metricdata.Sum[int64])
    if !ok {
        t.Fatalf("expected Sum[int64], got %T", data)
    }
    if agg.DataPoints[0].Value != 1 {
        t.Errorf("expected counter value 1, got %d", agg.DataPoints[0].Value)
    }
}
```

`metric.NewManualReader()` gives you synchronous access to metric data. Unlike the periodic reader used in production (which pushes on a timer), the manual reader collects data only when you call `reader.Collect`. This eliminates race conditions in tests.

## Table-driven test for OrderProcessing

The table-driven test pattern from Go's standard library testing guide applies naturally to event validation. Each test case defines an `OrderEvent` and whether it should pass or fail validation:

```go
func TestOrderProcessing(t *testing.T) {
    tests := []struct {
        name    string
        event   OrderEvent
        wantErr bool
    }{
        {"valid order", OrderEvent{ID: "1", UserID: "user_1", Amount: 100, Email: "a@b.com"}, false},
        {"zero amount", OrderEvent{ID: "2", UserID: "user_1", Amount: 0, Email: "a@b.com"}, true},
        {"negative amount", OrderEvent{ID: "3", UserID: "user_1", Amount: -10, Email: "a@b.com"}, true},
        {"empty ID", OrderEvent{ID: "", UserID: "user_1", Amount: 100, Email: "a@b.com"}, true},
        {"empty user ID", OrderEvent{ID: "4", UserID: "", Amount: 100, Email: "a@b.com"}, true},
        {"missing email", OrderEvent{ID: "5", UserID: "user_1", Amount: 100, Email: ""}, true},
        {"high amount", OrderEvent{ID: "6", UserID: "user_1", Amount: 99999, Email: "a@b.com"}, false},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := validateOrder(tt.event)
            if (err != nil) != tt.wantErr {
                t.Errorf("validateOrder() error = %v, wantErr = %v", err, tt.wantErr)
            }
        })
    }
}

func validateOrder(e OrderEvent) error {
    if e.ID == "" {
        return errors.New("order ID is required")
    }
    if e.UserID == "" {
        return errors.New("user ID is required")
    }
    if e.Amount <= 0 {
        return errors.New("amount must be positive")
    }
    if e.Email == "" {
        return errors.New("email is required")
    }
    return nil
}
```

### Combining table-driven with integration

The same pattern extends to integration tests. Instead of validating a pure function, each row produces, consumes, and asserts:

```go
func TestOrderProcessingIntegration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test in short mode")
    }

    ctx := context.Background()

    kafkaContainer, err := kafka.RunContainer(ctx,
        kafka.WithClusterID("test-cluster"),
    )
    if err != nil {
        t.Fatal(err)
    }
    defer kafkaContainer.Terminate(ctx)

    brokers, err := kafkaContainer.Brokers(ctx)
    if err != nil {
        t.Fatal(err)
    }
    brokerAddr := brokers[0]
    topic := "test-orders"
    createTopic(ctx, t, brokerAddr, topic)

    tests := []struct {
        name    string
        event   OrderEvent
        wantErr bool
    }{
        {"valid order", OrderEvent{ID: "1", Amount: 100, UserID: "u1", Email: "a@b.com"}, false},
        {"zero amount", OrderEvent{ID: "2", Amount: 0, UserID: "u1", Email: "a@b.com"}, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            producer := &kafka.Writer{
                Addr:     kafka.TCP(brokerAddr),
                Topic:    topic,
                Balancer: &kafka.LeastBytes{},
            }
            defer producer.Close()

            data, _ := json.Marshal(tt.event)
            err := producer.WriteMessages(ctx, kafka.Message{
                Key:   []byte(tt.event.UserID),
                Value: data,
            })
            if err != nil {
                t.Fatal(err)
            }

            reader := kafka.NewReader(kafka.ReaderConfig{
                Brokers:   []string{brokerAddr},
                Topic:     topic,
                GroupID:   "test-group",
                MinBytes:  10,
                MaxBytes:  10e6,
                MaxWait:   time.Second,
            })
            defer reader.Close()

            msg, err := reader.ReadMessage(ctx)
            if (err != nil) != tt.wantErr {
                t.Fatalf("expected error=%v, got %v", tt.wantErr, err)
            }
            if err == nil {
                var got OrderEvent
                json.Unmarshal(msg.Value, &got)
                if got.ID != tt.event.ID {
                    t.Errorf("ID mismatch: %s != %s", got.ID, tt.event.ID)
                }
            }
        })
    }
}
```

### Running the tests

```bash
# Run all tests (unit + integration — requires Docker running)
go test -v -count=1 ./...

# Run only unit tests (skips Testcontainers-based tests)
go test -v -count=1 -short ./...
```

The `-count=1` flag disables test caching so every run uses a fresh Kafka container.

### CI considerations

Testcontainers requires Docker to be available on the CI runner. GitHub Actions, GitLab CI, and CircleCI all support Docker-outside-of-Docker (DooD):

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:27-dind
        options: --privileged
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - run: go test -v -count=1 ./...
```

Testcontainers automatically detects the Docker socket. No additional configuration is needed.

## What you learned

- Testcontainers for Go starts a real Kafka broker in a Docker container from your test code
- `kafka.RunContainer` with `WithClusterID` configures a single-node Kafka for testing
- Integration tests produce a message, consume it, and assert the event fields match
- `tracetest.NewInMemoryExporter` captures spans in memory so you can assert span names and attributes
- `metric.NewManualReader` gives synchronous access to metric data, eliminating race conditions from periodic readers
- The table-driven test pattern extends from pure validation functions to full integration flows
- `go test -v -count=1 ./...` runs all tests with a fresh state; `-short` skips Testcontainers-based tests
- CI needs Docker available (DooD) for Testcontainers to work

---

You've completed the **Expert tier** — an event-driven Go service with Kafka, structured logging, distributed tracing, Prometheus metrics, graceful shutdown, Docker Compose orchestration, and integration tests. Browse the [Overview](/expert/) or revisit the [Advanced tier](/advanced/) to compare REST vs event-driven architectures.
