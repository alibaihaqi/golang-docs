---
title: Types and constants
tier: go-language
platform: golang
---

# Types and constants

[Go Language](./index.md) › 02 Types and constants

## Built-in types

Go's type system is small but complete. Every value has a type, and the compiler enforces type compatibility at compile time.

### Booleans

```go
var ready bool = true
var done bool = false
```

A `bool` is either `true` or `false`. The zero value is `false`.

### Numeric types

Go provides signed integers, unsigned integers, floats, and complex numbers at multiple widths.

```go
var a int     // platform-dependent: 32 or 64 bits
var b int8    // -128 to 127
var c int16   // -32768 to 32767
var d int32   // -2^31 to 2^31-1
var e int64   // -2^63 to 2^63-1

var u uint    // platform-dependent
var v uint8   // 0 to 255
var w uint16  // 0 to 65535
var x uint32  // 0 to 2^32-1
var y uint64  // 0 to 2^64-1

var p uintptr // unsigned integer large enough to hold any pointer

var f float32 // ~6 decimal digits of precision
var g float64 // ~15 decimal digits of precision

var c1 complex64   // real + imag float32
var c2 complex128  // real + imag float64
```

The \`int\` and \`uint\` types are platform-dependent — 32 bits on 32-bit architectures, 64 bits on 64-bit architectures. \`uintptr\` is an unsigned integer type large enough to hold any pointer value; it is used primarily in unsafe memory operations and syscall interfaces. Use specific-width types when serialising wire formats or controlling memory layout.

### Strings

Strings are immutable byte sequences. The `string` type has no internal encoding requirement — it can hold arbitrary bytes. By convention, Go source code is UTF-8, and the `range` loop over a string decodes UTF-8 runes.

```go
var s string = "hello"
t := "world"
u := "hello\n" +
    "world"

// len counts bytes, not runes
fmt.Println(len("élite")) // 6 bytes (é is 2 bytes)
```

### Byte and rune aliases

```go
type byte = uint8
type rune = int32
```

- `byte` is an alias for `uint8`. It signals that the value is raw data rather than a numeric quantity.
- `rune` is an alias for `int32`. It holds a single Unicode code point.

```go
var b byte = 'a'        // byte literal (ASCII)
var r rune = 'é'        // rune literal (multi-byte)
var r2 rune = '\u2764'  // ❤ — heart emoji code point
```

### Zero values

Every type in Go has a zero value — the default value variables hold when no explicit value is assigned. There is no concept of an uninitialised variable.

```go
var i int       // 0
var f float64   // 0
var b bool      // false
var s string    // "" (empty string)
var p *int      // nil
var sl []int    // nil
var m map[int]string // nil
var c chan int  // nil
var iface interface{} // nil
var fn func()   // nil
```

This eliminates an entire class of bugs common in C and C++ where variables may be used before initialisation. It also means every struct field, array element, and map value is always defined.

```go
var arr [3]int      // [0 0 0]
var st struct { x int; y string }  // {0, ""}
```

## Type inference with `:=`

Go supports short variable declaration with type inference. The compiler deduces the type from the right-hand side expression.

```go
x := 42      // int
y := 3.14    // float64
z := "hello" // string
```

The inferred types follow Go's literal rules:
- Integer literals default to `int`.
- Float literals default to `float64`.
- Complex literals default to `complex128`.
- Rune literals default to `rune` (which is `int32`).
- String literals default to `string`.

When you need a specific type, use explicit `var`:

```go
var x int8 = 42           // explicit width
var y float32 = 3.14      // explicit width
var s string = "hello"    // unnecessary but explicit

// Also valid:
x := int8(42)
y := float32(3.14)
```

The `:=` syntax is only available inside functions. Package-level declarations always use `var` or `const`.

```go
var version = "1.0"   // package level — OK
// version := "1.0"   // compile error: non-declaration statement outside function body
```

### Multiple variables in one line

```go
a, b := 1, "two"           // a is int, b is string
var x, y int = 1, 2         // both int
```

The `:=` operator can redeclare a variable as long as at least one variable on the left is new:

```go
x, err := doSomething()     // x and err are new
y, err := doSomethingElse() // err is reused, y is new — OK
```

### Blank identifier

The blank identifier `_` discards values you do not need:

```go
_, err := doSomething()     // ignore the first return value
```

## `const` and `iota`

Constants in Go are compile-time values — they must be known at compile time, and they can only hold strings, booleans, or numbers.

```go
const Pi = 3.14159
const Greeting = "Hello"
const Debug = true
```

Constants are untyped by default. They get a type only when used in a typed context:

```go
const Pi = 3.14159
var x float64 = Pi         // Pi takes type float64 here
var y float32 = float32(Pi) // explicit conversion needed: Pi is not float32
```

### Iota

`iota` is a predeclared identifier that represents successive integer constants within a `const` block. It resets to 0 for each new `const` block and increments by 1 for each line.

```go
const (
    StatusOK = iota  // 0
    StatusNotFound   // 1
    StatusError      // 2
)
```

#### Bitmask flags with iota

```go
const (
    Read  = 1 << iota  // 1
    Write              // 2
    Execute            // 4
)
```

#### Skip a value with `_`

```go
const (
    A = iota  // 0
    _         // 1 (discarded)
    B         // 2
)
```

#### String mapping pattern

The standard pattern for `iota`-based enums with string representation is a `String()` method:

```go
type Weekday int

