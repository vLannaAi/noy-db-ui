<script setup lang="ts">
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'

const route = useRoute()
const { vault } = useVault()
const { locale } = useShowcaseI18n()

const id = route.params.id as string
const record = await vault.value!.collection('artists').get(id, { locale: locale.value })
const fields = vault.value!.collection('artists').describe().fields
</script>

<template>
  <article v-if="record" class="p-4 space-y-6">
    <NuxtLink to="/artists" class="text-sm text-nui-accent hover:underline">← artists</NuxtLink>
    <RecordDetail
      :record="record"
      :fields="fields"
      :route-for="(c: string, i: string) => `/${c}/${i}`"
      @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
    />
  </article>
  <p v-else class="p-4">Not found.</p>
</template>
