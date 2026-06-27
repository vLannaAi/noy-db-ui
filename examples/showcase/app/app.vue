<script setup lang="ts">
import { provideNoydbUi } from '@noy-db/ui-nuxt/core'
import { useShowcaseI18n } from './composables/useShowcaseI18n'
import { makeAnthropicLlm } from './lib/anthropicLlm'
import { useApiKey } from './composables/useApiKey'

const { locale, t } = useShowcaseI18n()
// TODO: key is BYO — the user pastes it via NlSearchButton; never hardcoded.
provideNoydbUi({
  theme: 'system',
  locale: locale.value,
  t: (k, f) => t(`nui.${k}`, f),
  llm: makeAnthropicLlm(() => useApiKey().key.value),
})
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
