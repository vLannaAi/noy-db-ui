<script setup lang="ts">
import { provideNoydbUi } from '@noy-db/ui-nuxt/core'
import { useShowcaseI18n } from './composables/useShowcaseI18n'

const { locale, t } = useShowcaseI18n()
provideNoydbUi({ theme: 'system', locale: locale.value, t: (k, f) => t(`nui.${k}`, f) })
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
