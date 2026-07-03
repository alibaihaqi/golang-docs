---
title: Project setup
tier: intermediate
platform: golang
position: 2
---

# Project setup

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Intermediate › Project setup

**Goal**

Create a new Go module and add the SQLite driver. After this page you have a compiling project skeleton that all later pages build on.

**Prerequisites**

- [Install Go](../beginner/01-install-go.md) (Go 1.22+)
- [Why persistence](./01-why-persistence.md)

## Create the module

Make a new directory for the project and initialise a Go module:

```bash
mkdir items && cd items
go mod init items
```

The module name `items` matches the domain — every file you add will start with `package main`.

## Add the SQLite driver

This tier uses `modernc.org/sqlite` — a pure-Go port of SQLite that needs no C compiler or CGo:

```bash
go get modernc.org/sqlite
```

Your `go.mod` now looks like this:

```go
// go.mod (module name items; Go 1.22+ for ServeMux patterns)
module items

go 1.22

require modernc.org/sqlite v1.29.0
```

`go get` also writes a `go.sum` file with checksums for every downloaded module. Commit both files.

## Create the entry point

Create `main.go` with the minimum that compiles:

```go
package main

func main() {}
```

## Checkpoint

```bash
go build ./...
```

Expected: exits 0, no output. If you see `cannot find module`, run `go get modernc.org/sqlite` again from inside the `items/` directory.

**For frontend developers**

`go mod init` + `go get` play the same role as `npm init` + `npm install`. The `go.sum` file is the lock file — check it in. There is no `node_modules/` directory; the Go toolchain caches downloaded modules globally in `$GOPATH/pkg/mod`.

**Next** → [03 Schema](./03-schema.md)
