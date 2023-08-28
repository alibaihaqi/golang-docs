# JSON Encoding

If you want to get JSON on API response, you need to custom your implementation.
1. You need to define your struct to be passed when generate JSON
2. Declare your response based on your struct
3. You need to custom your "Content-Type" to "application/json" because the default "Content-Type" is "text/plain; charset=utf-8"
4. Use built-in "encoding/json" module to generate the JSON

```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
)

// CommonResponse
/**
 * CommonResponse has two properties:
 * - Success -> boolean, if you don't use `json:"success"`, by default will return the same as property name "Success"
 * - Message -> string, if you don't use `json:"message"`, by default will return the same as property name "Message"
 */
type CommonResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func main() {
	/**
	 * "/api-json": route for REST API
	 */
	http.HandleFunc("/api-json", simpleJsonApi)

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
func simpleJsonApi(w http.ResponseWriter, r *http.Request) {
	// Variable Declaration used struct CommonResponse
	resp := CommonResponse{
		Success: true,
		Message: "API Response",
	}

	/**
	 * ResponseWriter has 3 functions, Write, Header, WriterHeader
	 * Header has capability to add, get, delete, or update the headers response
	 * WriterHeader is used to update status code if you want custom status code on API (default: 200)
	 *
	 * Content-Type by default will return "text/plain; charset=utf-8"
	 */
	w.Header().Add("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
```