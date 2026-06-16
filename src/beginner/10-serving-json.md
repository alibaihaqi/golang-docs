---
title: Serving JSON
tier: beginner
platform: golang
position: 10
---

# Serving JSON

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Serving JSON

**Goal**

Ship the tier exit artifact — a Go program that serves a fixed list of items as JSON at `GET /items`. After this page you will have a runnable, `curl`-able HTTP endpoint built entirely from the standard library.

**Prerequisites**

- [Hello HTTP](./08-hello-http.md)
- [JSON encoding](./09-json-encoding.md)

## What you're putting together

This page combines two pieces from earlier in the tier:

- `net/http` listens on a port and routes `/items` to your handler.
- `encoding/json` walks the `[]Item` slice and writes it into the response.

The handler sets the `Content-Type` header so callers know they're getting JSON, then encodes the slice straight into the `ResponseWriter`.

## Code

Create a file called `main.go`:

```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type Item struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

var items = []Item{
	{ID: 1, Name: "Notebook", Price: 4.0},
	{ID: 2, Name: "Pen", Price: 2.5},
	{ID: 3, Name: "Sticker pack", Price: 5.0},
}

func itemsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(items); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func main() {
	http.HandleFunc("/items", itemsHandler)
	fmt.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

Run it:

```
go run main.go
```

You should see:

```
listening on :8080
```

In a second terminal:

```
curl http://localhost:8080/items
```

Output:

```
[{"id":1,"name":"Notebook","price":4},{"id":2,"name":"Pen","price":2.5},{"id":3,"name":"Sticker pack","price":5}]
```

Stop the server with `Ctrl-C`.

You shipped a single-endpoint HTTP service with zero third-party dependencies. The whole binary is the Go standard library plus one `main.go`.

---

## You finished a beginner tier. What's next?

Two paths from here.

1. **Go deeper on the same platform.** The intermediate tier on this same site teaches you to ship a thing that persists, tests itself, and talks to the world. If you liked beginner, that's the natural next step.
2. **Pick up an adjacent platform.** The table below routes you across platforms based on what you actually want to build.

| You just finished | Natural next platform | Why |
|---|---|---|
| iOS beginner | iOS intermediate, then Android beginner | Stay native, then learn the other mobile platform with a head start on the Compose/SwiftUI mental model. |
| Android beginner | Android intermediate, then Golang beginner | Backend-for-frontend pairs naturally with a mobile client. |
| Golang beginner | AWS beginner, then Golang intermediate | Deploy your endpoint before adding persistence/tests. |
| Java beginner | Java intermediate, then AWS beginner | JVM persistence + validation first, then deploy. |
| AWS beginner | Golang beginner | Have a backend to deploy. AWS without a service to host is reference, not curriculum. |

Or jump back to the [Hub](https://alibaihaqi.github.io/learning-docs/) and pick a different goal.
