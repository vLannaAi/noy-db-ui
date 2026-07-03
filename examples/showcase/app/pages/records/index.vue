<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useCollectionList, findByQuery, narrate } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildRecordsView } from '../../lib/collectionView'
import { COVER_FIELD } from '../../../src/data/vault'
import { useTour } from '../../composables/useTour'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'
import { useSavedSearches } from '../../composables/useSavedSearches'
import { useRecentSearches } from '../../composables/useRecentSearches'

const { vault } = useVault()
const { t, enumLabel, locale } = useShowcaseI18n()

// Short, language-neutral format abbreviations for the compressed cell (12-inch → 12″, Single → 1T).
const FORMAT_ABBR: Record<string, string> = { LP: 'LP', EP: 'EP', Single: '1T', '12"': '12″' }
const formatAbbr = (v: string): string => FORMAT_ABBR[v] ?? v

// Duration: decimal minutes → M′SS″ (prime = minutes, double-prime = seconds), e.g. 47.3 → 47′18″.
function fmtDuration(min: unknown): string {
  const total = Math.round(Number(min) * 60)
  return `${Math.floor(total / 60)}′${String(total % 60).padStart(2, '0')}″`
}
const { start } = useTour()

const coverCell = `cell-${COVER_FIELD}`

// Reactive to locale: buildRecordsView reads locale.value inside fieldLabel, so this computed
// re-runs when locale changes, updating column labels. Enum row values stay canonical.
const view = computed(() => buildRecordsView(vault.value!))
const baseRows = computed(() => view.value.rows as Record<string, any>[])
const query = ref('')

// Canonical value → display name (entity FK name, localized enum label, or currency symbol).
// Shared by group banners, pills and the fluent search title so "jazz" reads "Jazz", an FK id
// reads its record name, and a price value reads "$50".
const labelForValue = (field: string, value: string): string | undefined => {
  if (field === 'priceUsd') return `$${value}`
  return view.value.entityName(field, value) ?? (enumLabel(field, value) || undefined)
}

const list = useCollectionList({
  baseRows,
  query,
  entity: 'records',
  columns: view.value.columns,
  defaultSort: [{ field: 'title', dir: 'asc' }],
  schema: () => view.value.schema, // getter: field labels are locale-reactive
  formatGroupLabel: labelForValue,
})

// Fluent search description (narrate): the compact title drives the window title (history
// navigation, printed report header); the subtitle is the full sentence for the page subhead.
const searchText = computed(() => narrate(list.ast.value, view.value.schema, { t, formatValue: labelForValue }))
useHead({ title: () => (searchText.value.title ? `${searchText.value.title} · noy-db` : 'noy-db · Vinyl') })

// Print: the report header below is hidden on screen and materializes in print (see themes.css
// @media print) — the fluent title IS the report title (contract I1 extends to paper).
const printPage = (): void => window.print()
const printedAt = () => new Date().toLocaleString(locale.value === 'th' ? 'th-TH' : 'en-US')

// Saved & recent searches
const { saved, add: addSaved, rename: renameSaved, remove: removeSaved, toggleFavorite, setDefault } = useSavedSearches('records')
const { recents, remove: removeRecent, clear: clearRecent } = useRecentSearches(query)

// currentSaved: true when the current query matches an already-saved search
const currentSaved = computed(() => !!findByQuery(saved.value, 'records', query.value.trim()))

// Column chooser — type icons and default visibility per column
type ColViz = 'essential' | 'show-sm' | 'show-lg' | 'hidden'

const COL_DEFAULTS: Record<string, ColViz> = {
  [COVER_FIELD]: 'show-sm',
  title:         'essential',
  artist_name:   'essential',
  label_name:    'show-lg',
  year:          'show-sm',
  genre:         'show-sm',
  format:        'show-lg',
  condition:     'show-lg',
  rating:        'show-sm',
  durationMin:   'show-lg',
  trackCount:    'hidden',
  priceUsd:      'show-lg',
  purchasedOn:   'hidden',
  favorite:      'show-sm',
}

