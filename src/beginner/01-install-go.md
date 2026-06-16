---
title: Install Go
tier: beginner
platform: golang
position: 1
---

# Install Go

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Beginner › Install Go

**Goal**

Install the Go toolchain. After this page you will have `go` on your PATH and a version printed in your terminal.

**Prerequisites**

- None. This is the first page of the Beginner tier.

## What gets installed

The Go toolchain is one tarball or installer that drops three things on disk: the `go` command (your build / run / test entry point), the standard library, and the runtime. There is no separate package manager to install — `go` does that itself.

## Install

Follow the [official installer](https://go.dev/doc/install) for your platform. Pin Go 1.22 or newer; every code sample in this tier targets that.

## Verify

Open a fresh terminal and run:

```
go version
```

Expected output (your minor version may differ):

```
go version go1.22.5 darwin/amd64
```

If you get `command not found`, your shell didn't pick up the install path. Open a new terminal window — most installers update the PATH for new shells only.

**For frontend developers**

`go` is one binary that plays the role `node`, `npm`, and `tsc` play together: it runs your program, fetches dependencies, and compiles. There is nothing else to install.

**Next** → [Hello world](./02-hello-world.md)
