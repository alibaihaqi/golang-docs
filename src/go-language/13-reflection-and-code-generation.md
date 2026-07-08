---
title: Reflection and code generation
tier: go-language
platform: golang
---

# Reflection and code generation

[Go Language](./index.md) › 13 Reflection and code generation

Go provides two mechanisms for working with types and code at a meta level: the `reflect` package for runtime introspection of types and values, and `go:generate` for compile-time code generation. They serve different purposes — reflection is dynamic but slow, code generation is static but requires a separate step.

## The `reflect` package

Reflection allows a program to examine its own structure at runtime — to discover the type of an interface value, to read struct tags, and to set fields dynamically.

### `reflect.TypeOf` and `reflect.ValueOf`

```go
import "reflect"

var x int64 = 42
t := reflect.TypeOf(x)     // int64
v := reflect.ValueOf(x)    // 42

fmt.Println(t.Name())      // int64
fmt.Println(t.Kind())      // int64
fmt.Println(v.Int())       // 42
```

- `reflect.Type` represents a Go type — its name, kind, package path, methods.
- `reflect.Value` represents a Go value — you can read it, set it (if addressable), and call methods on it.

### The three laws of reflection

1. **Reflection goes from interface value to reflection object.** `reflect.TypeOf(i)` and `reflect.ValueOf(i)` convert an `interface{}` to reflection types.
2. **Reflection goes from reflection object to interface value.** `v.Interface()` converts a `reflect.Value` back to `interface{}`.
3. **To modify a reflection object, the value must be settable.** Only pointers can be modified — pass `&x` to `reflect.ValueOf`, then use `v.Elem().SetInt(43)`.

```go
var x int64 = 42
v := reflect.ValueOf(&x).Elem() // addressable
v.SetInt(43)
fmt.Println(x) // 43
```

### Struct tags

Reflection is how `encoding/json` reads field tags:

```go
type User struct {
    Name  string `json:"name" validate:"required"`
    Email string `json:"email,omitempty" validate:"email"`
    Age   int    `json:"age" validate:"gte=0,lte=130"`
}

t := reflect.TypeOf(User{})
for i := range t.NumField() {
    field := t.Field(i)
    jsonTag := field.Tag.Get("json")
    validateTag := field.Tag.Get("validate")
    fmt.Printf("%s: json=%q validate=%q\n", field.Name, jsonTag, validateTag)
}
```

Output:

```
Name: json="name" validate="required"
Email: json="email,omitempty" validate="email"
Age: json="age" validate="gte=0,lte=130"
```

### Reading tags with `Lookup`

```go
tag, ok := field.Tag.Lookup("json")
if !ok {
    // tag not present — use field name as default
}
```

`Lookup` returns a boolean, unlike `Get` which returns empty string for missing tags.

### Dynamic function calls

```go
fn := func(a, b int) int { return a + b }
v := reflect.ValueOf(fn)

args := []reflect.Value{reflect.ValueOf(3), reflect.ValueOf(4)}
result := v.Call(args)
fmt.Println(result[0].Int()) // 7
```

Use `Value.Call` sparingly — it disables compile-time type checking and is 10-100x slower than a direct call.

### Reflection limitations

- Reflection cannot create new types at runtime.
- Reflection on unexported fields panics or returns zero values.
- Reflection is slow — each operation involves allocation, bounds checking, and method dispatch through `reflect.Value` indirection.

## Struct-to-struct mapping with reflection

A common pattern — copy fields between two structs with different types:

```go
func CopyFields(dst, src any) {
    dstVal := reflect.ValueOf(dst).Elem()
    srcVal := reflect.ValueOf(src).Elem()

    for i := range srcVal.NumField() {
        srcField := srcVal.Field(i)
        dstField := dstVal.FieldByName(srcVal.Type().Field(i).Name)
        if dstField.IsValid() && dstField.CanSet() {
            dstField.Set(srcField)
        }
    }
}
```

This is what libraries like `copier` and `jinzhu/copier` do internally. In production, prefer explicit assignment or code generation — reflection-based mapping is slow and hides type errors.

## Validation with struct tags

Custom validation using reflection:

```go
func Validate(v any) error {
    val := reflect.ValueOf(v)
    for i := range val.NumField() {
        field := val.Type().Field(i)
        tag := field.Tag.Get("validate")
        if tag == "" { continue }

        value := val.Field(i)
        switch {
        case strings.Contains(tag, "required"):
            if value.IsZero() {
                return fmt.Errorf("%s is required", field.Name)
            }
        case strings.HasPrefix(tag, "gte="):
            // greater-than-or-equal numeric check
        }
    }
    return nil
}
```

