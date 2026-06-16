---
title: Golang Beginner — one REST endpoint, end to end
tier: beginner
platform: golang
---

# Golang Beginner

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner

## What you'll build

A single HTTP endpoint at `GET /items` that returns a fixed list of three items as JSON. You'll use only the Go standard library — no third-party router, no database, no framework. The exit artifact is a `main.go` you run with `go run main.go` and `curl` from another terminal. Building this is the point of every page in this tier.

## The ladder

1. [01 Install Go](./01-install-go.md) — get the toolchain working so the rest of the tier can run.
2. [02 Hello world](./02-hello-world.md) — confirm Go runs your code.
3. [03 Types and variables](./03-types-and-variables.md) — the minimum vocabulary to read Go code.
4. [04 Control flow](./04-control-flow.md) — `if` and `for`, the only branching constructs Go ships.
5. [05 Functions](./05-functions.md) — Go's only reusable unit at this tier.
6. [06 Structs](./06-structs.md) — what we'll model our handler response with.
7. [07 Slices](./07-slices.md) — the list type the endpoint will return.
8. [08 Hello HTTP](./08-hello-http.md) — start a server, answer a request.
9. [09 JSON encoding](./09-json-encoding.md) — turn a struct into a JSON byte stream.
10. [10 Serving JSON](./10-serving-json.md) — the tier exit artifact.

**Start** → [01 Install Go](./01-install-go.md)
