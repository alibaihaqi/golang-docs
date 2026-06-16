---
title: Slices
tier: beginner
platform: golang
position: 7
---

# Slices

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Slices

**Goal**

Hold an ordered list of values. After this page you will have the `[]Item` the endpoint returns.

**Prerequisites**

- [Structs](./06-structs.md)

## Slice vs array

Go has two list-like types. An **array** has a fixed length baked into its type — `[3]int` is different from `[4]int`. A **slice** is a view over an array, with variable length. You almost always want a slice.

Write a slice type as `[]T` — for example, `[]int`, `[]string`, `[]Item`.

For everything slices can do, see the [Go blog post on slices](https://go.dev/blog/slices-intro). The two operations we need now are slice-literal construction and `append`.

## Code

```go
package main

import "fmt"

type Item struct {
	ID    int
	Name  string
	Price float64
}

func main() {
	// Slice literal — three items, length 3.
	items := []Item{
		{ID: 1, Name: "Notebook", Price: 4.0},
		{ID: 2, Name: "Pen", Price: 2.5},
		{ID: 3, Name: "Sticker pack", Price: 5.0},
	}

	fmt.Println("count:", len(items))

	for _, item := range items {
		fmt.Printf("%d %s $%.2f\n", item.ID, item.Name, item.Price)
	}

	// Append a fourth item — append returns a new slice.
	items = append(items, Item{ID: 4, Name: "Eraser", Price: 1.0})
	fmt.Println("count after append:", len(items))
}
```

Run it:

```
go run main.go
```

Output:

```
count: 3
1 Notebook $4.00
2 Pen $2.50
3 Sticker pack $5.00
count after append: 4
```

`len` returns the current length. `append` returns a new slice — you must reassign the result, even when you use the same variable name.

**For frontend developers**

A slice is the closest Go has to a JS array. The big difference: a slice's element type is fixed at compile time. `[]Item` only holds `Item` values, never strings.

**Next** → [Hello HTTP](./08-hello-http.md)
