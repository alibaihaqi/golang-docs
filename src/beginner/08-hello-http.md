---
title: Hello HTTP
tier: beginner
platform: golang
position: 8
---

# Hello HTTP

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Hello HTTP

**Goal**

Run a Go program that serves the text `hello` at `http://localhost:8080/hello`. After this page you will know how to start an HTTP server in Go without any third-party library.

**Prerequisites**

- [Functions](./05-functions.md)

## What an HTTP handler is

Go's standard library has everything you need to answer web requests. The package is called `net/http`.

A *handler* is a function that takes two things: a `ResponseWriter` (what you write the reply into) and a `*Request` (what the caller sent you). You write your reply into the writer and Go ships it back to the caller.

A *mux* is a routing table — it maps a URL path to a handler. The default mux ships with Go, so you don't have to build one.

For everything `net/http` can do, see the [official package docs](https://pkg.go.dev/net/http). The two pieces we need now are `HandleFunc` (register a handler) and `ListenAndServe` (start the server).

## Code

Create a file called `main.go`:

```go
package main

import (
	"fmt"
	"log"
	"net/http"
)

func hello(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "hello")
}

func main() {
	http.HandleFunc("/hello", hello)
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
curl http://localhost:8080/hello
```

Output:

```
hello
```

Stop the server with `Ctrl-C`.

The second argument to `ListenAndServe` is the mux. Passing `nil` tells Go to use the default mux, which is what `http.HandleFunc` registered against.

**For frontend developers**

If you've used Express in Node, this is the same idea: register a handler against a path, start a listener on a port. Go's standard library plays the role Express does — no install required.

**Next** → [JSON encoding](./09-json-encoding.md)
