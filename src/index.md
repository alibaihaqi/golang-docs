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
#   - title: Feature C
#     details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);

  --vp-home-hero-name-background-image: linear-gradient(-45deg, #bd34fe 50%, #47caff 50%);
}
</style>