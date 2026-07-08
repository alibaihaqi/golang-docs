---
title: Control flow and functions
tier: go-language
platform: golang
---

# Control flow and functions

[Go Language](./index.md) › 03 Control flow and functions

## If with statement

Go's `if` statement can include a short declaration before the condition. The declared variables are scoped to the `if` block and any attached `else` block.

```go
if err := doSomething(); err != nil {
    // err is in scope here
    return fmt.Errorf("something failed: %w", err)
} else {
    // err is also in scope here
    fmt.Println("success:", err) // err is nil
}
// err is NOT in scope here — compile error
```

This pattern is idiomatic for error handling. It keeps error variables local to the branch where they are relevant and avoids accidental use outside the error handling context.

The condition must be a boolean expression — Go does not coerce non-boolean values:

```go
x := 1
// if x { }           // compile error: non-bool x used as condition
if x != 0 { }         // correct
```

## For is the only loop

Go has a single looping construct: `for`. It covers all iteration patterns.

### Classic three-part for

```go
for i := 0; i < 10; i++ {
    fmt.Println(i)
}
```

The three parts (init, condition, post) are optional. Parentheses are never used. Braces are required even for single-line bodies.

### For-range

`for range` iterates over slices, arrays, maps, strings, and channels.

```go
// Slices and arrays
items := []string{"a", "b", "c"}
for i, v := range items {
    fmt.Println(i, v) // index and value
}
for _, v := range items {
    fmt.Println(v) // value only (skip index)
}
for i := range items {
    fmt.Println(i) // index only
}

// Maps
m := map[string]int{"a": 1, "b": 2}
for k, v := range m {
    fmt.Println(k, v)
}

// Channels — iterates until close
for v := range ch {
    fmt.Println(v)
}
```

The iteration order over maps is intentionally non-deterministic in Go. Do not rely on map iteration order — it changes between runs and between versions.

### While-like for

```go
n := 10
for n > 0 {
    n--
    fmt.Println(n)
}
```

### Infinite loop

```go
for {
    // runs forever until break or return
}
```

### Break and continue

`break` exits the innermost loop. `continue` skips to the next iteration. Both can target a labelled outer loop:

```go
outer:
for i := 0; i < 3; i++ {
    for j := 0; j < 3; j++ {
        if i == 1 && j == 1 {
            break outer   // exits both loops
        }
        fmt.Printf("(%d,%d) ", i, j)
    }
}
// Output: (0,0) (0,1) (0,2) (1,0)
```

## Switch without break

Go's `switch` automatically breaks after each case — no `break` statement needed. The `fallthrough` keyword is explicit when you want cascade behaviour.

```go
// Automatic break — no fallthrough by default
x := 2
switch x {
case 1:
    fmt.Println("one")
case 2:
    fmt.Println("two")
case 3:
    fmt.Println("three")
default:
    fmt.Println("other")
}
// Output: two
```

### Explicit fallthrough

```go
switch x {
case 1:
    fmt.Println("one")
    fallthrough
case 2:
    fmt.Println("two — also reached from case 1")
}
```

### Switch on any comparable type

Unlike C, Go's switch works on any comparable type — strings, structs, pointers, and interfaces:

```go
name := "Alice"
switch name {
case "Alice":
    fmt.Println("found Alice")
case "Bob":
    fmt.Println("found Bob")
}

// Empty switch — like if-else chain
score := 85
switch {
case score >= 90:
    grade = "A"
case score >= 80:
    grade = "B"
case score >= 70:
    grade = "C"
default:
    grade = "D"
}
```

### Type switch

A type switch dispatches on the concrete type stored in an interface:

```go
var x interface{} = 42
switch v := x.(type) {
case int:
    fmt.Println("int:", v*2) // v is int
case string:
    fmt.Println("string:", len(v)) // v is string
case nil:
    fmt.Println("nil")
default:
    fmt.Println("unknown type")
}
```

The variable `v` in each case is automatically typed to the matched type — no manual type assertion needed.

## Defer

`defer` pushes a function call onto a stack. The deferred call executes when the surrounding function returns, in last-in-first-out order.

```go
func readFile(path string) error {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer f.Close() // runs when readFile returns

    // Use f...
    return nil
}
```

### Arguments are evaluated immediately

A deferred function's arguments are evaluated at the point of the \`defer\` statement, not when the deferred call executes.

```go
func printCount() {
    i := 0
    defer fmt.Println(i) // prints 0, not 1
    i++
}
```

To capture the current value at the time of return, use a closure:

```go
func printCount() {
    i := 0
    defer func() {
        fmt.Println(i) // prints 1 (closure captures i)
    }()
    i++
}
```

### Common defer uses

