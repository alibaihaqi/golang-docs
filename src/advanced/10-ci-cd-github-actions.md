---
title: CI/CD GitHub Actions
tier: advanced
platform: golang
position: 10
---

# CI/CD GitHub Actions

[Hub](https://alibaihaqi.github.io/learning-docs/) › Golang › Advanced › CI/CD GitHub Actions

**Goal**

Add a GitHub Actions workflow that lints, tests (unit + integration), builds, and pushes a Docker image to GitHub Container Registry.

**Prerequisites**

- [Graceful shutdown](./09-graceful-shutdown.md)
- A GitHub repository with the Go module pushed

## The workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: pass
          POSTGRES_DB: itemsdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 2s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"

      - name: Lint
        uses: golangci/golangci-lint-action@v6
        with:
          version: latest

      - name: Unit tests
        run: go test -v -short -count=1 ./...
        env:
          DATABASE_URL: postgres://postgres:pass@localhost:5432/itemsdb?sslmode=disable

      - name: Build
        run: go build -o /dev/null .

  docker:
    if: github.ref == 'refs/heads/main'
    needs: ci
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
```

Key points:
- The `services.postgres` block starts a PostgreSQL container as a sidecar for integration tests.
- Unit tests pass via `-short` flag (you can skip Testcontainers-based tests with `testing.Short()`).
- Docker push runs only on `main` branch, after CI passes.
- The image is tagged with the commit SHA for traceability.

## Add build tags to tests

Update your integration tests to respect the `-short` flag:

```go
func TestStoreCreateAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	// ... rest of test
}
```

Now `go test -short ./...` skips Testcontainers tests (fast for CI lint), while `go test ./...` runs everything.

## Checkpoint

Push the code to GitHub and open a PR. The CI workflow runs automatically:

```bash
git push origin main
# Open https://github.com/<user>/<repo>/actions to see the workflow
```

The workflow should:
1. Start a PostgreSQL service container.
2. Run golangci-lint.
3. Run unit tests against the service PostgreSQL.
4. Build the binary.
5. On main branch: build and push Docker image to GHCR.

**You've completed the Golang Advanced tier.** The intermediate CLI script has grown into a production-ready REST API with PostgreSQL, JWT auth, middleware, Docker, integration tests, benchmarks, graceful shutdown, and CI/CD.
