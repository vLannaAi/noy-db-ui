<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useVault } from '../composables/useVault'
import { loadCoverBytes } from '../lib/cover'

const props = defineProps<{ id: string; thumb?: boolean }>()

const url = ref<string | null>(null)
const kb = ref(0)

const { vault } = useVault()

onMounted(async () => {
  if (!vault.value) return
  const bytes = await loadCoverBytes(vault.value, props.id)
  kb.value = Math.round(bytes.length / 1024)
  url.value = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
})

onUnmounted(() => {
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<template>
  <figure :class="thumb ? 'nui-cover-thumb' : 'nui-cover-hero'" data-tour="cover">
    <img v-if="url" :src="url" alt="cover" />
    <figcaption v-if="!thumb && url">decrypted from a vault blob · {{ kb }} KB</figcaption>
  </figure>
</template>
