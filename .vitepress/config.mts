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
      { text: 'Beginner', link: '/beginner/' }
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
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/alibaihaqi' },
      { icon: 'linkedin', link: 'https://www.linkedin.com/in/alibaihaqi/' }
    ]
  }
})
