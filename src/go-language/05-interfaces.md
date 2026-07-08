---
title: Interfaces
tier: go-language
platform: golang
---

# Interfaces

[Go Language](./index.md) › 05 Interfaces

## What is an interface?

An interface is a **contract** expressed as a set of method signatures. Any type that implements all those methods satisfies the interface automatically — no `implements` keyword, no explicit declaration.

```go
type Stringer interface {
    String() string
}

type User struct {
    Name string
}

func (u User) String() string {
    return u.Name
}

// User satisfies Stringer automatically.
// It can be assigned to a Stringer variable:
var s Stringer = User{Name: "Alice"}
fmt.Println(s.String()) // "Alice"
```

This is **structural typing** (sometimes called "duck typing" at compile time): if a type walks like a duck and quacks like a duck, it *is* a duck for the purposes of the interface.

Because satisfaction is implicit, you can define an interface that existing types already satisfy — even types from external libraries. This makes interfaces **extensible from the outside**: you define the contract at the call site, not on the type.

## The empty interface

The empty interface `interface{}` (or `any` starting from Go 1.18) has zero methods. Every type satisfies it:

```go
var x any

x = 42
x = "hello"
x = User{Name: "Alice"}
x = []int{1, 2, 3}
```

### When to use it

Use `any` when you genuinely do not know the type at compile time:

- JSON decoding with `encoding/json`
- `fmt.Println` and friends
- Container types (before generics existed)

```go
func DecodeJSON(data []byte) (any, error) {
    var v any
    err := json.Unmarshal(data, &v)
    return v, err
}
```

### The cost: you must assert

You cannot call methods on a value of type `any` without a **type assertion**:

```go
val := DecodeJSON(data)
str, ok := val.(string) // type assertion
```

## Type assertions

A type assertion extracts the concrete value from an interface:

```go
var x any = "hello"

// Single-return form — panics on failure
s := x.(string) // "hello"
// n := x.(int) // panic: interface conversion

// Two-return form — safe
s, ok := x.(string) // "hello", true
n, ok := x.(int)    // 0, false (no panic)
```

Always prefer the two-return form unless you absolutely know the type and want a panic on mismatch.

### Using type assertions for interface upgrades

A common idiom is to check whether a value implements a more specific interface:

```go
// Flush writes buffered data to the underlying writer, if supported.
func Flush(w io.Writer) error {
    type flusher interface {
        Flush() error
    }
    if f, ok := w.(flusher); ok {
        return f.Flush()
    }
    return nil
}
```

This pattern — asserting a locally-defined interface — keeps the function decoupled from concrete types while still taking advantage of optional capabilities.

## Type switches

A type switch dispatches on the concrete type of an interface value:

```go
func describe(x any) string {
    switch v := x.(type) {
    case int:
        return fmt.Sprintf("int: %d", v)
    case string:
        return fmt.Sprintf("string: %q", v)
    case bool:
        return fmt.Sprintf("bool: %v", v)
    case User:
        return fmt.Sprintf("User: %s", v.Name)
    default:
        return fmt.Sprintf("unknown type: %T", v)
    }
}
```

Key properties:

- The syntax is `x.(type)` — only valid inside a `switch`.
- Each case binds `v` to the matched type.
- The `default` case handles anything not listed.
- Cases are evaluated in order, but unlike a regular `switch`, there is no fallthrough.
- Type switches are the idiomatic way to handle `any` values in Go.

### Type switch with nil

If `x` is `nil`, only the `nil` case matches:

```go
switch v := x.(type) {
case nil:
    fmt.Println("nil")
case int:
    fmt.Println(v)
}
```

## Standard interfaces

Several interfaces form the backbone of Go's standard library.

### `io.Reader` and `io.Writer`

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}
```

These two interfaces are the foundation of Go's composable I/O model. Any function that reads or writes bytes can be made to work with any reader or writer — files, network connections, buffers, compressed streams, encryption wrappers.

```go
func Copy(r io.Reader, w io.Writer) (int64, error) {
    return io.Copy(r, w)
}

// Works with any combination:
Copy(os.Stdin, os.Stdout)
Copy(strings.NewReader("hello"), os.Stdout)
Copy(file, &buf)
```

The composability comes from the fact that these interfaces are **tiny** — just one method each. This is not coincidence; it is a deliberate design principle.

### `fmt.Stringer`

```go
type Stringer interface {
    String() string
}
```

Any type that implements `String()` gets custom formatting in `fmt.Print`, `fmt.Sprintf`, and `%s` / `%v` verbs:

```go
type Point struct{ X, Y int }

func (p Point) String() string {
    return fmt.Sprintf("(%d, %d)", p.X, p.Y)
}

