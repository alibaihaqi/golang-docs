---
title: Standard library tour
tier: go-language
platform: golang
---

# Standard library tour

[Go Language](./index.md) › 11 Standard library tour

Go's standard library is one of the language's strongest features — it includes a production-grade HTTP server, a JSON encoder/decoder, TLS support, compression, cryptography, templating, testing, profiling, and more. Many services never need third-party code.

This tour covers the packages you will reach for most often: `net/http`, `io`, `encoding`, `flag`, `time`, `os`, and `testing`. Each is designed to compose with the others through shared interfaces — most notably `io.Reader` and `io.Writer`.

## `net/http` — HTTP client and server

The `net/http` package provides both a server (`http.Server`) and a client (`http.Client`). The core abstraction is the `http.Handler` interface:

```go
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}
```

### Server

```go
mux := http.NewServeMux()

mux.HandleFunc("GET /api/users", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`[{"id":1,"name":"Alice"}]`))
})

server := &http.Server{
    Addr:         ":8080",
    Handler:      mux,
    ReadTimeout:  10 * time.Second,
    WriteTimeout: 10 * time.Second,
    IdleTimeout:  60 * time.Second,
}

log.Fatal(server.ListenAndServe())
```

Key points:
- `ServeMux` supports method-based routing (`"GET /path"`, `"POST /path"`) since Go 1.22.
- `http.HandlerFunc` adapts any function with the right signature to `http.Handler`.
- Timeouts prevent resource leaks — always set them in production.
- `ListenAndServeTLS` serves HTTPS with a certificate.

### Handler middleware pattern

```go
func Logging(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
    })
}

server.Handler = Logging(mux)
```

### Client

```go
client := &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        100,
        IdleConnTimeout:     90 * time.Second,
        MaxIdleConnsPerHost: 10,
    },
}

req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.example.com/users", nil)
if err != nil { log.Fatal(err) }
req.Header.Set("Authorization", "Bearer token")

resp, err := client.Do(req)
if err != nil { log.Fatal(err) }
defer resp.Body.Close()

body, err := io.ReadAll(resp.Body)
```

- Always set a `Timeout` on the client — zero means no timeout.
- `Transport` controls connection pooling. Reuse a single `http.Client` across your application.
- `NewRequestWithContext` supports cancellation via context.
- `defer resp.Body.Close()` is required even if you do not read the body.

### Default client vs custom client

The zero-value `http.DefaultClient` is convenient but has no timeout. For production code, always create a custom client with explicit timeouts and transport configuration.

## `io` and `io/fs` — readers and writers

The `io.Reader` and `io.Writer` interfaces are the foundation of Go's I/O abstraction:

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}
```

Everything implements these: files, network connections, TLS tunnels, gzip streams, HTTP bodies, buffers, in-memory pipes. This composability means you can chain I/O operations without caring about the underlying data source.

### `io.Copy`

```go
// Copy from HTTP response to a file
resp, _ := http.Get("https://example.com/file.zip")
defer resp.Body.Close()

f, _ := os.Create("file.zip")
defer f.Close()

written, err := io.Copy(f, resp.Body)
// written is int64 — bytes copied
```

`io.Copy` reads from the source and writes to the destination in a 32 KB buffer. It is the most common I/O utility in Go.

### `io.MultiReader` and `io.LimitReader`

```go
// Concatenate multiple readers into one stream
r := io.MultiReader(
    strings.NewReader("header\n"),
    fileReader,
    strings.NewReader("footer\n"),
)

// Read at most N bytes
limited := io.LimitReader(resp.Body, 10*1024*1024) // 10 MB max
data, _ := io.ReadAll(limited)
```

- `MultiReader` concatenates readers sequentially.
- `LimitReader` returns an `io.Reader` that reads at most N bytes — useful for limiting input sizes.
- `io.ReadAll` reads until EOF (Go 1.16+) — replaces `ioutil.ReadAll`.

### `io/fs` (Go 1.16+)

```go
// Walk a directory
fsys := os.DirFS("/path/to/templates")
files, _ := fs.ReadDir(fsys, ".")
for _, f := range files {
    if !f.IsDir() {
        data, _ := fs.ReadFile(fsys, f.Name())
        fmt.Printf("%s: %d bytes\n", f.Name(), len(data))
    }
}
```

`io/fs` abstracts a filesystem — `os.DirFS`, `embed.FS`, and `testing/fstest` all implement it.

## `encoding` — JSON, CSV, XML, and GOB

### `encoding/json`

```go
type User struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email,omitempty"`
}

// Marshal — struct to JSON bytes
users := []User{{ID: 1, Name: "Alice", Email: "alice@example.com"}}
data, err := json.MarshalIndent(users, "", "  ")

// Unmarshal — JSON bytes to struct
var decoded []User
err = json.Unmarshal(data, &decoded)

// Streaming decoder (for large inputs)
decoder := json.NewDecoder(resp.Body)
for decoder.More() {
    var u User
    if err := decoder.Decode(&u); err != nil {
        break
    }
    fmt.Printf("%+v\n", u)
}
```

- Always prefer struct tags to control field names — never rely on default field matching.
- `MarshalIndent` produces human-readable output; `Marshal` is more compact.
- `Decoder` reads from a stream, `Encoder` writes to a stream — both avoid loading the entire payload into memory.

### `encoding/csv`

```go
f, _ := os.Open("data.csv")
defer f.Close()

r := csv.NewReader(f)
records, _ := r.ReadAll() // [][]string
for _, row := range records {
    fmt.Println(row[0], row[1])
}

