<script setup lang="ts">
import { useRecordItem } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'

const route = useRoute()
const { vault } = useVault()
const { fieldLabel, locale } = useShowcaseI18n()

const id = route.params.id as string
const records = vault.value!.collection('records')

const item = useRecordItem({ collection: records, id })
await item.load()

// async describe({}) → validator-derived optional + constraints drive the hints
const described = await records.describe({})
const fields = computed(() => described.fields.map((f) => {
  const l = fieldLabel('records', f.key)
  return l === f.key ? f : { ...f, label: l }
}))

// ref-select options: entity pickers fed by the target collections (localized names)
const artistRows = await vault.value!.collection('artists').list({ locale: locale.value }) as { id: string; name: string }[]
const labelRows = await vault.value!.collection('labels').list({ locale: locale.value }) as { id: string; name: string }[]
const options = {
  artistId: artistRows.map((a) => ({ value: a.id, label: a.name })),
  labelId: labelRows.map((l) => ({ value: l.id, label: l.name })),
}
</script>

<template>
  <article v-if="item.record.value" class="p-4 space-y-6">
    <NuxtLink to="/records" class="text-sm text-nui-accent hover:underline">← records</NuxtLink>
    <CoverImage :id="id" />
    <RecordDetail
      :record="item.record.value"
      :fields="fields"
      editable
      :editing="item.editing.value"
      :draft="item.draft.value"
      :errors="item.errors.value"
      :error-banner="item.errorBanner.value"
      :options="options"
      :submitting="item.submitting.value"
      :route-for="(c: string, i: string) => `/${c}/${i}`"
      @edit="item.enterEdit"
      @save="item.submit"
      @cancel="item.cancel"
      @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
    />
  </article>
  <p v-else class="p-4">Not found.</p>
</template>
