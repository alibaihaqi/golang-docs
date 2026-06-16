---
title: Structs
tier: beginner
platform: golang
position: 6
---

# Structs

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Structs

**Goal**

Define a custom type with named fields. After this page you will have the `Item` type the JSON endpoint returns.

**Prerequisites**

- [Functions](./05-functions.md)

## What a struct is

A struct is a named bundle of fields. Each field has a name and a type. Once defined, you create values of the struct type and access fields with `.`.

Two rules worth knowing now:

- A field name that starts with an uppercase letter is **exported** — visible outside its package. Lowercase is package-private. The `encoding/json` package only sees exported fields, so JSON-bound structs use uppercase field names.
- Field tags in backticks (the `` `json:"id"` `` part below) tell other packages how to handle the field. The JSON package reads these to pick output key names.

## Code

```go
package main

import "fmt"

type Item struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

func main() {
	pen := Item{
		ID:    1,
		Name:  "Pen",
		Price: 2.5,
	}

	fmt.Println(pen)
	fmt.Println("name:", pen.Name)

	// Mutate a field.
	pen.Price = 3.0
	fmt.Println("new price:", pen.Price)
}
```

Run it:

```
go run main.go
```

Output:

```
{1 Pen 2.5}
name: Pen
new price: 3
```

The `json:"..."` tags don't do anything in this file — they sit dormant until the JSON encoder reads them. We wire them up two pages from now.

**Next** → [Slices](./07-slices.md)
