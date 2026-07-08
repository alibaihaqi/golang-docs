---
title: Generics
tier: go-language
platform: golang
---

# Generics

[Go Language](./index.md) › 06 Generics

## Type parameters

Generics (type parameters) were introduced in Go 1.18. They let you write functions and types that work with any type while preserving type safety — no type assertions, no `any`, no runtime checks.

```go
func Map[T any](items []T, fn func(T) T) []T {
    result := make([]T, len(items))
    for i, item := range items {
        result[i] = fn(item)
    }
    return result
}

// Usage:
doubled := Map([]int{1, 2, 3}, func(n int) int { return n * 2 })
// doubled is []int{2, 4, 6}

uppers := Map([]string{"a", "b"}, func(s string) string { return strings.ToUpper(s) })
// uppers is []string{"A", "B"}
```

The type parameter `T` is declared in square brackets before the function's regular parameters. The compiler infers `T` from the arguments — you rarely need to specify it explicitly.

### Multiple type parameters

```go
func Zip[T, U any](a []T, b []U) []struct{ First T; Second U } {
    result := make([]struct{ First T; Second U }, min(len(a), len(b)))
    for i := range result {
        result[i] = struct{ First T; Second U }{a[i], b[i]}
    }
    return result
}
```

## Constraints

A constraint specifies what operations a type parameter must support. The constraint appears after the type parameter name.

### `any`

The `any` constraint (alias for `interface{}`) places no restriction. You can store and return values of type `T`, but you cannot compare them or perform arithmetic:

```go
func Identity[T any](v T) T { return v }
```

### `comparable`

The `comparable` constraint allows `==` and `!=`:

```go
func Contains[T comparable](items []T, target T) bool {
    for _, item := range items {
        if item == target {
            return true
        }
    }
    return false
}

fmt.Println(Contains([]int{1, 2, 3}, 2)) // true
fmt.Println(Contains([]string{"a", "b"}, "c")) // false
```

### Custom constraints

A custom constraint is an interface type that can include type elements — specific types or underlying types:

```go
type Number interface {
    ~int | ~int64 | ~float64
}
```

This constraint accepts `int`, `int64`, `float64`, and any type whose **underlying type** is one of those (because of the `~` operator).

```go
func Sum[T Number](nums []T) T {
    var total T
    for _, n := range nums {
        total += n
    }
    return total
}
```

## The `~` tilde operator

The tilde operator tells the compiler to accept any type whose **underlying type** matches, not just the exact type:

```go
type MyInt int

type Exact interface {
    int
}

type Underlying interface {
    ~int
}

func AcceptExact[T Exact](v T) T     { return v }
func AcceptUnderlying[T Underlying](v T) T { return v }

var x MyInt = 5
// AcceptExact(x) // compile error: MyInt does not satisfy Exact
AcceptUnderlying(x) // OK: MyInt's underlying type is int
```

Without `~`, the constraint only matches the literal type. With `~`, it matches any type that has the specified underlying type. Use `~` when your constraint needs to work with derived types like `type Celsius float64` or `type UserID int64`.

## Generic types

Type parameters are not limited to functions — you can define generic structs, interfaces, and other types:

```go
type Stack[T any] struct {
    items []T
}

func (s *Stack[T]) Push(item T) {
    s.items = append(s.items, item)
}

func (s *Stack[T]) Pop() (T, bool) {
    if len(s.items) == 0 {
        var zero T
        return zero, false
    }
    item := s.items[len(s.items)-1]
    s.items = s.items[:len(s.items)-1]
    return item, true
}

func (s *Stack[T]) Peek() (T, bool) {
    if len(s.items) == 0 {
        var zero T
        return zero, false
    }
    return s.items[len(s.items)-1], true
}

func (s *Stack[T]) IsEmpty() bool {
    return len(s.items) == 0
}
```

Usage:

```go
s := Stack[string]{}
s.Push("hello")
s.Push("world")

val, ok := s.Pop()
fmt.Println(val, ok) // "world", true
```

Note that methods of a generic type redeclare the type parameter after the receiver — `func (s *Stack[T])`. The type parameter must be listed even though it is the same as the struct's parameter.

### Generic cache

```go
type Cache[K comparable, V any] struct {
    data map[K]V
    mu   sync.RWMutex
}

func NewCache[K comparable, V any]() *Cache[K, V] {
    return &Cache[K, V]{data: make(map[K]V)}
}

func (c *Cache[K, V]) Get(key K) (V, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    v, ok := c.data[key]
    return v, ok
}

func (c *Cache[K, V]) Set(key K, value V) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.data[key] = value
}
```

Usage:

```go
cache := NewCache[string, *User]()
cache.Set("user:1", &User{Name: "Alice"})
user, ok := cache.Get("user:1")
```

