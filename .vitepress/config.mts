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
    ['link', { rel: 'icon', href: '/assets/favicon.ico' }]
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Introduction', link: '/introduction/' },
      { text: 'Basic', link: '/basic/' }
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2023-Present Fadli Al Baihaqi'
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
        text: 'Basic Knowledge',
        collapsed: false,
        items: [
          { text: 'General Info', link: '/basic/' },
          { text: 'Types', link: '/basic/types' },
          { text: 'Variables', link: '/basic/variables' },
          { text: 'Looping', link: '/basic/looping' },
        ]
      },
      {
        text: 'Router',
        collapsed: false,
        items: [
          { text: 'General Info', link: '/router/' },
          { text: 'JSON & XML Encoding', link: '/router/json-xml-encoding' },
          { text: 'Mux Implementation', link: '/router/mux-implementation' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
