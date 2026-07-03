<script setup lang="ts">
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'

const route = useRoute()
const { vault } = useVault()

const id = route.params.id as string
const record = await vault.value!.collection('records').get(id, { locale: 'raw' })
const { fieldLabel } = useShowcaseI18n()
// re-label per active locale (fieldLabel reads the locale ref -> computed re-tracks)
const fields = computed(() => vault.value!.collection('records').describe().fields.map((f) => {
  const l = fieldLabel('records', f.key)
  return l === f.key ? f : { ...f, label: l }
}))
</script>

<template>
  <article v-if="record" class="p-4 space-y-6">
    <NuxtLink to="/records" class="text-sm text-nui-accent hover:underline">← records</NuxtLink>
    <CoverImage :id="id" />
    <RecordDetail
      :record="record"
      :fields="fields"
      :route-for="(c: string, i: string) => `/${c}/${i}`"
      @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
    />
  </article>
  <p v-else class="p-4">Not found.</p>
</template>
