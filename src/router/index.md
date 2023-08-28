# General Info

Basically, to generate simple REST API for golang is quite easy. You can use built-in package under Golang library.
1. HandleFunc: it used to register the API pattern, handle the API request and response
2. ListenAndServe: the purpose is very straightforward where we want to run the application on specific "port" in our local or production.

```go
package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	/**
	 * "/api": route for REST API
	 */
	http.HandleFunc("/api", simpleApi)

	/**
	 * First param: Listener, which port do you want your application to run
	 * Second param: Handler, if you have custom handler, you can pass the handler or pass "nil" if you use default
	 * ListenAndServe throw an error, don't forget to handle it if the error isn't nil
	 */
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Error when listen and serve: %s", err.Error())
	}
}

/**
 * "w": will be used to generate response
 * "r": will be used as all request parameters such as method, headers, body request, etc.
 * if you don't use the variable, don't forget to change it to "_"
 */
func simpleApi(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "API response!")
}

```