---
title: Integration tests
tier: advanced
platform: golang
position: 7
---

# Integration tests

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › Integration tests

**Goal**

Write integration tests that run against a real PostgreSQL database using Testcontainers. The tests spin up a Postgres container, run migrations, execute store operations, and tear down automatically.

**Prerequisites**

- [Docker multistage](./06-docker-multistage.md) — Docker is needed to run Testcontainers
- Go 1.22+

## Add Testcontainers

```bash
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/postgres
```

## Integration test file

Create `items_integration_test.go`:

```go
package main

import (
	"context"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
)

func setupTestDB(t *testing.T) *Store {
	t.Helper()
	ctx := context.Background()

	pg, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("postgres:17-alpine"),
		postgres.WithDatabase("testdb"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		postgres.WithSQLDriver("pgx"),
	)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pg.Terminate(ctx) })

	dsn, err := pg.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := migrate(pool); err != nil {
		t.Fatal(err)
	}
	return &Store{pool: pool}
}
```

`t.Cleanup` registers the container teardown — it runs automatically when the test finishes, even on failure.

## Store integration tests

```go
func TestStoreCreateAndGet(t *testing.T) {
	s := setupTestDB(t)
	ctx := context.Background()

	created, err := s.Create(ctx, "integration-test-item")
	if err != nil {
		t.Fatal(err)
	}
	if created.Name != "integration-test-item" {
		t.Errorf("got %q, want %q", created.Name, "integration-test-item")
	}

	got, err := s.Get(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != created.Name {
		t.Errorf("got %q, want %q", got.Name, created.Name)
	}
}

func TestStoreList(t *testing.T) {
	s := setupTestDB(t)
	ctx := context.Background()

	s.Create(ctx, "a")
	s.Create(ctx, "b")

	items, err := s.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 {
		t.Errorf("got %d items, want 2", len(items))
	}
}
```

## Run integration tests

Integration tests are slower than unit tests (container startup takes ~3s). Only run them when you specifically need to verify database behavior:

```bash
go test -v -run TestStore -timeout 60s .
```

The first run downloads the PostgreSQL image; subsequent runs use the cached image.

## Checkpoint

```bash
go test -v -run TestStoreCreateAndGet -timeout 30s .
# --- PASS: TestStoreCreateAndGet (3.2s)
# Container starts, migration runs, item is created and fetched, container is terminated.
```

**Next:** [Benchmarks and profiling](./08-benchmarks-and-profiling.md) — measure and optimize API performance.
