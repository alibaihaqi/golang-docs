---
title: CGO and interop
tier: go-language
platform: golang
---

# CGO and interop

[Go Language](./index.md) › 14 CGO and interop

CGO is Go's mechanism for calling C code from Go programs. It enables access to the entire C ecosystem — existing C libraries, system calls, and platform-specific APIs — at the cost of build complexity, slower cross-compilation, and performance overhead.

## What is CGO?

CGO is not a separate tool — it is part of the `go` toolchain, activated automatically when a Go file imports `"C"`. This import triggers the C preprocessor and links against a C compiler (typically `gcc` or `clang`).

```go
package main

/*
#include <stdlib.h>
#include <stdio.h>

void hello() {
    printf("hello from C\n");
}
*/
import "C"

func main() {
    C.hello()
}
```

Build with `go build` — the toolchain compiles the C code and links it into the Go binary. CGO must be enabled for this to work (`CGO_ENABLED=1`, the default on macOS and Linux).

### Build requirements

- A C compiler (`gcc`, `clang`) installed and on `$PATH`.
- Development headers for any C libraries used (`-dev` packages on Debian/Ubuntu, `-devel` on RHEL/Fedora).
- On macOS: Xcode Command Line Tools provide `clang` and the system libraries.
- On Windows: MinGW or MSVC.

## Basic C calls

```go
/*
#include <stdlib.h>
#include <math.h>

// #cgo LDFLAGS: -lm
*/
import "C"
import "unsafe"

func Random() int {
    return int(C.random()) // C.long → Go int
}

func Sqrt(x float64) float64 {
    return float64(C.sqrt(C.double(x)))
}

func Seed(s int64) {
    C.srandom(C.uint(s))
}
```

### Calling conventions

- C types map to Go types with a `C.` prefix: `C.int`, `C.double`, `C.long`, `C.size_t`.
- Function calls cross the CGO boundary — each call has overhead (~10-50x a regular Go call).
- C functions return multiple values in Go convention — the actual return value and a second value indicating errno.

### Error handling

```go
n, err := C.fdopen(C.int(fd), C.CString("r"))
if err != nil {
    return nil, fmt.Errorf("fdopen failed: %v", err)
}
```

## String conversion

CGO provides helpers for converting between Go strings and C strings. The key rule: C strings are **not garbage collected** — they must be freed manually.

```go
import "unsafe"

// Go string → C string (allocates C memory)
s := "hello"
cs := C.CString(s)
defer C.free(unsafe.Pointer(cs)) // MUST free

// C string → Go string
goString := C.GoString(cs)

// C string with known length → Go string
goStringN := C.GoStringN(cs, C.int(5))
```

### Memory management rules

- `C.CString` allocates memory in C heap — not tracked by the Go garbage collector.
- Always pair `C.CString` with `defer C.free(unsafe.Pointer(cs))`.
- `C.CBytes` and `C.GoBytes` provide the same interface for byte slices.
- Leaked C memory is never reclaimed — use `defer` immediately after allocation.

### Safe string helper

```go
func withCString(s string, fn func(*C.char) error) error {
    cs := C.CString(s)
    defer C.free(unsafe.Pointer(cs))
    return fn(cs)
}

// Usage
err := withCString("example.txt", func(cs *C.char) error {
    f, err := C.fopen(cs, C.CString("r"))
    if err != nil { return err }
    defer C.fclose(f)
    return nil
})
```

## Struct and pointer interop

### Accessing C structs

```go
/*
#include <time.h>
*/
import "C"
import "fmt"

func main() {
    var tm C.struct_tm
    C.time(&tm)
    fmt.Printf("year: %d\n", tm.tm_year + 1900)
}
```

### C heap allocation with Go finalizer

```go
type Buffer struct {
    ptr *C.char
    len int
}

func NewBuffer(size int) *Buffer {
    b := &Buffer{
        ptr: (*C.char)(C.malloc(C.size_t(size))),
        len: size,
    }
    runtime.SetFinalizer(b, func(b *Buffer) {
        C.free(unsafe.Pointer(b.ptr))
    })
    return b
}
```

