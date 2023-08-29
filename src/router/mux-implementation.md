# Mux Implementation

You can use golang public library to handle this route implementation. One of them is "Mux".

We simply can do in one file but to make it cleaner, we'll separate it to few files.

## Main File

The main file responsibility is only run the application.

::: details main.go
```go
package main

import "github.com/alibaihaqi/rest-api/app"

func main() {
	app.Start()
}
```
:::

## App File

The app responsibility is to main routers for the application

:::details app.go
```go
package app

import (
	"github.com/alibaihaqi/rest-api/handlers"
	"github.com/gorilla/mux"
	"log"
	"net/http"
)

func Start() {
	// initiate Mux Router
	mux := mux.NewRouter()

	// Define Routes
	mux.HandleFunc("/api-json", handlers.SimpleJsonApi)

	// Start the server
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatalf("Error when listen and serve: %s", err.Error())
	}
}
```
:::

## Handler Files

The handler files responsibility is to handle logic operations until we return the response to the client

:::details handler.go
```go
package handlers

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
)

type CommonResponse struct {
	Success bool   `json:"success" xml:"success"`
	Message string `json:"message" xml:"message"`
}

func SimpleJsonApi(w http.ResponseWriter, r *http.Request) {
	resp := CommonResponse{
		Success: true,
		Message: "API Response",
	}

	GenerateResponse(w, r, resp)
}

func GenerateResponse(w http.ResponseWriter, r *http.Request, i interface{}) {
	if r.Header.Get("Content-Type") == "application/xml" {
		w.Header().Add("Content-Type", "application/xml")
		xml.NewEncoder(w).Encode(i)
	} else if r.Header.Get("Content-Type") == "application/json" {
		w.Header().Add("Content-Type", "application/json")
		json.NewEncoder(w).Encode(i)
	} else {
		fmt.Fprintf(w, fmt.Sprintf("%s", i))
	}
}

```
:::