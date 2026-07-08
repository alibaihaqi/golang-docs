---
title: Structs and methods
tier: go-language
platform: golang
---

# Structs and methods

[Go Language](./index.md) › 04 Structs and methods

## Struct definition and initialisation

A struct is a collection of named fields. It is Go's primary mechanism for grouping related data.

```go
type User struct {
    Name string
    Age  int
    Email string
}
```

Fields are accessed with dot notation:

```go
var u User
u.Name = "Alice"
u.Age = 30
fmt.Println(u.Name) // "Alice"
```

### Zero values

Every field in a struct defaults to its zero value when created without explicit initialisation. Structs are always safe to use — no field is ever undefined:

\`\`\`go
var u User
fmt.Println(u) // {"", 0, ""}

var cfg Config
// cfg.Port is 0, cfg.Host is "", cfg.Verbose is false
\`\`\`

### Initialisation syntax

```go
// Positional — fragile, not recommended
u1 := User{"Alice", 30, "alice@example.com"}

// Named fields — preferred
u2 := User{
    Name:  "Bob",
    Age:   25,
    Email: "bob@example.com",
}

// Partial initialisation — remaining fields get zero values
u3 := User{Name: "Carol"}
// u3.Age == 0, u3.Email == ""
```

Named field initialisation is the idiomatic form. It is self-documenting, resilient to field reordering, and allows partial initialisation without ambiguity.

### Composite literal with pointer

```go
u4 := &User{Name: "Dave"}
// u4 is *User — a pointer to a newly allocated User struct
```

Go's `&` on a composite literal allocates the struct and returns a pointer in one step. This is equivalent to:

```go
u4 := new(User)
u4.Name = "Dave"
```

But the composite literal form is more compact and idiomatic.

## Struct tags

A struct tag is a string annotation attached to a field. The `reflect` package reads these tags at runtime. The most common use is `encoding/json`:

```go
type User struct {
    ID    int    `json:"id,omitempty"`
    Name  string `json:"name"`
    Email string `json:"email,omitempty"`
    Role  string `json:"role,string"` // serialise as string even if int
}

// JSON output:
// {"id":1,"name":"Alice","email":"alice@example.com","role":"\"admin\""}
```

### Common tag formats

```go
type Config struct {
    Port int    `json:"port" yaml:"port" env:"PORT"`
    Host string `json:"host" yaml:"host" env:"HOST"`

    // Tags for validation libraries (e.g., go-playground/validator)
    Age  int    `validate:"gte=0,lte=130"`

    // Tags for form parsing
    Token string `form:"csrf_token"`

    // Tags for database mapping
    ID    int64  `db:"id,primarykey,autoincrement"`
}
```

The \`reflect.StructTag\` type provides a \`Get\` method for looking up keys at runtime:

\`\`\`go
t := reflect.TypeOf(User{})
field, _ := t.FieldByName("Name")
tag := field.Tag.Get("json") // "name"
\`\`\`

## Value vs pointer receivers

A method is a function with a **receiver** — the type the method belongs to.

```go
type User struct {
    FirstName string
    LastName  string
}
```

### Value receiver

A value receiver operates on a **copy** of the struct. The original is not modified.

```go
func (u User) FullName() string {
    return u.FirstName + " " + u.LastName
}

u := User{FirstName: "Alice", LastName: "Smith"}
fmt.Println(u.FullName()) // "Alice Smith"
```

Value receivers are appropriate when:
- The method does not modify the receiver.
- The receiver is small (a few fields, or a basic type).
- You need the method to work on both value and pointer (Go automatically handles both).

### Pointer receiver

A pointer receiver can modify the original value. It also avoids copying the entire struct.

```go
func (u *User) SetName(first, last string) {
    u.FirstName = first
    u.LastName = last
}

u := User{FirstName: "Alice", LastName: "Smith"}
u.SetName("Bob", "Jones")
fmt.Println(u.FullName()) // "Bob Jones"
```

Pointer receivers are appropriate when:
- The method modifies the receiver.
- The receiver is large (struct with many fields or embedded data).
- You need the receiver to be `nil`-safe (the method handles a nil pointer).
- You want consistency — if any method on a type needs a pointer receiver, make all methods on that type use pointer receivers.

### Automatic conversion

Go automatically converts between value and pointer receiver calls:

```go
u := User{FirstName: "Alice"}
u.SetName("Bob", "")   // (&u).SetName — Go takes address automatically

up := &User{FirstName: "Alice"}
fmt.Println(up.FullName()) // (*up).FullName — Go dereferences automatically
```

### Nil pointer receivers

A method on a pointer receiver can be called on a nil pointer. It is the method's responsibility to handle nil:

```go
func (u *User) IsValid() bool {
    if u == nil {
        return false
    }
    return u.FirstName != ""
}