const columnStates = ref<Record<string, ColViz>>({})
const columnOrder  = ref<string[]>([])
const resizing     = ref(false) // "Adjust widths" mode, entered from the column chooser

// Persisted column-width overrides from the "Adjust widths" mode (per column: pct or fixed px).
const WIDTHS_KEY = 'nui.widths.records'
const columnWidths = ref<Record<string, { mode: 'pct' | 'fixed'; value: number }>>(
  typeof localStorage !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem(WIDTHS_KEY) || '{}') } catch { return {} } })()
    : {},
)
watch(columnWidths, (w) => {
  if (typeof localStorage !== 'undefined') try { localStorage.setItem(WIDTHS_KEY, JSON.stringify(w)) } catch { /* quota */ }
}, { deep: true })

const columnList = computed(() =>
  view.value.columns.map((c) => ({
    key:     c.key,
    label:   (c.label as string) || 'Cover',
    icon:    c.icon,
    default: COL_DEFAULTS[c.key] as ColViz | undefined,
  })),
)

// Apply user-defined column order to the table
const orderedViewColumns = computed(() => {
  if (!columnOrder.value.length) return view.value.columns
  const idx = new Map(columnOrder.value.map((k, i) => [k, i]))
  return [...view.value.columns].sort(
    (a, b) => (idx.get(a.key) ?? 999) - (idx.get(b.key) ?? 999),
  )
})

// Map new 4-state system → focus-keys / hide-keys for CollectionList
const colFocusKeys = computed(() =>
  Object.entries(columnStates.value)
    .filter(([, v]) => v === 'essential' || v === 'show-sm')
    .map(([k]) => k),
)
const colHideKeys = computed(() =>
  Object.entries(columnStates.value)
    .filter(([, v]) => v === 'hidden')
    .map(([k]) => k),
)

function onColSetState(key: string, state: ColViz | null): void {
  if (state === null) {
    const next = { ...columnStates.value }
    delete next[key]
    columnStates.value = next
  } else {
    columnStates.value = { ...columnStates.value, [key]: state }
  }
}
function onColReset(): void { columnStates.value = {}; columnOrder.value = [] }
function onColReorder(keys: string[]): void { columnOrder.value = keys }

