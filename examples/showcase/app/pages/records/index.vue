<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCollectionList } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildRecordsView } from '../../lib/collectionView'
import { COVER_FIELD } from '../../../src/data/vault'

const { vault } = useVault()

const coverCell = `cell-${COVER_FIELD}`

// Reactive to locale: buildRecordsView reads locale.value inside, so this computed
// re-runs when locale changes, updating column labels and localized enum cell values.
const view = computed(() => buildRecordsView(vault.value!))
const baseRows = computed(() => view.value.rows as Record<string, any>[])
const query = ref('')

const list = useCollectionList({
  baseRows,
  query,
  entity: 'records',
  columns: view.value.columns,
  defaultSort: [{ field: 'title', dir: 'asc' }],
  schema: view.value.schema,
})
</script>

<template>
  <section class="p-4 space-y-4">
    <SearchBox
      v-model="query"
      :schema="view.schema"
      :rows="list.visibleRows.value"
      :columns="view.columns"
      data-tour="search"
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
      row-noun="records"
      data-tour="list"
      @sort="list.onSort"
      @filter-change="(p) => list.setColumnFilter(p.key, p.value)"
      @row-click="(r) => navigateTo(`/records/${r.id}`)"
    >
      <template #[coverCell]="{ row }">
        <CoverImage :id="row.id" :thumb="true" />
      </template>
    </CollectionList>
  </section>
</template>
