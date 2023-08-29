# JSON Encoding

If you want to get JSON on API response, you need to custom your implementation.
1. You need to define your struct to be passed when generate JSON
2. Declare your response based on your struct
3. You need to custom your "Content-Type" to "application/json" because the default "Content-Type" is "text/plain; charset=utf-8"
4. Use built-in "encoding/json" module to generate the JSON

## Code Implementation
```go:line-numbers{17-18,25,29,36-38,46,48-51,60-61,64,66-69,72-73}
package main

import (
	"encoding/json"
	"encoding/xml"
	"log"
	"net/http"
)

// CommonResponse
/**
 * CommonResponse has two properties:
 * - Success -> boolean, if you don't use `json:"success"` for JSON or `xml:"success"` for XML, by default will return the same as property name "Success"
 * - Message -> string, if you don't use `json:"message"` for JSON or `xml:"message"` for XML, by default will return the same as property name "Message"
 */
type CommonResponse struct {
	Success bool   `json:"success" xml:"success"`
	Message string `json:"message" xml:"message"`
}

func main() {
	/**
	 * "/api-json": route for JSON REST API
	 */
	http.HandleFunc("/api-json", simpleJsonApi)
	/**
	 * "/api-xml": route for XML REST API
	 */
	http.HandleFunc("/api-xml", simpleXMLApi)

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

func simpleXMLApi(w http.ResponseWriter, r *http.Request) {
	// Variable Declaration used struct CommonResponse
	resp := CommonResponse{
		Success: true,
		Message: "API Response",
	}

	// Content-Type by default will return "text/plain; charset=utf-8" if you don't specify to XML directly
	w.Header().Add("Content-Type", "application/xml")
	xml.NewEncoder(w).Encode(resp)
}
```

## API Response
1. JSON API response without `json` implementation:

```json
{
  "Success": true,
  "Message": "API Response"
}
```

2. JSON API response with `json` implementation:

```json
{
  "success": true,
  "message": "API Response"
}
```

3. XML API response without `xml` implementation:

```xml
<CommonResponse>
  <Success>true</Success>
  <Message>API Response</Message>
</CommonResponse>
```

4. XML API response with `xml` implementation:

```xml
<CommonResponse>
  <success>true</success>
  <message>API Response</message>
</CommonResponse>
```