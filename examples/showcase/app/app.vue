<script setup lang="ts">
import { provideNoydbUi } from '@noy-db/ui-nuxt/core'
import { useShowcaseI18n } from './composables/useShowcaseI18n'

const { locale, t, setLocale } = useShowcaseI18n()
provideNoydbUi({ theme: 'system', locale: locale.value, t: (k, f) => t(`nui.${k}`, f) })
</script>

<template>
  <select
    data-tour="lang"
    :value="locale"
    style="position:fixed;top:0.5rem;right:0.5rem;z-index:1000;font-size:0.75rem;padding:0.125rem 0.25rem;"
    @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'th')"
  >
    <option value="en">EN</option>
    <option value="th">TH</option>
  </select>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