\`\`\`go
// Unlocking mutex
mu.Lock()
defer mu.Unlock()

// Timing
defer func(start time.Time) {
    fmt.Println("elapsed:", time.Since(start))
}(time.Now())
```

## Panic and recover

A `panic` unwinds the call stack, running deferred functions along the way, until the program terminates. `recover()` in a deferred function can catch the panic and prevent termination.

```go
func mightPanic() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("recovered from:", r)
        }
    }()
    panic("something went wrong")
    // This line never executes
}
```

Panic is not the Go equivalent of exceptions. Go's philosophy is to return errors from functions and handle them explicitly. Panic is reserved for truly unrecoverable situations — programmer errors like nil pointer dereferences, index out of bounds, or assertion failures.

```go
// panics: index out of range (a programmer error)
s := []int{1, 2, 3}
_ = s[5]
```

Panic is appropriate for unrecoverable situations: initialisation failures that make the program impossible to run, impossible code paths, and exposing bugs during development. Regular error handling, input validation failures, and network or filesystem errors should return errors instead of panicking.

## Functions as values

Go functions are first-class values. They can be assigned to variables, passed as arguments, and returned from other functions.

```go
var fn func(int) int
fn = func(x int) int { return x * 2 }
fmt.Println(fn(3)) // 6
```

### Anonymous functions and closures

A closure is an anonymous function that captures variables from its surrounding scope.

\`\`\`go
// Closure
counter := func() func() int {
    i := 0
    return func() int {
        i++
        return i
    }
}
c := counter()
fmt.Println(c()) // 1
fmt.Println(c()) // 2
fmt.Println(c()) // 3
```

Closures capture variables by **reference**, not by value. This is important when creating closures in a loop:

```go
// BUG: all closures capture the same loop variable
var funcs []func()
for i := 0; i < 3; i++ {
    funcs = append(funcs, func() { fmt.Println(i) })
}
for _, f := range funcs {
    f() // prints 3, 3, 3 (i is 3 after loop)
}

// FIX: shadow the variable
for i := 0; i < 3; i++ {
    i := i // create a new copy of i for each iteration
    funcs = append(funcs, func() { fmt.Println(i) })
}
for _, f := range funcs {
    f() // prints 0, 1, 2
}
```

In Go 1.22+, loop variables are properly scoped per iteration for `for range` loops, but the classic three-part `for` loop still has the old behaviour.

## Variadic parameters

A function can accept a variable number of arguments of the same type by using `...`:

```go
func sum(nums ...int) int {
    total := 0
    for _, n := range nums {
        total += n
    }
    return total
}

fmt.Println(sum(1, 2, 3))    // 6
fmt.Println(sum(1, 2, 3, 4)) // 10
fmt.Println(sum())           // 0

// Pass a slice with ...
nums := []int{1, 2, 3}
fmt.Println(sum(nums...))    // 6
```

The variadic parameter is a slice inside the function. You can have at most one variadic parameter, and it must be the last parameter. The standard library uses this pattern extensively — \`fmt.Printf\`, \`append\`, and the \`log\` package all take variadic arguments.

## Named returns

Go functions can name their return values. A bare `return` returns the current values of the named return variables.

```go
func split(sum int) (x, y int) {
    x = sum * 4 / 9
    y = sum - x
    return // bare return — returns x, y
}
```

Named returns serve as documentation and can reduce repetition in error handling:

```go
func readConfig(path string) (cfg Config, err error) {
    f, err := os.Open(path)
    if err != nil {
        return // returns zero Config and the error
    }
    defer f.Close()

    decoder := json.NewDecoder(f)
    err = decoder.Decode(&cfg)
    if err != nil {
        return // returns partially-filled Config and the error
    }
    return // returns populated cfg and nil
}
```

### Rules for named returns

1. Names must be unique within the function signature.
2. A bare `return` returns the named values — use only in short functions.
3. Named returns are initialised to their zero values.
4. You can still use explicit return values with named returns — `return nil, fmt.Errorf("...")` works fine.
5. Use named returns sparingly. They make function signatures harder to read when overused.

## Links to existing tiers

The [Beginner tier](../beginner/) uses `net/http.HandlerFunc` — a function type with signature `func(http.ResponseWriter, *http.Request)`. The `http.HandleFunc` method takes a function as a value, and the `Handler` interface has a single method `ServeHTTP`. All of this builds on Go's treatment of functions as first-class values, closures for request scoping, and `defer` for resource cleanup.

The [Intermediate tier](../intermediate/) uses `defer` for closing the SQLite database and `httptest` handlers that are closures bound to the test state. The variadic pattern also shows up in log formatting and test case definitions.

---

**Next:** [04 Structs and methods](./04-structs-and-methods.md)