`runtime.SetFinalizer` runs a function when the garbage collector determines the object is unreachable. Use it as a safety net, but always prefer explicit `defer C.free` — finalizers run at an unpredictable time (possibly never in a short-lived program).

## Build constraints

### Conditional compilation for CGO files

```go
//go:build cgo

package main

import "C"
// ...CGO-only code follows
```

Files with `//go:build cgo` are only compiled when CGO is enabled. Use this to separate CGO-dependent code from pure Go code:

```
mypackage/
  core.go               // pure Go, always compiles
  core_cgo.go           // CGO-dependent, //go:build cgo
  core_other.go         // fallback, //go:build !cgo
```

### Disabling CGO

```bash
CGO_ENABLED=0 go build   # forces pure Go compilation
CGO_ENABLED=0 go test    # skips CGO-tagged files
```

Common scenarios:
- **Scratch Docker images** — no C compiler available, no libc. Disable CGO for fully static binaries.
- **Cross-compilation** — CGO cross-compilation requires a matching C toolchain for the target.
- **CI environments** — disable CGO to avoid C toolchain dependencies.

## CGO performance

Crossing the Go-C boundary is expensive:

```go
func BenchmarkCGOBoundary(b *testing.B) {
    for i := 0; i < b.N; i++ {
        C.nop() // empty C function
    }
}

func BenchmarkGoCall(b *testing.B) {
    for i := 0; i < b.N; i++ {
        nop() // equivalent Go function
    }
}
```

Expected results: CGO call ~30-50 ns, Go call ~1-2 ns.

### Performance rules

- Batch C calls — one call processing 1000 items is faster than 1000 individual calls.
- Keep CGO off hot paths — per-request C calls add up.
- Avoid CGO in loops — restructure to pass slices/arrays in bulk.
- Profile before optimising — CGO overhead may be irrelevant in I/O-bound code.

## When to use CGO

### Good reasons to use CGO

- **Existing C library** — SQLite (`mattn/go-sqlite3`), BLAS/LAPACK for numerical work, hardware drivers.
- **System calls** — platform-specific APIs not exposed by Go's standard library (e.g., extended file attributes, ioctl, POSIX ACLs).
- **Performance-critical native code** — rare, but legitimate for specialised SIMD workloads or mature numerical libraries.

### Good reasons to avoid CGO

- **Pure Go alternative exists** — `modernc.org/sqlite` is a cgo-free SQLite port. Most crypto, compression, and encoding libraries have pure Go implementations.
- **Cross-compilation is required** — CGO cross-compilation needs a matching C toolchain for each target.
- **Small Docker images** — CGO binaries link against libc (unless statically linked with musl).
- **Fast build times** — CGO builds are slower because the toolchain invokes the C compiler and linker.

### Example: SQLite decision matrix

| | `mattn/go-sqlite3` (CGO) | `modernc.org/sqlite` (pure Go) |
|---|---|---|
| Build speed | Slow (needs C compiler) | Fast |
| Cross-compile | Complex | Simple |
| Binary size | ~6 MB | ~12 MB |
| Performance | ~5% faster | ~5% slower |
| Docker compat | Needs libc | Works with scratch |

Choose CGO SQLite for maximum performance. Choose pure Go SQLite when cross-compilation or minimal Docker images matter more.

## Alternative: `gccgo`

`gccgo` is a GCC frontend for Go. It compiles Go code through the GCC infrastructure:

```bash
go build -compiler gccgo mypackage
```

Rarely used in practice. Advantages: GCC optimisations, access to GCC's C/Objective-C FFI. Disadvantages: slower builds, less tested, lags behind the main `gc` toolchain in Go version support. Unlikely to be the right choice for new projects.

## CGO safety checklist

- Always `defer C.free` immediately after `C.CString` allocation.
- Never pass a Go pointer to C that contains a Go pointer (the "CGO pointer passing rule").
- Do not store C pointers in Go-allocated memory that C will access concurrently.
- Prefer `cgo` build tags to isolate CGO code from pure Go builds.
- Test with `CGO_ENABLED=0` to ensure fallback builds work in constrained environments.

---

You've completed the Go Language deep-dive. Browse the [Overview](../go-language/) or start the [Beginner tier](../beginner/) to apply what you've learned.
