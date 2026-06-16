---
title: JSON encoding
tier: beginner
platform: golang
position: 9
---

# JSON encoding

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › JSON encoding

**Goal**

Turn a Go value into a JSON byte stream. After this page you will know how `encoding/json` reads the struct tags from the Structs page and emits the right keys.

**Prerequisites**

- [Structs](./06-structs.md)
- [Slices](./07-slices.md)

## What `encoding/json` does

The standard library ships `encoding/json` — a package that walks any value and emits JSON. The walk follows three rules:

1. Only exported fields (uppercase first letter) are written.
2. The output key comes from the `json:"name"` field tag if present; otherwise it's the field name verbatim.
3. The encoder writes bytes — you pass it a `Writer` (a file, an HTTP response, a buffer) and it writes into that.

For the full set of options (omitempty, custom marshalers, indentation), see the [`encoding/json` package docs](https://pkg.go.dev/encoding/json). For now we use one function: `json.NewEncoder(w).Encode(v)`.

## Code

```go
package main

import (
	"encoding/json"
	"log"
	"os"
)

type Item struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

func main() {
	items := []Item{
		{ID: 1, Name: "Notebook", Price: 4.0},
		{ID: 2, Name: "Pen", Price: 2.5},
	}

	// os.Stdout is a Writer — anything that satisfies io.Writer works here.
	if err := json.NewEncoder(os.Stdout).Encode(items); err != nil {
		log.Fatal(err)
	}
}
```

Run it:

```
go run main.go
```

Output:

```
[{"id":1,"name":"Notebook","price":4},{"id":2,"name":"Pen","price":2.5}]
```

Notice the keys are lowercase — the encoder followed the `json:"id"` tags. Drop the tags and the keys come back as `ID`, `Name`, `Price`.

The same `json.NewEncoder` works against an HTTP `ResponseWriter`, because `ResponseWriter` is also a `Writer`. That's the bridge we use on the next page.

**Next** → [Serving JSON](./10-serving-json.md)
