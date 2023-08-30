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
	mux.HandleFunc("/simple-api", handlers.SimpleApi).Methods(http.MethodGet) // To specify method you expect to be open
	mux.HandleFunc("/api-with-param/{param_id:[a-z]+}", handlers.ApiWithParam).Methods(http.MethodGet)

	// Start the server
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatalf("Error when listen and serve: %s", err.Error())
	}
}

```

## Handler Files

The handler files responsibility is to handle logic operations until we return the response to the client

```go
package handlers

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"github.com/gorilla/mux"
	"net/http"
)

type CommonResponse struct {
	Success bool   `json:"success" xml:"success"`
	Message string `json:"message" xml:"message"`
	ParamId string `json:"paramId,omitempty" xml:"paramId,omitempty"`
}

func SimpleApi(w http.ResponseWriter, r *http.Request) {
	resp := CommonResponse{
		Success: true,
		Message: "API Response",
	}

	GenerateResponse(w, r, resp)
}

func ApiWithParam(w http.ResponseWriter, r *http.Request) {
	// Mux will handle the parameter sent through http request
	vars := mux.Vars(r)
	resp := CommonResponse{
		Success: true,
		Message: "API Response",
		ParamId: vars["param_id"], // Get the property based on parameter sent from the client
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