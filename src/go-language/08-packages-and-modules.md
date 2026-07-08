---
title: Packages and modules
tier: go-language
platform: golang
---

# Packages and modules

[Go Language](./index.md) › 08 Packages and modules

## Packages: the unit of organisation

Every Go file belongs to exactly one package. All `.go` files in the same directory must share the same package name, which conventionally matches the directory name.

```go
package main

import "fmt"
```

### Exported vs unexported names

Go controls visibility using **capitalisation** — the only access control mechanism in the language:

```go
package user

var PublicField  string // Exported — accessible outside the package
var privateField string // Unexported — only accessible within the package
```

No `public`, `private`, or `protected` keywords exist. Uppercase is exported, lowercase is not.

### Package-level initialisation

Variables declared at package level are initialised before `main()` runs, ordered by dependency:

```go
var a = computeA()
var b = a + 1 // a is guaranteed to be initialised first
```

Go's compiler resolves the dependency graph automatically — no special initialisation functions needed.

## Modules: the unit of versioning

A **module** is a collection of packages with a shared `go.mod` file:

```go
module github.com/user/project

go 1.22

require github.com/lib/pq v1.10.9
```

`go mod init <module-path>` creates `go.mod`. The module path is typically the repository URL.

### The `go` directive

The `go` line specifies the expected Go version. Starting in Go 1.21, this is a **minimum version** — the toolchain uses the version in `go.mod` or a later one if needed.

### `go.sum`

Every module has `go.sum` containing cryptographic hashes of every dependency version:

```
github.com/lib/pq v1.10.9 h1:YXG7RB+JIjhP29X+OtkiDnYaXQwpS4JEWq7dtCCRUEw=
```

The `go.sum` file is append-only and ensures every build uses exactly the same dependency content. If a tag moves, `go mod verify` detects the mismatch.

### `require`, `replace`, `retract`

```go
require github.com/lib/pq v1.10.9

// Local development override
replace github.com/lib/pq => ../forked-lib-pq

// Retract a bad version
retract v1.0.0 // accidentally contained a breaking change
```

## Import paths

Go source files import packages using the module path:

```go
import (
    "fmt"                             // Standard library
    "example.com/items-api/store"     // Module-internal package
)
```

### Named imports

```go
import (
    "crypto/rand"
    mrand "math/rand" // aliased to avoid collision
)

import _ "image/png" // side-effect import (triggers init)
```

The blank identifier suppresses the "imported and not used" compile error.

### Dot imports — don't use them

```go
// Bad — pollutes namespace
import . "fmt"
Println("hello")

// Good — always qualify names
import "fmt"
fmt.Println("hello")
```

Dot imports are discouraged outside of tests.

## Semantic import versioning

Major version changes (v2+) change the module path itself:

```go
// v1
module github.com/user/project

// v2 — different module path
module github.com/user/project/v2
```

This allows consuming both versions simultaneously:

```go
import (
    "github.com/user/project"       // v1.x
    v2 "github.com/user/project/v2"  // v2.x
)
```

| Major version | Module path |
|--------------|-------------|
| v0/v1 | `github.com/user/project` |
| v2 | `github.com/user/project/v2` |
| v3 | `github.com/user/project/v3` |

v0 and v1 share the same base path — going from v0 to v1 is not a breaking change in module-path terms.

## `internal` packages

The `internal/` directory creates a visibility boundary — packages inside `internal/` can only be imported by code rooted within the parent:

```
project/
├── internal/
│   └── db/
│       └── conn.go      // package db
├── api/
│   └── handler.go       // can import project/internal/db
└── cmd/
    └── server/
        └── main.go      // can import project/internal/db
```

An external consumer cannot import `project/internal/db` — the compiler rejects it:

```
imports project/internal/db: use of internal package not allowed
```

Use `internal/` for repository internals, shared helpers between packages, and business logic that should never be a public API.

## Workspaces (Go 1.18+)

A `go.work` file lets you develop multiple modules locally without editing `go.mod`:

```go
go 1.22

use (
    ./api
    ./cli
    ./shared
)
```

`go work init ./api ./cli ./shared` creates the file. With it, `go build` uses local versions rather than published module versions.

Workspaces are preferred over `replace` directives for local development — `replace` directives persist in `go.mod` and are easy to commit accidentally. Workspace files are typically gitignored:

```gitignore
go.work
go.work.sum
```

## `init()` functions

Every package can have zero or more `init()` functions:

```go
package db

var pool *sql.DB

func init() {
    var err error
    pool, err = sql.Open("postgres", os.Getenv("DATABASE_URL"))
    if err != nil {
        panic(err)
    }
}
```

### Execution order

1. Package-level variables are initialised first (in dependency order).
2. Then `init()` functions run (in declaration order within each file).
3. All `init()` functions complete before `main()` begins.

Order across packages follows the import graph — a package's `init()` runs after its dependency's. Within a package, multiple `init()` functions execute in filename order (alphabetically) across files.

### When init() is appropriate

- Registration (database drivers, image formats, HTTP handlers).
- One-time validation (checking environment variables, verifying connectivity).
- Static table population (precomputing lookup tables).

### When init() is not appropriate

- Expensive initialisation — it blocks `main()` startup. Use lazy init or explicit setup.
- Conditional initialisation — `init()` cannot return errors. Use `func Init() error` pattern instead.
- Test control — `init()` makes tests harder to control independently.

## Vendoring

`go mod vendor` copies dependency sources into `vendor/`:

```bash
go mod vendor
```

Build with the vendor directory:

```bash
go build -mod=vendor ./...
```

### When to vendor

- Reproducible builds — the exact same source is committed.
- Air-gapped environments — CI/CD without internet access.
- Audit requirements — every dependency is reviewed and committed.

### When not to vendor

- Most projects — Go modules with a module proxy are sufficient.
- Large dependency trees — vendor directories bloat repo size.
- Frequent dependency changes — every update regenerates the vendor tree.

## Naming conventions

- **Package names:** lowercase, single word, matching the directory name. No snake_case, camelCase, or hyphens. Short but readable: `strconv` not `stringconversion`.
- **File names:** lowercase with underscores only for test suffixes: `handler_test.go`. Descriptive: `http_handler.go`, `sql_store.go`.
- **Avoid stutter:** `user.UserService` → `service.User` or `user.New()`.

### Tidy

`go mod tidy` ensures `go.mod` matches source code exactly — it adds missing and removes unused dependencies:

```bash
go mod tidy
```

Run it before every commit to keep `go.mod` clean.

## Links to existing tiers

The [Intermediate tier](../intermediate/) declares `module example.com/items-api` in its `go.mod` and uses `require` with `github.com/mattn/go-sqlite3`. The [Advanced tier's graceful shutdown](../advanced/09-graceful-shutdown.md) uses `signal.NotifyContext` — a standard library function imported via the module path.

---

**Next:** [09 Goroutines and channels](./09-goroutines-and-channels.md)
