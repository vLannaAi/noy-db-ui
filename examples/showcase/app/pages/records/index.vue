<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCollectionList, enumBreakdown } from '@noy-db/ui'
import type { FilterChip } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildRecordsView } from '../../lib/collectionView'
import { COVER_FIELD } from '../../../src/data/vault'
import { useTour } from '../../composables/useTour'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'

const { vault } = useVault()
const { t, enumLabel, fieldLabel } = useShowcaseI18n()
const { start } = useTour()

const coverCell = `cell-${COVER_FIELD}`

// Reactive to locale: buildRecordsView reads locale.value inside fieldLabel, so this computed
// re-runs when locale changes, updating column labels. Enum row values stay canonical.
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

// Filter chips: one chip per active column filter with a human-readable summary.
const CHIP_DICT_KEYS: Record<string, string> = {
  genre: 'genre',
  format: 'format',
  condition: 'condition',
}

const chips = computed((): FilterChip[] =>
  Object.entries(list.columnFilters.value).map(([key, filter]) => {
    let text = ''
    if (filter.kind === 'enum' || filter.kind === 'entity') {
      const dictKey = CHIP_DICT_KEYS[key]
      text = filter.selected
        .map((v) => (dictKey ? enumLabel(dictKey, v) : v))
        .join(', ')
    } else if (filter.kind === 'date') {
      const parts: string[] = []
      if (filter.from) parts.push(`from ${filter.from}`)
      if (filter.to) parts.push(`to ${filter.to}`)
      text = parts.join(' ')
    }
    return { key, label: fieldLabel('records', key), text }
  })
)

// Second-header enum breakdown for genre (uses visible rows so it reflects active filters).
const subtotalEnums = computed(() => ({
  genre: {
    items: enumBreakdown(list.visibleRows.value, view.value.schema, 'genre'),
    distinctNoun: 'genres',
  },
}))

function recordsTourSteps() {
  return [
    { target: '[data-tour="search"]', title: t('tour.search.title', 'Search & Filter'), body: t('tour.search.body', 'Type to filter records or use the column filters for more precision.') },
    { target: '[data-tour="list"]', title: t('tour.list.title', 'Record Collection'), body: t('tour.list.body', 'Click a column header to sort. Shift-click to add a sort key. Click a row to view the full record detail.') },
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
        :entity-facets="list.entityFacets.value"
        :chips="chips"
        :group-lines="list.groupLines.value"
        :grouped-keys="list.groupedColumnKeys.value"
        :subtotal-enums="subtotalEnums"
        :all-collapsed="list.allTopCollapsed.value"
        :focus-keys="list.forceShowColumnKeys.value"
        :hide-keys="list.hideColumnKeys.value"
        :serial-index="true"
        row-noun="records"
        @sort="list.onSort"
        @lock-sort="list.onLockSort"
        @filter-change="(p) => list.setColumnFilter(p.key, p.value)"
        @remove-filter="(k) => list.setColumnFilter(k, null)"
        @clear-filters="list.clearAll"
        @toggle-group="list.toggleGroup"
        @toggle-collapse-all="list.toggleCollapseAll"
        @row-click="(r) => navigateTo(`/records/${r.id}`)"
      >
        <template #[coverCell]="{ row }">
          <span data-tour="cover">
            <CoverImage :id="row.id" :thumb="true" />
          </span>
        </template>
        <template #cell-genre="{ row }">{{ enumLabel('genre', String(row.genre ?? '')) }}</template>
        <template #cell-format="{ row }">{{ enumLabel('format', String(row.format ?? '')) }}</template>
        <template #cell-condition="{ row }">{{ enumLabel('condition', String(row.condition ?? '')) }}</template>
        <template #cell-priceUsd="{ row }">{{ '$' + Number(row.priceUsd).toFixed(0) }}</template>
        <template #cell-rating="{ row }">{{ '★'.repeat(Number(row.rating)) }}</template>
        <template #cell-favorite="{ row }">{{ row.favorite ? '★' : '–' }}</template>
        <template #cell-purchasedOn="{ row }">{{ row.purchasedOn }}</template>
      </CollectionList>
    </div>
  </section>
</template>