Production validation libraries (`go-playground/validator`) handle much more: nested structs, cross-field validation, custom validators, and i18n error messages.

## `go:generate` — compile-time code generation

The `go generate` command scans for `//go:generate` directives and runs the specified command:

```go
//go:generate stringer -type=Status
//go:generate mockgen -source=store.go -destination=mock_store.go -package=mypackage
```

```bash
go generate ./...
```

### `stringer`

Generates `String()` methods for integer enum types:

```go
//go:generate go run golang.org/x/tools/cmd/stringer@latest -type=Status

type Status int

const (
    StatusActive Status = iota
    StatusInactive
    StatusBanned
)
```

Running `go generate` creates `status_string.go`:

```go
func (s Status) String() string { ... }
```

### `mockgen`

Generates mock implementations of interfaces:

```go
//go:generate go run go.uber.org/mock/mockgen@latest -source=store.go -destination=store_mock.go -package=mypackage

type Store interface {
    Get(key string) (string, error)
    Set(key, value string) error
}
```

Mock packages let you test code that depends on interfaces without setting up real databases or network connections.

### Other common generators

| Tool | Purpose |
|------|---------|
| `stringer` | `String()` method for integer types |
| `mockgen` | Mock implementations of interfaces |
| `ent` | Entity framework — generates types and queries from schema |
| `sqlc` | Type-safe SQL — generates Go from SQL statements |
| `protoc` | Protocol Buffers — generates code from `.proto` files |

## `embed` (Go 1.16+)

The `embed` package embeds files into the Go binary at compile time — no runtime file reads, no deployment of static assets alongside the binary.

```go
import "embed"

//go:embed templates/*
var templateFS embed.FS

//go:embed config/default.yaml
var defaultConfig []byte

//go:embed static/css/*.css
var cssFiles embed.FS
```

### Using embedded files

```go
func main() {
    // Read a single file
    data, _ := templateFS.ReadFile("templates/index.html")

    // Serve embedded files via HTTP
    http.Handle("/static/", http.FileServer(http.FS(cssFiles)))
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### When to use embed

- Single-binary deployment — web apps with templates and static assets.
- Configuration defaults shipped with the binary.
- Migration SQL files embedded inline.
- Avoid for large files (hundreds of MB) — the binary size grows proportionally.

## `encoding/gob` — Go-specific binary encoding

`encoding/gob` is a binary encoding format optimised for Go-to-Go communication. It uses reflection to encode and decode values efficiently:

```go
var buf bytes.Buffer
enc := gob.NewEncoder(&buf)
dec := gob.NewDecoder(&buf)

// Encode
err := enc.Encode(user)
// Decode
var decoded User
err = dec.Decode(&decoded)
```

Gob is used by `net/rpc` and is more compact than JSON for nested Go structures. It is not designed for cross-language interop or human readability.

## Performance considerations

Reflection is slow — 10-100x slower than direct code:

```go
// Direct call: ~0.5 ns
result := Add(1, 2)

// Reflection call: ~200 ns
v := reflect.ValueOf(Add)
args := []reflect.Value{reflect.ValueOf(1), reflect.ValueOf(2)}
result = v.Call(args)[0].Int()
```

### Guidelines

- **Avoid reflection in hot paths** — hot loops, per-request allocation, or latency-sensitive code.
- **Prefer code generation** — `stringer`, `sqlc`, `ent`, and `protoc` produce static code that is compiled and optimised like hand-written Go.
- **Reflection for infrastructure code** — serialisation, validation, ORM mapping, and testing tools are appropriate uses because they run once per field, not once per operation.
- **Cache reflection results** — `reflect.Type` lookups and struct tag parsing can be cached in a `sync.Map` or computed once at init time.

## Links to existing tiers

Reflection and code generation are not covered by the existing Beginner, Intermediate, or Advanced tiers. These concepts appear indirectly: the Intermediate tier's JSON API uses `encoding/json` marshalling (which relies on reflection internally), and the Advanced tier's CI pipeline runs code generators. Understanding reflection helps debug why `json.Unmarshal` requires pointer arguments and how struct tags control serialisation.

---

**Next:** [14 CGO and interop](./14-cgo-and-interop.md)