var u *User // nil
fmt.Println(u.IsValid()) // false — no panic
```

This pattern is used extensively in the standard library (e.g., `(*http.Request).Context()` returns `context.Background()` when the receiver is nil).

### Which one to use?

**General rule:** use a value receiver when the method does not mutate the receiver and the struct is small. Use a pointer receiver when the method modifies the receiver, the struct is large, or the receiver may be nil.

**Consistency rule:** if any method on a type needs a pointer receiver, all methods on that type should use pointer receivers. Mixing value and pointer receivers creates different method sets on \`T\` and \`*T\`, which causes subtle bugs when the type is used through an interface.

## Embedding (not inheritance)

Go does not have class inheritance. Instead, it provides **struct embedding** — a composition mechanism where one struct type is embedded into another.

```go
type User struct {
    Name  string
    Email string
}

func (u User) FullName() string {
    return u.Name
}

type Admin struct {
    User                    // embedded — no field name
    Permissions []string
}
```

### Method promotion

Methods of the embedded type are **promoted** to the embedding type. You can call them directly:

```go
admin := Admin{
    User: User{
        Name:  "Alice",
        Email: "alice@example.com",
    },
    Permissions: []string{"read", "write"},
}

fmt.Println(admin.FullName())     // "Alice" — promoted from User
fmt.Println(admin.Name)           // "Alice" — promoted field
fmt.Println(admin.User.Email)     // explicit access to embedded field
```

### No overriding

Go does not have virtual dispatch — an embedding type cannot "override" a method of the embedded type. You can define a method with the same name, which **shadows** the embedded method rather than overriding it:

\`\`\`go
type Admin struct {
    User
    Permissions []string
}

func (a Admin) FullName() string {
    return "Admin: " + a.User.FullName()
}
\`\`\`

The promoted \`User.FullName()\` is still accessible via \`admin.User.FullName()\`. The shadowing is resolved at compile time based on the receiver type, not through dynamic dispatch — embedding is composition, not inheritance.

### Multiple embedding

A struct can embed multiple types:

```go
type Reader struct { /* ... */ }
type Writer struct { /* ... */ }

type ReadWriter struct {
    Reader
    Writer
}
```

If both embedded types have a method with the same name, the compiler requires you to disambiguate:

```go
type A struct { }
func (A) Do() string { return "A" }

type B struct { }
func (B) Do() string { return "B" }

type C struct {
    A
    B
}
// Compile error: ambiguous selector C.Do
```

### Named embedding

Embedding without a field name (as above) is **anonymous embedding**. You can also use named embedding, which works like a regular field:

```go
type Admin struct {
    user User                    // named — field must be accessed as admin.user
    Permissions []string
}
```

Named embedding does not promote methods. Use anonymous embedding when you want method promotion and a composition relationship; use named fields when you want encapsulation.

## Struct comparison

Structs are comparable if all their fields are comparable:

```go
type Point struct {
    X, Y int
}

p1 := Point{1, 2}
p2 := Point{1, 2}
p3 := Point{3, 4}

fmt.Println(p1 == p2) // true
fmt.Println(p1 == p3) // false
```

Structs with slice, map, or function fields are not comparable and cause a compile error when using \`==\`.

## Structs as method receivers

Struct types are the most common method receivers. Every concept in Go — services, repositories, handlers, configs, models — is typically modelled as a struct with methods.

```go
// Repository pattern with struct methods
type ItemRepository struct {
    db *sql.DB
}

func (r *ItemRepository) FindByID(id int) (*Item, error) {
    row := r.db.QueryRow("SELECT id, name FROM items WHERE id = ?", id)
    var item Item
    err := row.Scan(&item.ID, &item.Name)
    if err != nil {
        return nil, err
    }
    return &item, nil
}

func (r *ItemRepository) Save(item *Item) error {
    _, err := r.db.Exec("INSERT INTO items (name) VALUES (?)", item.Name)
    return err
}
```

## Empty struct

`struct{}` is the empty struct — it occupies zero bytes of memory. It is used as a signal value, typically in channels or maps where only the key matters:

```go
// Set implementation using map
type Set struct {
    items map[string]struct{}
}

func (s *Set) Add(key string) {
    s.items[key] = struct{}{}
}

func (s *Set) Contains(key string) bool {
    _, ok := s.items[key]
    return ok
}


```

## Links to existing tiers

Both the [Beginner tier](../beginner/) and [Intermediate tier](../intermediate/) use structs extensively. The `Item` struct is the data model. The `Config` struct holds environment configuration. The `Store` interface (defined in the Intermediate tier) is implemented by a concrete struct with a pointer receiver. Method promotion is used when the store embeds a shared database handle.

This page explains the mechanics behind those patterns — why pointer receivers are used for `Store.Save()`, why struct tags control JSON field names, and how embedding composes behaviour without the complexity of inheritance.

---

**Next:** [05 Interfaces](./05-interfaces.md)