## Generic functions: Map, Filter, Reduce

These are the classic functional programming primitives expressed with Go generics:

```go
func Map[T, U any](items []T, fn func(T) U) []U {
    result := make([]U, len(items))
    for i, item := range items {
        result[i] = fn(item)
    }
    return result
}

func Filter[T any](items []T, fn func(T) bool) []T {
    var result []T
    for _, item := range items {
        if fn(item) {
            result = append(result, item)
        }
    }
    return result
}

func Reduce[T, U any](items []T, initial U, fn func(U, T) U) U {
    result := initial
    for _, item := range items {
        result = fn(result, item)
    }
    return result
}
```

Usage:

```go
nums := []int{1, 2, 3, 4, 5}

doubled := Map(nums, func(n int) int { return n * 2 })
// []int{2, 4, 6, 8, 10}

evens := Filter(nums, func(n int) bool { return n%2 == 0 })
// []int{2, 4}

sum := Reduce(nums, 0, func(acc, n int) int { return acc + n })
// 15
```

These functions are type-safe — the compiler catches mismatches at compile time rather than requiring runtime type assertions.

## Generic interfaces

Interfaces can also have type parameters:

```go
type Storer[T any] interface {
    Get(id string) (T, error)
    Save(id string, value T) error
    Delete(id string) error
}

type MemoryStorer[T any] struct {
    data map[string]T
}

func (s *MemoryStorer[T]) Get(id string) (T, error) {
    v, ok := s.data[id]
    if !ok {
        var zero T
        return zero, fmt.Errorf("not found: %s", id)
    }
    return v, nil
}

func (s *MemoryStorer[T]) Save(id string, value T) error {
    s.data[id] = value
    return nil
}

func (s *MemoryStorer[T]) Delete(id string) error {
    delete(s.data, id)
    return nil
}
```

## Type inference limitations

Go's type inference is powerful but has limits:

```go
func Convert[T, U any](v T) U { /* ... */ }

// Must specify type arguments when return type cannot be inferred:
result := Convert[int, string](42)
```

Generic functions that only use type parameters in return positions require explicit type arguments. This is uncommon but worth knowing.

Inference works left-to-right across the type parameter list, so ordering matters:

```go
// Prefer this — T can be inferred from items, U from fn:
func Map[T, U any](items []T, fn func(T) U) []U

// Avoid this — fn's T will not be inferred from items:
func Map2[U, T any](items []T, fn func(T) U) []U
```

## When NOT to use generics

Generics add syntactic noise and sometimes obscure the logic. They are not always the right tool.

### 1. When you would type-switch anyway

```go
// Avoid — generics add no value here
func Process[T any](v T) {
    switch any(v).(type) {
    case int: /* ... */
    case string: /* ... */
    }
}

// Prefer — explicit is clearer
func Process(v any) {
    switch v.(type) {
    case int: /* ... */
    case string: /* ... */
    }
}
```

### 2. When different types need different behaviour

Generics enforce uniform handling. If `int` and `string` should be processed differently, generics add complexity without benefit.

### 3. When readability suffers

```go
// Overly generic
func Transform[A, B, C any](a []A, fn1 func(A) B, fn2 func(B) C) []C

// Clearer — concrete types document the data flow
func Transform(input []int, format func(int) string, parse func(string) bool) []bool
```

### 4. Start specific, generalise at pattern 3+

The pragmatic rule: write the concrete version first. When you see the same logic for three or more types, introduce generics. Premature generics add complexity that is rarely repaid.

```go
// Step 1: specific
func SumInts(nums []int) int64 { /* ... */ }
func SumFloats(nums []float64) float64 { /* ... */ }

// Step 2: generic (only once you have 3+ versions)
func Sum[T Number](nums []T) T { /* ... */ }
```

## Generics vs interfaces

Generics and interfaces solve different problems:

| Generics | Interfaces |
|----------|------------|
| Same behaviour for different types | Different behaviours for same method set |
| Compile-time type safety | Runtime dispatch |
| Each instantiation is a separate function | Single function handles many types |
| Works with non-method operations (`+`, `==`) | Only works with methods |

They complement each other. A generic function can accept an interface constraint:

```go
func Process[T fmt.Stringer](items []T) []string {
    result := make([]string, len(items))
    for i, item := range items {
        result[i] = item.String()
    }
    return result
}
```

## Links to existing tiers

The [Intermediate tier](../intermediate/) store layer uses concrete types per entity rather than generics. A generic `Storer[T]` would reduce boilerplate but at the cost of making the code harder to follow — a deliberate trade-off that prioritises readability over conciseness for a learning codebase. As you build production systems, you can introduce generics where the pattern genuinely repeats.

---

**Next:** [07 Error handling](./07-error-handling.md)
