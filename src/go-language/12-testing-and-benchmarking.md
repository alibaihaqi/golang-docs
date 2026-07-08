---
title: Testing and benchmarking
tier: go-language
platform: golang
---

# Testing and benchmarking

[Go Language](./index.md) › 12 Testing and benchmarking

Go ships with a complete testing framework in the standard library — no third-party test runner, no assertion library, no mocking framework. The `testing` package provides `testing.T` for unit tests, `testing.B` for benchmarks, and `testing.F` for fuzzing. The `go test` command discovers and runs them all.

## Table-driven tests

The canonical Go testing pattern — a slice of test cases iterated over with `t.Run`:

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name string
        a, b int
        want int
    }{
        {"positive", 1, 2, 3},
        {"negative", -1, 1, 0},
        {"zero", 0, 0, 0},
        {"large", 1_000_000, 2_000_000, 3_000_000},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Add(tt.a, tt.b)
            if got != tt.want {
                t.Errorf("Add(%d, %d) = %d, want %d", tt.a, tt.b, got, tt.want)
            }
        })
    }
}
```

### Why table-driven?

- Test logic is written once; test data is separate.
- Adding a new case is a single struct literal.
- Each case runs as a subtest — independent, named, filterable.
- `t.Errorf` reports the specific case and continues the test.

### Running specific cases

```bash
go test -run TestAdd/positive ./...
go test -run "TestAdd/(positive|negative)" ./...
```

## Subtests

Subtests allow hierarchical test organisation. Each `t.Run` creates an independent subtest — failure in one does not block others.

```go
func TestDatabase(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()

    t.Run("insert", func(t *testing.T) {
        err := db.Insert("key", "value")
        if err != nil {
            t.Fatal(err) // t.Fatal stops this subtest only
        }
    })

    t.Run("query", func(t *testing.T) {
        v, err := db.Get("key")
        if err != nil { t.Fatal(err) }
        if v != "value" {
            t.Errorf("got %q, want %q", v, "value")
        }
    })

    t.Run("not_found", func(t *testing.T) {
        _, err := db.Get("missing")
        if err != ErrNotFound {
            t.Errorf("want ErrNotFound, got %v", err)
        }
    })
}
```

### Parallel subtests

```go
func TestParallel(t *testing.T) {
    tests := []struct {
        name string
        fn   func() error
    }{
        {"slow", slowOp},
        {"fast", fastOp},
    }

    for _, tt := range tests {
        tt := tt
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            if err := tt.fn(); err != nil {
                t.Error(err)
            }
        })
    }
}
```

`t.Parallel()` marks the subtest as parallel — it runs concurrently with other parallel subtests. The outer test does not finish until all parallel subtests complete. Always capture loop variables (`tt := tt`) before passing them to closures.

## Test helpers and setup

### Helper functions

```go
func setupTestDB(t *testing.T) *sql.DB {
    t.Helper() // mark as test helper — failures report caller's line
    db, err := sql.Open("sqlite3", ":memory:")
    if err != nil {
        t.Fatalf("setup failed: %v", err)
    }
    return db
}
```

`t.Helper()` tells the test runner to skip the helper's frame in failure output. Always call `t.Helper()` at the start of any non-test function called from tests.

### Cleanup

```go
func TestWithCleanup(t *testing.T) {
    dir := t.TempDir() // automatically removed after test
    f, err := os.CreateTemp(dir, "test-*")
    if err != nil { t.Fatal(err) }
    defer f.Close()

    t.Cleanup(func() {
        // Runs after the test completes, even on panic
        log.Println("cleanup done")
    })
}
```

`t.TempDir()` creates a temporary directory that is automatically removed when the test finishes. `t.Cleanup` registers teardown functions that run even after a panic.

## Fuzzing (Go 1.18+)

Fuzz testing generates random inputs to find edge cases that trigger panics, crashes, or logic errors:

```go
func FuzzParseDuration(f *testing.F) {
    // Seed corpus — known valid inputs
    f.Add("5s")
    f.Add("1h30m")
    f.Add("-10ms")

    f.Fuzz(func(t *testing.T, input string) {
        d, err := time.ParseDuration(input)
        if err != nil {
            return // expected for invalid inputs
        }
        // If ParseDuration succeeded, String must round-trip
        if d.String() == "" {
            t.Errorf("empty duration string for %q", input)
        }
    })
}
```

```bash
go test -fuzz FuzzParseDuration -fuzztime 30s ./...
```

### Fuzzing basics

- Add seed corpus values with `f.Add(...)` — these are always tested.
- `f.Fuzz` receives the fuzzer and target function. Arguments match `f.Add` types.
- The fuzzer mutates inputs to maximise coverage.
- Crashes are written to `testdata/fuzz/FuzzXxx/` — fix the bug, re-run, the crash is verified as fixed.
- Supported types: `[]byte`, `string`, `int`/`int8`..`int64`, `uint`/`uint8`..`uint64`, `float32`/`float64`, `bool`.

## Benchmarks

Benchmarks measure performance: execution time, memory allocations, and allocation count.

```go
func BenchmarkAdd(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Add(1, 2)
    }
}
```

```bash
go test -bench=. -benchmem ./...
```

Output:

```
BenchmarkAdd-8    1000000000    0.5 ns/op    0 B/op    0 allocs/op
```

### Reading benchmark output

| Column | Meaning |
|--------|---------|
| `BenchmarkAdd-8` | Name and CPU count |
| `1000000000` | `b.N` — iterations the runner chose |
| `0.5 ns/op` | Nanoseconds per operation |
| `0 B/op` | Bytes allocated per operation |
| `0 allocs/op` | Allocations per operation |

### Sub-benchmarks

```go
func BenchmarkSum(b *testing.B) {
    benchmarks := []struct {
        name string
        size int
    }{
        {"small", 10},
        {"medium", 1000},
        {"large", 100000},
    }

    for _, bm := range benchmarks {
        b.Run(bm.name, func(b *testing.B) {
            data := make([]int, bm.size)
            for i := range data { data[i] = i }

            b.ResetTimer() // exclude setup from timing
            for i := 0; i < b.N; i++ {
                Sum(data)
            }
        })
    }
}
```

### Comparing benchmarks

```bash
go test -bench=BenchmarkSum -benchmem -count=5 ./... > old.txt
# after code change
go test -bench=BenchmarkSum -benchmem -count=5 ./... > new.txt

