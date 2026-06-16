---
title: Types and variables
tier: beginner
platform: golang
position: 3
---

# Types and variables

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Types and variables

**Goal**

Declare values and know their types. After this page you will read every variable declaration you meet in the rest of the tier.

**Prerequisites**

- [Hello world](./02-hello-world.md)

## The types you actually need now

Go is statically typed — every value has a type fixed at compile time. The standard library is large, but the ladder needs five categories:

- `int` — whole numbers, sized to your CPU (32 or 64 bit). Use this unless you have a specific reason not to.
- `float64` — decimal numbers.
- `bool` — `true` or `false`.
- `string` — text, UTF-8 internally, immutable.
- Composite types — `struct`, slice, map. We meet structs and slices later in the ladder.

For the full list of numeric widths (`int8`, `int16`, `uint32`, etc.), see the [Go spec on numeric types](https://go.dev/ref/spec#Numeric_types). You won't need them this tier.

## Three ways to declare a variable

```go
package main

import "fmt"

func main() {
	// 1. Short declaration — type inferred from the value.
	count := 3

	// 2. Explicit type — useful when the inferred type isn't what you want.
	var price float64 = 4.5

	// 3. Multiple variables at once.
	var first, last = "Aarav", "Patel"

	fmt.Println(count, price, first, last)
}
```

Run it:

```
go run main.go
```

Output:

```
3 4.5 Aarav Patel
```

`:=` is short declaration. It only works inside a function. At package level, use `var`.

**For frontend developers**

`:=` is roughly `const` with type inference — except Go variables are reassignable by default. `var x = 1` is closer to `let x = 1` in JS.

**Next** → [Control flow](./04-control-flow.md)
