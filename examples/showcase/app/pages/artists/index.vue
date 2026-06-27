<script setup lang="ts">
import { ref } from 'vue'
import { useCollectionList } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildSimpleView } from '../../lib/simpleView'

const { vault } = useVault()
if (!vault.value) await navigateTo('/')

const view = buildSimpleView(vault.value!, 'artists')
const baseRows = ref(view.rows)
const query = ref('')

const list = useCollectionList({
  baseRows,
  query,
  entity: 'artists',
  columns: view.columns,
  defaultSort: [{ field: 'name', dir: 'asc' }],
  schema: view.schema,
})
</script>

<template>
  <section class="p-4 space-y-4">
    <SearchBox
      v-model="query"
      :schema="view.schema"
      :rows="list.visibleRows.value"
      :columns="view.columns"
    />
    <CollectionList
      :columns="view.columns"
      :rows="list.visibleRows.value"
      :sort-key="list.sortKey.value"
      :sort-dir="list.sortDir.value"
      :sort-keys="list.sortKeys.value"
      :sort-locked="list.sortLocked.value"
      :filters="list.columnFilters.value"
      :enum-facets="list.enumFacets.value"
      row-noun="artists"
      @sort="list.onSort"
      @filter-change="(p) => list.setColumnFilter(p.key, p.value)"
    />
  </section>
</template>
