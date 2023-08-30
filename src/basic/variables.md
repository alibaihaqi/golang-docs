# Variable Declaration

There are few ways to declare variable in Golang

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
