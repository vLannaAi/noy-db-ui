<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCollectionList } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildRecordsView } from '../../lib/collectionView'
import { COVER_FIELD } from '../../../src/data/vault'
import { useTour } from '../../composables/useTour'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'

const { vault } = useVault()
const { t } = useShowcaseI18n()
const { start } = useTour()

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

function recordsTourSteps() {
  return [
    { target: '[data-tour="search"]', title: t('tour.search.title', 'Search & Filter'), body: t('tour.search.body', 'Type to filter records or use the column filters for more precision.') },
    { target: '[data-tour="list"]', title: t('tour.list.title', 'Record Collection'), body: t('tour.list.body', 'Click a column header to sort. Click a row to view the full record detail.') },
    { target: '[data-tour="cover"]', title: t('tour.cover.title', 'Album Cover'), body: t('tour.cover.body', 'Cover art is decrypted from an encrypted vault blob — never stored in plaintext.') },
    { target: '[data-tour="theme"]', title: t('tour.theme.title', 'Theme'), body: t('tour.theme.body', 'Toggle between light and dark mode.') },
    { target: '[data-tour="lang"]', title: t('tour.lang.title', 'Language'), body: t('tour.lang.body', 'Switch the UI between English and Thai.') },
  ]
}

onMounted(() => {
  start(recordsTourSteps(), { key: 'records' })
})
</script>

<template>
  <section class="p-4 space-y-4">
    <div data-tour="search">
      <SearchBox
        v-model="query"
        :schema="view.schema"
        :rows="list.visibleRows.value"
        :columns="view.columns"
      />
    </div>
    <div data-tour="list">
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
        @sort="list.onSort"
        @filter-change="(p) => list.setColumnFilter(p.key, p.value)"
        @row-click="(r) => navigateTo(`/records/${r.id}`)"
      >
        <template #[coverCell]="{ row }">
          <CoverImage :id="row.id" :thumb="true" />
        </template>
      </CollectionList>
    </div>
  </section>
</template>
