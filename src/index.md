---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Golang Documentation"
  tagline: Part of the Learning Docs hub.
  actions:
    - theme: brand
      text: Introduction
      link: /introduction/
    - theme: alt
      text: Getting Started
      link: /introduction/getting-started
    - theme: alt
      text: Hub
      link: https://alibaihaqi.github.io/learning-docs/

features:
  - title: Beginner tier
    details: Ladder from zero to a curl-able JSON endpoint built on net/http.
    link: /beginner/
  - title: Intermediate tier
    details: Extend the beginner endpoint into a CRUD /items API backed by SQLite — store layer, config, and table-driven tests. Pure Go, no cgo.
    link: /intermediate/
  - title: Advanced tier
    details: Production-ready REST API — PostgreSQL, JWT auth, middleware, Docker, integration tests, benchmarks, graceful shutdown, and CI/CD.
    link: /advanced/
  - title: Go Language
    details: From zero values to CGO interop — a complete tour of the Go programming language.
    link: /go-language/
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);

  --vp-home-hero-name-background-image: linear-gradient(-45deg, #bd34fe 50%, #47caff 50%);
}
</style>