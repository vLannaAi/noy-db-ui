<script setup lang="ts">
import { provideNoydbUi } from '@noy-db/ui-nuxt/core'

// TODO(Task 7): wire t + locale from useShowcaseI18n
provideNoydbUi({ theme: 'system', locale: 'en' })
</script>

<template><NuxtLayout><NuxtPage /></NuxtLayout></template>
