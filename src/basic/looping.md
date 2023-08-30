# Looping

1. Three-component loop
```go
package main

import "fmt"

func main() {
	sum := 0

	for i := 1; i < 10; i++ {
		sum += i
	}

	fmt.Println(sum) // 45 (1+2+3+4+...+10)
}
```

2. While loop

```go
package main

import "fmt"

func main() {
	n := 1

	for n < 9 {
		// Before Value: 1, 2, 4, 8
		n *= 2 // The value will be replaced to new value inside the loop
		// After Value: 2, 4, 8, 16
	}
	// Close the loop after reach 16

	fmt.Println("result:", n)
}
```

3. For-Each Loop

```go
package main

import "fmt"

func main() {
	sum := 0
	numbers := []int{2, 5, 6, 7, 8}

	for i, num := range numbers {
		sum += num
		fmt.Printf("Index: %d, Number: %d, Sum: %d\n", i, num, sum)
	}
}
```

Response
```bash
Index: 0, Number: 2, Sum: 2
Index: 1, Number: 5, Sum: 7
Index: 2, Number: 6, Sum: 13
Index: 3, Number: 7, Sum: 20
Index: 4, Number: 8, Sum: 28
```
