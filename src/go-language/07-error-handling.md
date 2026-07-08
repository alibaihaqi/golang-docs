---
title: Error handling
tier: go-language
platform: golang
---

# Error handling

[Go Language](./index.md) › 07 Error handling

## The `error` interface

Errors in Go are values. They implement the built-in `error` interface:

```go
type error interface {
    Error() string
}
```

Any type that has an `Error() string` method satisfies the interface. This means errors are extensible — you can define custom error types that carry extra information while still being usable as plain `error` values.

```go
func SafeDivide(a, b int) (int, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

result, err := SafeDivide(10, 0)
if err != nil {
    fmt.Println(err) // "division by zero"
}
```

The convention is to always return `error` as the last return value, and to check it immediately after the call.

## Creating errors

### `errors.New`

The simplest way to create an error:

```go
var ErrNotFound = errors.New("item not found")
```

`errors.New` returns a value with a fixed message. Use it for **sentinel errors** — named error values that callers can compare against.

### `fmt.Errorf`

For errors that include dynamic content:

```go
userID := 42
err := fmt.Errorf("user %d not found in database", userID)
// "user 42 not found in database"
```

`fmt.Errorf` formats a message using the same verbs as `fmt.Sprintf`. By default it creates a new error — it does not preserve any underlying error (see wrapping below for Go 1.13+ behaviour).

## Sentinel errors

A sentinel error is a named package-level variable:

```go
package store

var (
    ErrNotFound = errors.New("not found")
    ErrConflict = errors.New("resource conflict")
    ErrForbidden = errors.New("access denied")
)
```

Callers compare with `==`:

```go
_, err := store.Get("item:1")
if err == store.ErrNotFound {
    // handle not found
}
```

Sentinel errors work well for expected, non-recoverable conditions that the caller needs to distinguish. They are less useful when the error carries additional context (e.g., which ID was not found).

### Sentinel error conventions

- Prefix with `Err` by convention (`ErrNotFound`, `ErrTimeout`).
- Document them as part of the package API.
- Use them sparingly — too many sentinel errors make callers write long `if` chains.

## Custom error types

When an error needs structured data, define a custom type:

```go
type ValidationError struct {
    Field string
    Value any
    Rule  string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed: %s %s (value: %v)", e.Field, e.Rule, e.Value)
}

func ValidateAge(age int) error {
    if age < 0 {
        return &ValidationError{
            Field: "age",
            Value: age,
            Rule:  "must be non-negative",
        }
    }
    if age > 150 {
        return &ValidationError{
            Field: "age",
            Value: age,
            Rule:  "must be realistic",
        }
    }
    return nil
}
```

Custom error types give callers access to structured information via type assertions — but without wrapping (see below), the caller needs to know the concrete type, which couples them to your package.

### When to use custom types

Use sentinel errors for simple, well-known conditions. Use custom types when:
- The caller needs structured data from the error (field name, invalid value, etc.).
- The error needs to be handled differently based on its content.
- Multiple error conditions share the same structure.

## Error wrapping (Go 1.13)

Go 1.13 introduced error wrapping with `%w`:

```go
func ReadConfig(path string) error {
    data, err := os.ReadFile(path)
    if err != nil {
        return fmt.Errorf("reading config %s: %w", path, err)
    }
    // ...
}
```

The `%w` verb creates a **wrapped error** — a new error that contains the original inside it. The wrapper adds context while preserving the original error for inspection.

### Unwrapping with `errors.Is`

`errors.Is` checks whether an error matches a sentinel value by walking the wrapping chain:

```go
var ErrNotFound = errors.New("not found")

func FindUser(id int) (*User, error) {
    return nil, fmt.Errorf("user %d: %w", id, ErrNotFound)
}

_, err := FindUser(42)
if errors.Is(err, ErrNotFound) {
    fmt.Println("user not found")
}
```

`errors.Is` is checked against the sentinel directly, not its message. Use `errors.Is` instead of `==` when you use error wrapping — it handles both wrapped and unwrapped errors correctly.

### Unwrapping with `errors.As`

`errors.As` checks whether any error in the chain is of a specific type:

```go
_, err := ValidateAge(-5)

var valErr *ValidationError
if errors.As(err, &valErr) {
    fmt.Printf("field %s: %s (was %v)\n", valErr.Field, valErr.Rule, valErr.Value)
}
```

`errors.As` assigns the first matching error in the chain to the target pointer. Unlike `errors.Is` (which compares values), `errors.As` checks types.

### `errors.Is` vs `errors.As`

| `errors.Is(err, target)` | `errors.As(err, &target)` |
|--------------------------|---------------------------|
| Checks value equality | Checks type matching |
| Sentinel errors only | Custom error types |
| Uses `==` on each unwrapped error | Assigns to target pointer |
| Linear search through chain | First matching type wins |

