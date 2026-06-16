---
title: Control flow
tier: beginner
platform: golang
position: 4
---

# Control flow

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Control flow

**Goal**

Branch and loop in Go. After this page you will recognise every `if` and `for` you meet later in the tier.

**Prerequisites**

- [Types and variables](./03-types-and-variables.md)

## `if` and `for` are the whole thing

Go has two control-flow keywords you need now: `if` and `for`. There is no `while`, no `do…while`. The `for` keyword covers every loop shape.

- `if` — a boolean condition with no surrounding parentheses.
- `for init; cond; post` — the classic three-clause loop.
- `for cond` — the same `for`, used as a `while`.
- `for index, value := range slice` — iterate a slice, map, or string.

## Code

```go
package main

import "fmt"

func main() {
	// if
	age := 21
	if age >= 18 {
		fmt.Println("adult")
	} else {
		fmt.Println("minor")
	}

	// classic for
	sum := 0
	for i := 1; i <= 5; i++ {
		sum += i
	}
	fmt.Println("sum 1..5:", sum)

	// for as while
	n := 1
	for n < 16 {
		n *= 2
	}
	fmt.Println("doubled past 16:", n)

	// for-range over a slice
	prices := []int{4, 2, 5}
	for index, price := range prices {
		fmt.Printf("item %d costs %d\n", index, price)
	}
}
```

Run it:

```
go run main.go
```

Output:

```
adult
sum 1..5: 15
doubled past 16: 16
item 0 costs 4
item 1 costs 2
item 2 costs 5
```

The `_` blank identifier discards a value. Write `for _, price := range prices` when you don't need the index.

**Next** → [Functions](./05-functions.md)