const (
    Sunday Weekday = iota
    Monday
    Tuesday
    Wednesday
    Thursday
    Friday
    Saturday
)

func (d Weekday) String() string {
    return [...]string{
        "Sunday", "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday",
    }[d]
}
```

## Type conversion

Go requires **explicit** conversions between different types. There is no implicit numeric promotion — even converting `int` to `int64` requires a cast.

```go
var i int = 42
var f float64 = float64(i)  // explicit, not (float64)i like C
var u uint = uint(f)        // explicit

// Compile errors — no implicit conversion:
// var f float64 = i       // cannot use i (type int) as float64
// var i2 int32 = i        // cannot use i (type int) as int32
```

This explicitness makes it easy to see where precision loss or overflow might occur:

```go
var big int64 = 1 << 40
var small int32 = int32(big)  // truncation — compiler lets you, but you see it
```

For string conversions:

```go
s := string(65)           // "A" — rune to string, not integer to string
t := strconv.Itoa(65)     // "65" — integer to string (stdlib)
n, _ := strconv.Atoi("42") // 42 — string to integer
```

## Type assertions

Type assertions extract the concrete value from an interface. They are covered in depth on the [Interfaces](./05-interfaces.md) page, but the basic syntax is worth noting:

```go
var x interface{} = "hello"
s := x.(string)                                 // panics if wrong type
s, ok := x.(string)                             // safe — ok is false if wrong type
```

The two-value form with `ok` is the idiomatic approach. It avoids panics and handles the failure case cleanly.

## Type aliases (`type`)

Go allows defining new named types from existing ones. A type alias creates a **distinct** type — not a synonym. Values of the new type cannot be used where the base type is expected without explicit conversion.

```go
type MyInt int        // MyInt is a distinct type from int
type UserID int64     // UserID is a distinct type from int64

var a MyInt = 10
var b int = 20

// b = a         // compile error: cannot use a (type MyInt) as type int
b = int(a)        // explicit conversion required
```

This is one of Go's most powerful features for domain modelling. By creating named types, you make illegal states unrepresentable:

```go
type Celsius float64
type Fahrenheit float64

func BoilingPoint() Celsius { return 100.0 }
func Forecast() Fahrenheit  { return 212.0 }

// A Celsius value cannot accidentaly be passed where Fahrenheit is expected
// without explicit conversion.
```

### Type alias (Go 1.9+)

A separate feature, the type **alias** (using `=`), creates a true synonym — both types are interchangeable:

```go
type MyString = string    // MyString is exactly string, not a new type
var s MyString = "hello"
var t string = s          // OK — they are the same type
```

Type aliases are primarily used for gradual code refactoring. For most purposes, use distinct types (without `=`).

## Composite types

Go provides several composite types built from its primitives.

### Arrays (fixed-size)

```go
var arr [3]int            // [0 0 0]
arr2 := [3]int{1, 2, 3}   // [1 2 3]
arr3 := [...]int{1, 2, 3} // compiler counts: [3]int
```

Arrays are values — assigning an array copies every element. Use slices for references.

### Slices (dynamic arrays)

```go
var s []int               // nil slice, len 0
s = make([]int, 3, 5)     // len 3, cap 5 — [0 0 0]
s2 := []int{1, 2, 3}      // len 3, cap 3
s3 := append(s2, 4)       // [1 2 3 4]
```

Slices are the idiomatic Go list type. Every function that takes a list should take a slice.

### Maps

```go
var m map[string]int       // nil map — cannot write to it
m = make(map[string]int)
m["key"] = 42

m2 := map[string]int{
    "a": 1,
    "b": 2,
}

v, ok := m2["c"]          // 0, false — safe read
delete(m2, "a")           // delete key
```

### Structs

Structs are covered in depth on [Structs and methods](./04-structs-and-methods.md).

## Links to existing tiers

The [Intermediate tier](../intermediate/) uses `int`, `string`, `bool`, and `time.Time` in its `Item` struct definition. The `Store` interface returns slices (`[]Item`). The configuration is a struct loaded from environment variables. Every one of these types is built on the foundation described here — zero values ensure `Item` fields are always defined, explicit conversions prevent accidental type confusion in config parsing, and distinct struct types keep domain boundaries clear.

---

**Next:** [03 Control flow and functions](./03-control-flow-and-functions.md)
