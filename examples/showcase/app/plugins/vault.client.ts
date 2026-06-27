import { provideNoydbUi } from '@noy-db/ui-nuxt/core'

export default defineNuxtPlugin(() => {
  // TODO(Task 7): wire t + locale from useShowcaseI18n
  provideNoydbUi({ theme: 'system', locale: 'en' })
})
