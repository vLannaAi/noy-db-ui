<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCollectionList, enumBreakdown, findByQuery, buildNlPrompt, extractDsl, validateDsl } from '@noy-db/ui'
import type { FilterChip } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildRecordsView } from '../../lib/collectionView'
import { COVER_FIELD } from '../../../src/data/vault'
import { useTour } from '../../composables/useTour'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'
import { useSavedSearches } from '../../composables/useSavedSearches'
import { useRecentSearches } from '../../composables/useRecentSearches'
import { useApiKey } from '../../composables/useApiKey'

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

// StatCards: computed from visible rows so they react to search/filter.
const stats = computed(() => {
  const rows = list.visibleRows.value
  const count = rows.length
  const totalValue = rows.reduce((s, r) => s + (Number(r.priceUsd) || 0), 0)
  const distinctArtists = new Set(rows.map((r) => r.artist_name)).size
  const rated = rows.filter((r) => r.rating != null && r.rating !== '')
  const avgRating = rated.length ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length : 0
  const favorites = rows.filter((r) => r.favorite === true).length
  return { count, totalValue, distinctArtists, avgRating, favorites }
})

// Saved & recent searches
const { saved, add: addSaved, rename: renameSaved, remove: removeSaved, toggleFavorite, setDefault } = useSavedSearches('records')
const { recents, remove: removeRecent, clear: clearRecent } = useRecentSearches(query)

// currentSaved: true when the current query matches an already-saved search
const currentSaved = computed(() => !!findByQuery(saved.value, 'records', query.value.trim()))

// Column chooser: columns mapped to {key, label} (skip the empty cover label column)
const columnList = computed(() =>
  view.value.columns
    .filter((c) => c.label)
    .map((c) => ({ key: c.key, label: c.label as string })),
)

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

// NL search — useLlm() must be called during setup (uses inject internally).
const { hasKey, saveKey, forgetKey } = useApiKey()
const llm = useLlm()
const nlLoading = ref(false)
const nlError = ref('')
const nlNote = ref('')

async function runNlSearch(payload: { nl: string; refine: boolean }) {
  if (!llm) return
  nlLoading.value = true
  nlError.value = ''
  nlNote.value = ''
  try {
    const { system, user } = buildNlPrompt(view.value.schema, payload.nl, {
      currentDsl: payload.refine ? query.value : undefined,
    })
    const raw = await llm.complete({ system, user })
    const rawDsl = extractDsl(raw)
    const { dsl, unknownFields } = validateDsl(rawDsl, view.value.schema)
    if (unknownFields.length) nlNote.value = `Ignored unknown fields: ${unknownFields.join(', ')}`
    query.value = dsl
  } catch (e: unknown) {
    nlError.value = e instanceof Error ? e.message : 'Search failed'
  } finally {
    nlLoading.value = false
  }
}

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
    <!-- StatCard strip: reacts to active filters/search -->
    <div style="display:flex; flex-wrap:wrap; gap:var(--nui-space-3, 0.75rem)">
      <StatCard
        :label="t('stat.records', 'Records')"
        :value="stats.count"
        icon="i-lucide-disc-3"
        color="primary"
        style="flex:1; min-width:140px"
      />
      <StatCard
        :label="t('stat.value', 'Collection value')"
        :value="'$' + stats.totalValue.toFixed(0)"
        icon="i-lucide-dollar-sign"
        color="success"
        style="flex:1; min-width:140px"
      />
      <StatCard
        :label="t('stat.artists', 'Artists')"
        :value="stats.distinctArtists"
        icon="i-lucide-mic-2"
        color="info"
        style="flex:1; min-width:140px"
      />
      <StatCard
        :label="t('stat.avgRating', 'Avg rating')"
        :value="stats.avgRating.toFixed(1) + ' ★'"
        icon="i-lucide-star"
        color="warning"
        style="flex:1; min-width:140px"
      />
      <StatCard
        :label="t('stat.favorites', 'Favorites')"
        :value="stats.favorites"
        icon="i-lucide-heart"
        color="error"
        style="flex:1; min-width:140px"
      />
    </div>

    <!-- Control bar: column chooser, group-by, saved searches, recent searches, AI search -->
    <div class="flex flex-wrap items-center gap-2" data-tour="toolbar">
      <GroupByControl
        :fields="list.groupableFields.value"
        :active="list.groupFields.value"
        @toggle="list.toggleGroupField"
        @clear="list.clearGroups"
        @expand-all="list.expandAll"
        @collapse-level="list.collapseToLevel"
      />
      <ColumnChooser
        :columns="columnList"
        :show="list.columnPrefShow.value"
        :hide="list.columnPrefHide.value"
        @cycle="list.cycleColumnPref"
        @reset="list.resetColumnPrefs"
      />
      <SavedSearchMenu
        :schema="view.schema"
        :saved="saved"
        :current-query="query"
        :current-saved="currentSaved"
        @run="query = $event"
        @save="(name) => addSaved(query, name)"
        @rename="({ id, name }) => renameSaved(id, name)"
        @remove="removeSaved"
        @toggle-favorite="toggleFavorite"
        @set-default="setDefault"
      />
      <RecentSearchMenu
        :schema="view.schema"
        :recents="recents"
        @apply="query = $event"
        @remove="removeRecent"
        @clear="clearRecent"
      />
      <NlSearchButton
        :has-key="hasKey"
        :loading="nlLoading"
        :error="nlError"
        :note="nlNote"
        :has-current-query="!!query"
        @save-key="saveKey"
        @forget-key="forgetKey"
        @search="runNlSearch"
      />
    </div>

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
        <template #empty>
          <EmptyState
            icon="i-lucide-search-x"
            :title="t('empty.title', 'No records match')"
            :description="t('empty.body', 'Try clearing a filter or the search.')"
          />
        </template>
      </CollectionList>
    </div>
  </section>
</template>

<style>
/* Cover column needs a fixed width so the 38px thumbnail isn't clamped by the
   empty-label cell. Global (unscoped) because the <td> is rendered by CollectionList. */
.nui-col-cover {
  width: 56px;
  min-width: 56px;
  text-align: center;
}

/* Ellipsis on long text columns. Caps the cell width and truncates overflow. */
.nui-col-ellipsis { max-width: 220px; }
.nui-col-ellipsis > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
</style>
