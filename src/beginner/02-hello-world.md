---
title: Hello world
tier: beginner
platform: golang
position: 2
---

# Hello world

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Hello world

**Goal**

Write and run your first Go program. After this page you will have confirmed the toolchain works on your machine and you'll know the shape of every Go source file.

**Prerequisites**

- [Go installed](./01-install-go.md)

## The shape of a Go file

Every runnable Go program has three pieces in this order:

1. A `package main` line — the package this file belongs to. `main` is the special name for an executable.
2. `import` block — the standard library and third-party packages this file uses.
3. A `func main()` — the entry point. The program starts here and exits when it returns.

`fmt` is the standard library's text formatter. `fmt.Println` writes a line to standard output.

## Code

Create a folder for this tier, then a file called `main.go`:

```go
package main

import "fmt"

func main() {
	fmt.Println("hello, Mei")
}
```

Run it:

```
go run main.go
```

Output:

```
hello, Mei
```

`go run` compiles the file to a temporary binary, runs it, and discards the binary. For a permanent build, use `go build`.

**Next** → [Types and variables](./03-types-and-variables.md)
