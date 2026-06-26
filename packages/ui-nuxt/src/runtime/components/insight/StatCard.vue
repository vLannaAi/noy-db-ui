<script setup lang="ts">
// A single KPI/metric card: label + big value + optional sub-value + a tinted icon badge.
// Nuxt-UI-free (nui-panel surface; preset-wind4 color utilities for the badge tints).
defineProps<{
  label: string
  value: string | number
  subValue?: string
  icon?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
}>()
</script>

<template>
  <div class="nui-panel p-4">
    <div class="flex items-start gap-4">
      <div
        v-if="icon"
        class="size-12 rounded-xl flex items-center justify-center shrink-0"
        :class="{
          'bg-nui-bg-accent text-nui-accent': color === 'primary' || !color,
          'bg-green-100 text-green-600': color === 'success',
          'bg-amber-100 text-amber-600': color === 'warning',
          'bg-red-100 text-red-600': color === 'error',
          'bg-sky-100 text-sky-600': color === 'info',
        }"
      >
        <span :class="[icon, 'size-6']" aria-hidden="true" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-nui-muted truncate">{{ label }}</p>
        <p class="text-2xl font-bold mt-1 text-nui-fg">{{ value }}</p>
        <p v-if="subValue" class="text-xs text-nui-muted mt-1">{{ subValue }}</p>
      </div>
    </div>
  </div>
</template>
