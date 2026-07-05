---
title: JWT auth middleware
tier: advanced
platform: golang
position: 4
---

# JWT auth middleware

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › JWT auth middleware

**Goal**

Add JWT bearer token authentication. Protected endpoints reject unauthenticated requests with 401.

**Prerequisites**

- [HTTP middleware](./03-http-middleware.md)

## Add the JWT library

```bash
go get github.com/golang-jwt/jwt/v5
```

## Auth middleware

Create `auth.go`:

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = func() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		s = "dev-secret-do-not-use-in-production"
	}
	return []byte(s)
}()
```

The `auth` middleware extracts the `Authorization: Bearer <token>` header, validates the JWT, and stores the claims in the request context:

```go
func auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ah := r.Header.Get("Authorization")
		if ah == "" || !strings.HasPrefix(ah, "Bearer ") {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		token, err := jwt.Parse(strings.TrimPrefix(ah, "Bearer "),
			func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return jwtSecret, nil
			})
		if err != nil || !token.Valid {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

## Login endpoint

Add an unauthenticated endpoint that returns a token. In production this would verify a username/password; for this tier a simple POST to `/login` with any body returns a token:

Create `login.go`:

```go
package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type loginRequest struct {
	Username string `json:"username"`
}

type loginResponse struct {
	Token string `json:"token"`
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": req.Username,
		"exp": time.Now().Add(1 * time.Hour).Unix(),
	})
	signed, err := token.SignedString(jwtSecret)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(loginResponse{Token: signed})
}
```

## Wire protected routes

Update `main.go` to protect write endpoints with auth:

```go
mux.HandleFunc("POST /login", handleLogin)
mux.HandleFunc("GET /items", handleList(store))
mux.HandleFunc("GET /items/{id}", handleGet(store))
mux.Handle("POST /items", auth(http.HandlerFunc(handleCreate(store))))
```

## Checkpoint

```bash
go run .
# Get a token:
TOKEN=$(curl -s -X POST http://localhost:8080/login \
  -d '{"username":"alice"}' | gojq -r '.token')

# Protected endpoint works with token:
curl -i -X POST http://localhost:8080/items \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"laptop"}'

# Protected endpoint fails without token:
curl -i -X POST http://localhost:8080/items
# → 401 Unauthorized
```

**Next:** [Rate limiting](./05-rate-limiting.md) — protect against abuse with per-IP rate limits.
