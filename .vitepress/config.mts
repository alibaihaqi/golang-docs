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
      { text: 'Advanced', link: '/advanced/' }
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
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/alibaihaqi' },
      { icon: 'linkedin', link: 'https://www.linkedin.com/in/alibaihaqi/' }
    ]
  }
})
