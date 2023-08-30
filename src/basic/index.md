# Basic Implementation

We'll explore basic knowledge of Golang programming languages.
1. [Variable Declaration](/basic/variables),
2. [Looping](/basic/looping),

```go
package main

import "fmt"

func main() {
	// Golang will check the type directly
	num := 1
	fmt.Println(num)

	// You define the type when declare the variable
	var num32 int32 = 2
	fmt.Println(num32)

	// Generate multiple variables
	var h, w = "Hello", "World!"
	fmt.Println(h, w)
}
```