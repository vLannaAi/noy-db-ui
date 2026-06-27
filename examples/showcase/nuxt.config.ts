export default defineNuxtConfig({
  ssr: false,
  modules: ['@noy-db/ui-nuxt/module'],
  noydbUi: { theme: 'system', locale: 'en' },
  app: { head: { title: 'noy-db · Vinyl' } },
  compatibilityDate: '2025-01-01',
})
