export default defineNuxtConfig({
  ssr: false,
  modules: ['@noy-db/ui-nuxt/module'],
  noydbUi: { theme: 'system', locale: 'en' },
  css: ['~/assets/themes.css'],
  app: {
    head: {
      title: 'noy-db · Vinyl',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Anton&family=Public+Sans:wght@400;600;700&family=Saira:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@600;700;800&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap',
        },
      ],
    },
  },
  compatibilityDate: '2025-01-01',
})
