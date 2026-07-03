---
title: Golang Intermediate — CRUD /items backed by SQLite
tier: intermediate
platform: golang
---

# Golang Intermediate

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate

## What you'll build

You extend the beginner `GET /items` endpoint from a fixed in-memory slice into
a real CRUD API backed by SQLite. By the end you have `GET /items`,
`GET /items/{id}`, and `POST /items` reading and writing a `items.db` file, a
store layer separating SQL from HTTP, config via an environment variable, and
table-driven tests. Pure Go — no cgo, no framework.

## The ladder

1. [01 Why persistence](./01-why-persistence.md)
2. [02 Project setup](./02-project-setup.md)
3. [03 Schema](./03-schema.md)
4. [04 Store layer](./04-store-layer.md)
5. [05 List and get handlers](./05-list-get-handlers.md)
6. [06 Create handler](./06-create-handler.md)
7. [07 Config](./07-config.md)
8. [08 Tests](./08-tests.md)

**Start** → [01 Why persistence](./01-why-persistence.md)