go install golang.org/x/perf/cmd/benchstat@latest
benchstat old.txt new.txt
```

`benchstat` shows the delta between two benchmark runs with statistical significance — whether the change is real or noise.

## Test fixtures with `testdata/`

The `testdata/` directory is special: `go test` ignores it during compilation but it is available at runtime relative to the test file.

```
mypackage/
  mycode.go
  mycode_test.go
  testdata/
    input.json
    expected_output.json
    fixtures/
      golden.txt
```

```go
func TestWithFixture(t *testing.T) {
    data, err := os.ReadFile("testdata/input.json")
    if err != nil { t.Fatal(err) }

    var input Input
    json.Unmarshal(data, &input)

    got := Process(input)

    expected, _ := os.ReadFile("testdata/expected_output.json")
    var want Output
    json.Unmarshal(expected, &want)

    if !reflect.DeepEqual(got, want) {
        t.Errorf("got %+v, want %+v", got, want)
    }
}
```

### Golden files

A common pattern for complex output:

```go
func TestGolden(t *testing.T) {
    got := generateHTML()
    golden := filepath.Join("testdata", "golden", t.Name()+".html")

    if *update {
        os.WriteFile(golden, got, 0644)
    }

    want, _ := os.ReadFile(golden)
    if !bytes.Equal(got, want) {
        t.Errorf("golden file mismatch\n--- got\n+++ want\n%s", diff(got, want))
    }
}
```

Use an `-update` flag to regenerate golden files when the output intentionally changes.

## Coverage

```bash
# Terminal output
go test -cover ./...
# ok      mypackage    0.5s    coverage: 82.3% of statements

# HTML report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

Every package is its own coverage unit. Coverage is statement-level, not branch-level. The HTML report colours each line green (covered) or red (not covered) — useful for visualising which paths are untested.

### Coverage in CI

```yaml
- run: go test -coverprofile=coverage.out -covermode=atomic ./...
- run: go tool cover -func=coverage.out
- uses: codecov/codecov-action@v3
  with:
    file: coverage.out
```

## Tools

### `go vet` — built-in static analysis

```bash
go vet ./...
```

Detects: unreachable code, incorrect Printf calls, lock misuse, unreachable case in switch, and more. Run it in CI before tests — it catches bugs that testing alone misses.

### `staticcheck` — advanced linting

```bash
go install honnef.co/go/tools/cmd/staticcheck@latest
staticcheck ./...
```

`staticcheck` extends `go vet` with hundreds of additional checks: unused code, style violations, performance issues, and correctness rules. It is the most widely used Go linter.

### `gotestsum` — coloured test output

```bash
go install gotest.tools/gotestsum@latest
gotestsum --format testname ./...
```

Produces human-readable output with colour, pass/fail counts, and slow test reporting. Compatible with all standard `go test` flags.

### `golangci-lint` — linter aggregator

```bash
go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest
golangci-lint run ./...
```

Runs dozens of linters in parallel with configurable rulesets. Standard in most Go CI pipelines.

## Links to existing tiers

The [Intermediate tier's SQLite handler](../intermediate/06-create-handler.md) uses table-driven tests for the HTTP handlers. The Advanced tier's rate limiter test uses parallel subtests. The CI/CD page demonstrates running `go test -cover` in a GitHub Actions pipeline.

---

**Next:** [13 Reflection and code generation](./13-reflection-and-code-generation.md)
