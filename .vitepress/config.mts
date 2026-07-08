import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/golang-docs/',
  cleanUrls: true,
  lang: 'en-US',
  lastUpdated: true,
  srcDir: 'src',

  locales: {
    root: {
      label: 'English',
      lang: 'en'
    },
    // fr: {
    //   label: 'French',
    //   lang: 'fr', // optional, will be added  as `lang` attribute on `html` tag
    // }
  },
  
  title: 'Golang Documentation',
  description: 'Golang Documentation Collection',

  head: [
    ['link', { rel: 'icon', href: 'https://www.alibaihaqi.com/favicon.ico' }]
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Introduction', link: '/introduction/' },
      { text: 'Beginner', link: '/beginner/' },
      { text: 'Intermediate', link: '/intermediate/' },
      { text: 'Advanced', link: '/advanced/' },
      { text: 'Go', link: '/go-language/' }
    ],

    search: {
      provider: 'local',
    },

    footer: {
      copyright: 'Copyright © 2023 - Present by Fadli Al Baihaqi'
    },

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Introduction', link: '/introduction/' },
          { text: 'Getting Started', link: '/introduction/getting-started' }
        ]
      },
      {
        text: 'Beginner',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/beginner/' },
          { text: '01 Install Go', link: '/beginner/01-install-go' },
          { text: '02 Hello world', link: '/beginner/02-hello-world' },
          { text: '03 Types and variables', link: '/beginner/03-types-and-variables' },
          { text: '04 Control flow', link: '/beginner/04-control-flow' },
          { text: '05 Functions', link: '/beginner/05-functions' },
          { text: '06 Structs', link: '/beginner/06-structs' },
          { text: '07 Slices', link: '/beginner/07-slices' },
          { text: '08 Hello HTTP', link: '/beginner/08-hello-http' },
          { text: '09 JSON encoding', link: '/beginner/09-json-encoding' },
          { text: '10 Serving JSON', link: '/beginner/10-serving-json' },
        ]
      },
      {
        text: 'Intermediate',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/intermediate/' },
          { text: '01 Why persistence', link: '/intermediate/01-why-persistence' },
          { text: '02 Project setup', link: '/intermediate/02-project-setup' },
          { text: '03 Schema', link: '/intermediate/03-schema' },
          { text: '04 Store layer', link: '/intermediate/04-store-layer' },
          { text: '05 List and get handlers', link: '/intermediate/05-list-get-handlers' },
          { text: '06 Create handler', link: '/intermediate/06-create-handler' },
          { text: '07 Config', link: '/intermediate/07-config' },
          { text: '08 Tests', link: '/intermediate/08-tests' },
        ]
      },
      {
        text: 'Advanced',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/advanced/' },
          { text: '01 Why PostgreSQL', link: '/advanced/01-why-postgresql' },
          { text: '02 Migrate to PostgreSQL', link: '/advanced/02-migrate-to-postgresql' },
          { text: '03 HTTP middleware', link: '/advanced/03-http-middleware' },
          { text: '04 JWT auth middleware', link: '/advanced/04-jwt-auth-middleware' },
          { text: '05 Rate limiting', link: '/advanced/05-rate-limiting' },
          { text: '06 Docker multistage', link: '/advanced/06-docker-multistage' },
          { text: '07 Integration tests', link: '/advanced/07-integration-tests' },
          { text: '08 Benchmarks and profiling', link: '/advanced/08-benchmarks-and-profiling' },
          { text: '09 Graceful shutdown', link: '/advanced/09-graceful-shutdown' },
          { text: '10 CI/CD GitHub Actions', link: '/advanced/10-ci-cd-github-actions' },
        ]
      },
      {
        text: 'Go Language',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/go-language/' },
          { text: '01 Why Go', link: '/go-language/01-why-go' },
          { text: '02 Types and constants', link: '/go-language/02-types-and-constants' },
          { text: '03 Control flow and functions', link: '/go-language/03-control-flow-and-functions' },
          { text: '04 Structs and methods', link: '/go-language/04-structs-and-methods' },
          { text: '05 Interfaces', link: '/go-language/05-interfaces' },
          { text: '06 Generics', link: '/go-language/06-generics' },
          { text: '07 Error handling', link: '/go-language/07-error-handling' },
          { text: '08 Packages and modules', link: '/go-language/08-packages-and-modules' },
          { text: '09 Goroutines and channels', link: '/go-language/09-goroutines-and-channels' },
          { text: '10 Sync primitives and Context', link: '/go-language/10-sync-primitives-and-context' },
          { text: '11 Standard library tour', link: '/go-language/11-standard-library-tour' },
          { text: '12 Testing and benchmarking', link: '/go-language/12-testing-and-benchmarking' },
          { text: '13 Reflection and code generation', link: '/go-language/13-reflection-and-code-generation' },
          { text: '14 CGO and interop', link: '/go-language/14-cgo-and-interop' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/alibaihaqi' },
      { icon: 'linkedin', link: 'https://www.linkedin.com/in/alibaihaqi/' }
    ]
  }
})