// Writing CSV
w := csv.NewWriter(os.Stdout)
w.Write([]string{"id", "name", "email"})
w.Write([]string{"1", "Alice", "alice@example.com"})
w.Flush()
```

### `encoding/xml`

Similar to JSON but with XML-specific features like namespaces:

```go
type Doc struct {
    XMLName xml.Name `xml:"document"`
    Title   string   `xml:"title"`
    Items   []Item   `xml:"items>item"`
}
```

### `encoding/gob`

Go's own binary encoding format — efficient, reflection-based, Go-only:

```go
var buf bytes.Buffer
enc := gob.NewEncoder(&buf)
enc.Encode(someStruct)

dec := gob.NewDecoder(&buf)
var decoded MyStruct
dec.Decode(&decoded)
```

Gob is used internally by `net/rpc` and is the most efficient wire format if both ends are Go. It is not suitable for cross-language interop.

## `flag` — command-line parsing

```go
var (
    addr   = flag.String("addr", ":8080", "server address")
    debug  = flag.Bool("debug", false, "enable debug logging")
    dbPath = flag.String("db", "./data.db", "database path")
)

func main() {
    flag.Parse()
    fmt.Printf("Starting server on %s (debug=%v)\n", *addr, *debug)
}
```

### Positional arguments

```go
flag.Parse()
args := flag.Args() // remaining positional arguments
if len(args) < 1 {
    fmt.Fprintf(os.Stderr, "usage: myapp <command> [args]\n")
    os.Exit(1)
}
```

### Custom flag types

```go
type DurationFlag time.Duration

func (d *DurationFlag) Set(s string) error {
    v, err := time.ParseDuration(s)
    *d = DurationFlag(v)
    return err
}

var timeout DurationFlag
flag.Var(&timeout, "timeout", "duration (e.g. 30s, 5m)")
```

### Alternatives

The standard `flag` package follows POSIX conventions with `--` flags. The `pflag` package (used by Kubernetes) provides full POSIX/GNU-style flag support including `-` short flags and `--flag=value` syntax.

## `time` — durations and formatting

```go
// Duration (int64 nanoseconds)
d := 5 * time.Second
fmt.Println(d)           // "5s"
fmt.Println(d.Seconds()) // 5

// Time
now := time.Now()
t := time.Date(2026, 7, 8, 12, 0, 0, 0, time.UTC)

// Formatting — reference time is Mon Jan 2 15:04:05 MST 2006
fmt.Println(t.Format(time.RFC3339))        // "2026-07-08T12:00:00Z"
fmt.Println(t.Format("2006-01-02 15:04"))  // "2026-07-08 12:00"

// Time operations
fmt.Println(t.Add(24 * time.Hour))         // next day
fmt.Println(t.Sub(now))                    // duration
fmt.Println(t.Before(now))                 // true if t < now

// Timers and tickers
timer := time.NewTimer(5 * time.Second)
<-timer.C  // blocks until 5 seconds

ticker := time.NewTicker(1 * time.Second)
for range ticker.C {
    fmt.Println("tick")
}
```

Key reference format: Go uses `Mon Jan 2 15:04:05 MST 2006` as the canonical reference time. The specific digits matter — `01` is month, `02` is day, `03`/`15` is hour, `04` is minute, `05` is second, `2006` is year, `MST` is timezone.

## `os` — file I/O and OS interaction

### File operations (Go 1.16+)

```go
// Read entire file into memory
data, err := os.ReadFile("config.json")

// Write entire file
err = os.WriteFile("output.json", data, 0644)

// Open and Close
f, err := os.Open("file.txt")
defer f.Close()

// Create (truncates if exists)
f, err := os.Create("newfile.txt")
defer f.Close()
```

### Stat and file info

```go
info, err := os.Stat("file.txt")
fmt.Println(info.Name(), info.Size(), info.Mode(), info.ModTime())
// "file.txt 1024 -rw-r--r-- 2026-07-08 12:00:00"

if os.IsNotExist(err) {
    fmt.Println("file does not exist")
}
```

### Signal handling

```go
sig := make(chan os.Signal, 1)
signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

go func() {
    s := <-sig
    fmt.Printf("received signal %v, shutting down\n", s)
    os.Exit(0)
}()
```

`signal.NotifyContext` (Go 1.16+) combines signal handling with context:

```go
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
defer stop()

// Use ctx for graceful shutdown
server.Shutdown(ctx)
```

## Discovering packages

```bash
# From the command line
go doc net/http        # full documentation
go doc net/http.Server # specific type
go doc net/http.Client.Timeout # specific field

# Web
pkg.go.dev     # official package discovery
godoc.org      # redirects to pkg.go.dev
```

The standard library is fully documented on `pkg.go.dev` with examples, source code links, and sub-package listings. Every public type, function, and method has a doc comment — this is enforced by the Go project's contribution guidelines.

### Finding the right package

```bash
# Search standard library packages
go doc -src net/http.ServeMux

# List all packages in a module
go list std | grep encoding
# encoding/base64, encoding/binary, encoding/csv, encoding/gob,
# encoding/hex, encoding/json, encoding/pem, encoding/xml
```

## Links to existing tiers

The [Advanced tier CI/CD page](../advanced/10-ci-cd-github-actions.md) uses `os/exec` to run build commands and `flag` for configuration. The [Beginner tier](../beginner/) uses `net/http` for its API server, `encoding/json` for response encoding, and `os.ReadFile`/`os.WriteFile` for file persistence. The Intermediate tier's graceful shutdown pattern uses `signal.NotifyContext`.

---

**Next:** [12 Testing and benchmarking](./12-testing-and-benchmarking.md)
