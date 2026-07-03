---
title: Why persistence
tier: intermediate
platform: golang
position: 1
---

# Why persistence

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate › Why persistence

**Goal**

Understand what the beginner endpoint is missing and what this tier fixes. No code on this page.

**Prerequisites**

- [Golang Beginner — Serving JSON](../beginner/10-serving-json.md) (the tier exit artifact)

## What the beginner endpoint can't do

The beginner endpoint returns a hard-coded slice:

```go
var items = []Item{
    {ID: 1, Name: "Notebook", Price: 4.0},
    {ID: 2, Name: "Pen", Price: 2.5},
    {ID: 3, Name: "Sticker pack", Price: 5.0},
}
```

That slice lives only in process memory. Two things make it a dead end for a real service:

1. **No writes.** You can't add, change, or remove an item through the API. The list is frozen at compile time.
2. **No memory between restarts.** Stop the server, start it again — the slate is blank. Any change you managed to make in code is gone the moment the binary exits.

Every production CRUD API replaces in-memory data with a database for exactly these two reasons.

## What this tier adds

You will add a SQLite file (`items.db`) and a store layer that wraps it. By the end of page 08 you will have:

- `GET /items` — reads all rows from the database
- `GET /items/{id}` — reads one row by primary key
- `POST /items` — inserts a new row and returns it

The data survives restarts because SQLite writes it to disk. The test suite uses an in-memory SQLite connection so tests stay fast and leave no files behind.

Everything is pure Go — no cgo, no ORM, no framework. The only third-party dependency is a CGo-free SQLite driver.

**Next** → [02 Project setup](./02-project-setup.md)