// Search voices + morphing reset + key sheet + `/` focus — shared across list pages (spec:
// docs/superpowers/specs/2026-07-02-search-toolbar-interaction-design.md).
const {
  searchBox, searchMode, nlLoading, nlError, nlNote, needKey, keyDraft, keyEl, hasKey,
  onModeChange, onAsk, onAbortAsk, saveKeyDraft,
  micOn, micSupported, onSpeakStart, onSpeakStop,
  resetFace, onReset,
} = useSearchVoices(query, () => view.value.schema)

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
    <!-- Print-only report header: the same fluent language, on paper. -->
    <header class="print-header">
      <h1>{{ searchText.title || 'All records' }}</h1>
      <p>{{ searchText.subtitle }}</p>
      <p class="print-meta">{{ list.visibleRows.value.length }} {{ t('print.records', 'records') }} · {{ printedAt() }}</p>
    </header>
    <!-- Unified toolbar (spec §1): the title/search field fills the width; the rail reads as a
         sentence — EXPRESS (mode capsule) │ SHAPE (group) │ MEMORY (saved, recent) │ RESET. -->
    <div class="relative flex items-center gap-2 print-hide" data-tour="toolbar">
      <div class="flex-1 min-w-0" data-tour="search">
        <SearchBox
          ref="searchBox"
          v-model="query"
          :schema="view.schema"
          :rows="list.visibleRows.value"
          :columns="view.columns"
          :format-value="labelForValue"
          :inline-clear="false"
          :mode="searchMode"
          :busy="nlLoading"
          @ask="onAsk"
          @abort-ask="onAbortAsk"
        />
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <!-- EXPRESS: the three voices, one capsule -->
        <SearchModeGroup
          :mode="searchMode"
          :listening="micOn"
          :busy="nlLoading"
          :mic-supported="micSupported"
          @update:mode="onModeChange"
          @speak-start="onSpeakStart"
          @speak-stop="onSpeakStop"
        />
        <span class="w-px h-5 shrink-0" :style="{ background: 'var(--hairline)' }" aria-hidden="true" />
        <!-- SHAPE -->
        <GroupByControl
          :fields="list.groupableFields.value"
          :active="list.groupFields.value"
          @toggle="list.toggleGroupField"
          @clear="list.clearGroups"
          @expand-all="list.expandAll"
          @collapse-level="list.collapseToLevel"
        />
        <span class="w-px h-5 shrink-0" :style="{ background: 'var(--hairline)' }" aria-hidden="true" />
        <!-- MEMORY -->
        <SavedSearchMenu
          :schema="view.schema"
          :saved="saved"
          :current-query="query"
          :current-saved="currentSaved"
          :format-value="labelForValue"
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
          :format-value="labelForValue"
          @apply="query = $event"
          @remove="removeRecent"
          @clear="clearRecent"
        />
        <button
          type="button"
          class="nui-btn text-nui-muted hover:bg-nui-bg-accent"
          :aria-label="t('toolbar.print', 'Print this view')"
          :title="t('toolbar.print', 'Print this view')"
          @click="printPage"
        >
          <span class="i-lucide-printer size-[1.3125rem]" aria-hidden="true" />
        </button>
        <span class="w-px h-5 shrink-0" :style="{ background: 'var(--hairline)' }" aria-hidden="true" />
        <!-- RESET: morphing icon — ✕ discards the draft (or aborts AI), 🗑 erases the search. -->
        <button
          type="button"
          class="nui-btn"
          :class="resetFace === 'none' ? 'text-nui-subtle opacity-40 pointer-events-none' : 'text-nui-muted hover:bg-nui-bg-accent'"
          :aria-label="resetFace === 'draft' ? t('toolbar.discardDraft', 'Discard draft') : t('toolbar.clearSearch', 'Clear search')"
          @mousedown.prevent
          @click="onReset"
        >
          <span :class="resetFace === 'draft' ? 'i-lucide-x' : 'i-lucide-trash-2'" class="size-[1.3125rem]" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- One-line notes under the toolbar: AI errors (auto-dismiss), validation notes, key entry. -->
    <!-- Status notes float over the content (zero-height strip): appearing/disappearing must
         never shift the table below — same no-shake rule as the title box itself. -->
    <div class="relative h-0 !mt-0 print-hide" style="z-index: 40">
      <p v-if="nlError" class="absolute top-1 left-0 nui-panel px-3 py-1.5 text-sm text-nui-accent">{{ nlError }}</p>
      <p v-else-if="nlNote" class="absolute top-1 left-0 nui-panel px-3 py-1.5 text-sm text-nui-muted">{{ nlNote }}</p>
      <div v-if="needKey && !hasKey" class="absolute top-1 left-0 nui-panel px-3 py-2 flex items-center gap-2">
      <span class="text-sm text-nui-muted">{{ t('nl.needKey', 'AI needs an Anthropic API key (stored locally):') }}</span>
      <input
        ref="keyEl"
        v-model="keyDraft"
        type="password"
        placeholder="sk-…"
        class="text-sm w-64 px-2 py-1 rounded border border-nui-border bg-nui-bg outline-none focus:border-nui-accent"
        @keydown.enter.prevent="saveKeyDraft"
      >
      <button type="button" class="nui-btn-ghost" @click="saveKeyDraft">{{ t('nui.save', 'Save') }}</button>
      <button type="button" class="nui-btn-ghost text-nui-muted" @click="needKey = false">{{ t('nl.later', 'Later') }}</button>
      </div>
    </div>
    <div data-tour="list" class="nui-records-list">
      <CollectionList
        :columns="orderedViewColumns"
        :rows="list.visibleRows.value"
        v-model:resizing="resizing"
        v-model:widths="columnWidths"
        :sort-key="list.sortKey.value"
        :sort-dir="list.sortDir.value"
        :sort-keys="list.sortKeys.value"
        :sort-locked="list.sortLocked.value"
        :filters="list.columnFilters.value"
        :enum-facets="list.enumFacets.value"
        :entity-facets="list.entityFacets.value"
        :group-lines="list.groupLines.value"
        :grouped-keys="list.groupedColumnKeys.value"
        :all-collapsed="list.allTopCollapsed.value"
        :focus-keys="colFocusKeys"
        :hide-keys="colHideKeys"
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
        <template #serial-header>
          <ColumnChooser
            :columns="columnList"
            :states="columnStates"
            :order="columnOrder"
            @set-state="onColSetState"
            @reset="onColReset"
            @reorder="onColReorder"
            @adjust-widths="resizing = true"
          />
        </template>
        <template #[coverCell]="{ row }">
          <span data-tour="cover">
            <CoverImage :id="row.id" :thumb="true" />
          </span>
        </template>
        <!-- Title: width-aware. The cover gives the row 2 lines of height, so the title WRAPS before it
             condenses or ellipsizes (lines=2). -->
        <template #cell-title="{ row }">
          <NuiText :value="row.title" kind="text" :lines="2" class="font-medium" />
        </template>
        <!-- Year: abbreviates 2026 → ’26 when the column gets tight. -->
        <template #cell-year="{ row }">
          <NuiText :value="row.year" kind="year" align="right" />
        </template>
        <!-- Entity links: the name wraps to 2 lines (cover height) before ellipsis, like the title. -->
        <template #cell-artist_name="{ row }">
          <a
            v-if="row.artist_name"
            class="nui-link block cursor-pointer"
            @click.stop="navigateTo(`/artists/${row.artistId}`)"
          >
            <NuiText :value="row.artist_name" kind="text" :lines="2" />
          </a>
          <span v-else class="text-nui-subtle">—</span>
        </template>
        <template #cell-label_name="{ row }">
          <a
            v-if="row.label_name"
            class="nui-link block cursor-pointer"
            @click.stop="navigateTo(`/labels/${row.labelId}`)"
          >
            <NuiText :value="row.label_name" kind="text" :lines="2" />
          </a>
          <span v-else class="text-nui-subtle">—</span>
        </template>
        <template #cell-genre="{ row }">{{ enumLabel('genre', String(row.genre ?? '')) }}</template>
        <!-- Format: full label → short abbreviation (12-inch → 12″, Single → 1T) as it tightens. -->
        <template #cell-format="{ row }">
          <NuiText :reps="[enumLabel('format', String(row.format)), formatAbbr(String(row.format))]" />
        </template>
        <template #cell-condition="{ row }">{{ enumLabel('condition', String(row.condition ?? '')) }}</template>
        <!-- Symbols ($, ★, min, ♥) live once in the header; cells carry bare values, uniformly. -->
        <template #cell-priceUsd="{ row }"><span class="tabular-nums">{{ Number(row.priceUsd).toFixed(0) }}</span></template>
        <!-- Rating: one representation per column by width — full stars when there's room (≥88px),
             else the bare number. The header ★ labels the column either way. -->
        <template #cell-rating="{ row, width }"><span class="tabular-nums">{{ (width ?? 0) >= 88 ? '★'.repeat(Number(row.rating)) : Number(row.rating) }}</span></template>
        <template #cell-favorite="{ row }"><span class="text-data">{{ row.favorite ? '♥' : '' }}</span></template>
        <!-- Duration in min′sec″ (prime/double-prime); header carries the "min" unit. -->
        <template #cell-durationMin="{ row }"><span class="tabular-nums">{{ fmtDuration(row.durationMin) }}</span></template>
        <!-- Date: abbreviates the long ISO → "Sep 14, 2023" → "Sep 14" → "9/14/23" as it tightens. -->
        <template #cell-purchasedOn="{ row }">
          <NuiText :value="row.purchasedOn" kind="date" />
        </template>
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

/* Small screens (≤ 640px): the table goes full-bleed — cancel the section's 1rem side padding so it
   reaches the screen edges. Pairs with the table dropping its ring/radius at small tiers. */
@media (max-width: 640px) {
  .nui-records-list { margin-inline: -1rem; }
}
</style>