fmt.Println(Point{3, 4}) // "(3, 4)"
```

### `sort.Interface`

```go
type Interface interface {
    Len() int
    Less(i, j int) bool
    Swap(i, j int)
}
```

Implementing this interface lets you sort any collection:

```go
type ByName []User

func (s ByName) Len() int           { return len(s) }
func (s ByName) Less(i, j int) bool { return s[i].Name < s[j].Name }
func (s ByName) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }

users := []User{{"Bob"}, {"Alice"}}
sort.Sort(ByName(users))
```

### `http.Handler`

```go
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}
```

The entire Go HTTP ecosystem is built on this single interface. Middleware, routers, and handlers all implement `ServeHTTP`:

```go
type HealthHandler struct{}

func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"ok"}`))
}
```

### `error`

```go
type error interface {
    Error() string
}
```

The error interface is covered in depth on [page 07](./07-error-handling.md). For now, note that it is a single-method interface — anything that returns a human-readable error message is an error.

## Interface values

An interface value is represented as a **two-word pair**:

1. The **concrete type** (called the *dynamic type*).
2. The **concrete value** (called the *dynamic value*).

```go
var s fmt.Stringer = User{Name: "Alice"}
// s = (type: User, value: User{Name: "Alice"})
```

### Nil interface vs nil concrete

This distinction matters when checking for nil:

```go
func returnsNilPtr() *User {
    return nil
}

func returnsNilInterface() fmt.Stringer {
    return nil
}

var s1 fmt.Stringer = returnsNilPtr()
fmt.Println(s1 == nil) // false — interface has type *User, value nil

var s2 fmt.Stringer = returnsNilInterface()
fmt.Println(s2 == nil) // true — interface has type nil, value nil
```

A nil pointer stored in an interface makes the interface non-nil. This is a common source of bugs in Go — always be explicit about returning nil interfaces:

```go
func FindUser(id int) (fmt.Stringer, error) {
    if id < 0 {
        return nil, errors.New("invalid id")
    }
    return &User{Name: "Alice"}, nil
}
```

## Interface satisfaction with pointer receivers

A type's method set includes both value and pointer receiver methods, but whether it satisfies an interface depends on the method set of the value vs pointer type:

```go
type Counter struct {
    Value int
}

func (c *Counter) Increment() { c.Value++ }

type Incrementer interface {
    Increment()
}

var inc Incrementer

inc = &Counter{} // OK — *Counter has Increment
// inc = Counter{} // compile error — Counter does NOT have Increment
```

The rule: if an interface method uses a pointer receiver, only a pointer to the type satisfies the interface. If it uses value receivers, both the value type and the pointer type satisfy it.

This is why most Go code defines methods on pointer receivers for types that are intended to be passed through interfaces — it makes the interface contract unambiguous.

## Interface cohesion

**"The bigger the interface, the weaker the abstraction."** — Go proverb

Small interfaces are more useful because they apply to more types. The standard library is built on 1-2 method interfaces:

| Interface | Methods | Used by |
|-----------|---------|---------|
| `io.Reader` | 1 | Files, networks, buffers, gzip, TLS, HTTP body |
| `io.Writer` | 1 | Files, networks, buffers, HTTP response |
| `fmt.Stringer` | 1 | Any type for formatted output |
| `http.Handler` | 1 | Every HTTP handler and middleware |
| `error` | 1 | Every error value |

When designing interfaces, start with the smallest possible surface area:

```go
// Prefer this:
type Storer interface {
    Get(id string) (Item, error)
}

// Over this:
type Storer interface {
    Get(id string) (Item, error)
    Save(item Item) error
    Delete(id string) error
    List() ([]Item, error)
}
```

You can always compose small interfaces into larger ones:

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Closer interface {
    Close() error
}

type ReadCloser interface {
    Reader
    Closer
}
```

### Accept interfaces, return structs

A common Go pattern: functions accept interfaces and return concrete types. Accepting interfaces makes the function flexible (any caller that satisfies the interface can supply the argument). Returning structs avoids coupling the caller to your interface.

```go
// Accept interface
func Process(r io.Reader) error {
    data, _ := io.ReadAll(r)
    return processData(data)
}

// Return concrete type
func NewProcessor() *Processor {
    return &Processor{buf: new(bytes.Buffer)}
}
```

## Links to existing tiers

The [Beginner tier](../beginner/) implements `http.Handler` for the todo app's route handling. The [Intermediate tier](../intermediate/) defines a `Store` interface for the CRUD layer and uses `io.Reader`/`io.Writer` for file uploads. The [Advanced tier](../advanced/) builds JWT authentication middleware using `http.Handler` — see how interfaces make middleware composable. The structs with pointer receivers from page 04 are how those interface contracts are fulfilled — every interface in your Go code depends on understanding which methods a type exposes and which receiver form it uses.

---

**Next:** [06 Generics](./06-generics.md)