Use `errors.Is` when you defined `var ErrX = errors.New(...)`. Use `errors.As` when you defined `type XError struct` and need the extra fields.

### Custom error wrapping

A custom error type implements `Unwrap` to participate in the chain:

```go
type QueryError struct {
    Query string
    Err   error
}

func (e *QueryError) Error() string {
    return fmt.Sprintf("query %q: %v", e.Query, e.Err)
}

func (e *QueryError) Unwrap() error {
    return e.Err
}
```

Now `errors.Is` and `errors.As` can walk through `*QueryError` to reach the wrapped error.

### Wrapping multiple errors (Go 1.20+)

Go 1.20 added `errors.Join` and support for multiple wrapped errors:

```go
errs := errors.Join(
    fmt.Errorf("step 1: %w", err1),
    fmt.Errorf("step 2: %w", err2),
    fmt.Errorf("step 3: %w", err3),
)

errors.Is(errs, err1) // true
errors.Is(errs, err2) // true
errors.Is(errs, err3) // true
```

`errors.Join` creates an error that returns `true` for `errors.Is` against any of its wrapped errors. This is useful for validation or batch processing where multiple independent operations can fail.

## `panic` and `recover`

### Panic

`panic` stops the normal execution of the current goroutine and begins unwinding the stack, running deferred functions along the way:

```go
func MustParse(input string) int {
    n, err := strconv.Atoi(input)
    if err != nil {
        panic(fmt.Sprintf("MustParse: invalid input %q", input))
    }
    return n
}
```

### When to panic

Panic is **only for programmer errors** — things that should never happen:

- Nil dereference (compiler-bug level confidence).
- Index out of bounds.
- Invalid state that violates an invariant.
- An untyped `nil` used as an interface value.

Do NOT use panic for:
- Expected failures (network timeouts, validation errors, missing files).
- "Exception" style control flow.
- Any error the caller could reasonably handle.

### Recover

`recover` stops the panic and returns the panic value. It only works inside a `defer`:

```go
func SafeHandler(fn func()) (err error) {
    defer func() {
        if r := recover(); r != nil {
            err = fmt.Errorf("panic recovered: %v", r)
        }
    }()
    fn()
    return nil
}

SafeHandler(func() {
    // This panic is caught and returned as an error
    panic("something went wrong")
})
```

### Practical recover pattern: HTTP middleware

The most common use of recover in production is server middleware:

```go
func RecoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if r := recover(); r != nil {
                log.Printf("panic recovered: %v\n%s", r, debug.Stack())
                http.Error(w, "Internal Server Error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

This ensures a single panicking request handler does not crash the entire server.

### Recover for goroutine cleanup

Any `go` function that might panic should have a recover:

```go
func worker() {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("worker panic: %v", r)
        }
    }()
    // do work
}

go worker()
```

Without this, a panicking goroutine crashes the entire process, not just the goroutine.

## Common mistakes

### Ignoring errors silently

```go
// Bad
rows, _ := db.Query("SELECT * FROM users")

// Good
rows, err := db.Query("SELECT * FROM users")
if err != nil {
    return fmt.Errorf("query users: %w", err)
}
```

### Using `==` with wrapped errors

```go
// Bad — does not traverse wrapping chain
if err == store.ErrNotFound { /* ... */ }

// Good — traverses wrapping chain
if errors.Is(err, store.ErrNotFound) { /* ... */ }
```

### Panicking in libraries

```go
// Bad — caller cannot recover from a library panic
func (s *Store) mustGet(id string) *Item {
    item, ok := s.items[id]
    if !ok {
        panic("item not found")
    }
    return item
}

// Good — return error, let caller decide
func (s *Store) Get(id string) (*Item, error) {
    item, ok := s.items[id]
    if !ok {
        return nil, fmt.Errorf("store: %s: %w", id, ErrNotFound)
    }
    return item, nil
}
```

### String comparison instead of sentinels

```go
// Bad — fragile, ties caller to exact message
if err.Error() == "division by zero" { /* ... */ }

// Good
var ErrDivisionByZero = errors.New("division by zero")
if errors.Is(err, ErrDivisionByZero) { /* ... */ }
```

## Links to existing tiers

The [Beginner tier](../beginner/) returns plain `error` values throughout the todo app — it demonstrates the basic `if err != nil` pattern. The [Intermediate tier](../intermediate/) introduces custom error types for the `Store` layer and uses `errors.Is` in retry logic. The [Advanced tier](../advanced/) graceful shutdown handler uses `os.Signal` with error channels — a pattern built on the `error` interface from this page.

---

**Next:** [08 Packages and modules](./08-packages-and-modules.md)
