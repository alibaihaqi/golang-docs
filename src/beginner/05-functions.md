---
title: Functions
tier: beginner
platform: golang
position: 5
---

# Functions

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Functions

**Goal**

Write a function with typed parameters and a typed return. After this page you will read and write the handler functions the HTTP pages require.

**Prerequisites**

- [Control flow](./04-control-flow.md)

## Shape of a Go function

```
func name(param1 Type1, param2 Type2) ReturnType { ... }
```

Two things to notice. The parameter type comes after the name. The return type sits after the parameter list, not before the function name.

Functions can return more than one value. Go's standard error-handling pattern uses this: a function returns `(result, error)`, and the caller checks the error.

## Code

```go
package main

import "fmt"

// One parameter, one return value.
func double(n int) int {
	return n * 2
}

// Two return values — the classic Go pattern.
func divide(a, b int) (int, error) {
	if b == 0 {
		return 0, fmt.Errorf("divide by zero")
	}
	return a / b, nil
}

func main() {
	fmt.Println(double(7))

	result, err := divide(10, 2)
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	fmt.Println("10 / 2 =", result)

	_, err = divide(10, 0)
	if err != nil {
		fmt.Println("error:", err)
	}
}
```

Run it:

```
go run main.go
```

Output:

```
14
10 / 2 = 2
error: divide by zero
```

`error` is a built-in type — an interface with one method. For now treat it as "something that prints a message". `nil` is the zero value — "no error here".

**For frontend developers**

In JavaScript an async function returns a `Promise` that resolves or rejects. Go uses an explicit `(value, error)` pair instead. The caller branches on the error every time — there is no `try/catch`.

**Next** → [Structs](./06-structs.md)
