<script setup lang="ts" generic="T extends Record<string, any>">
// The collection list table: a lean styled <table> driven by columns + rows + cell slots, with a
// sticky accent header, an optional sticky subtotal/aggregate row, responsive column dropping +
// xs-stacking, and collapse-aware grouped rendering. Nuxt-UI-free (UnoCSS + --nui tokens + the
// hand-rolled Popover-based header filters).
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { AppColumn, SubtotalEnum } from '@noy-db/ui'
import type { ColumnFilterValue, EntityFacets, Facet, FilterChip } from '@noy-db/ui'
import type { SortKey } from '@noy-db/ui'
import type { DisplayLine } from '@noy-db/ui'
import { columnAggregate } from '@noy-db/ui'
import { resolveResponsiveColumns, shouldStack, applyStacking } from '@noy-db/ui'
import FilterChips from '../internal/FilterChips.vue'
import ColumnHeader from '../internal/ColumnHeader.vue'
import HeaderFilterCell from '../internal/HeaderFilterCell.vue'
import { useNuiI18n } from '../core/i18n'

const { t } = useNuiI18n()
const props = withDefaults(defineProps<{
  columns: AppColumn[]
  rows: T[]
  rowKey?: (row: T) => string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc' | null
  /** Full multi-sort list (priority order) — drives numbered header badges. */
  sortKeys?: SortKey[]
  /** Sort is "locked"/multi → show position numbers on sorted columns. */
  sortLocked?: boolean
  // interactive headers (all optional — omit for a plain sortable table)
  filters?: Record<string, ColumnFilterValue>
  enumFacets?: Record<string, Facet[]>
  entityFacets?: Record<string, EntityFacets>
  chips?: FilterChip[]
  /** Leading serial-index column (display index 1..N of the visible rows). On by default. */
  serialIndex?: boolean
  /** When set, rows are rendered grouped: a flattened, collapse-aware list of banner + row lines. */
  groupLines?: DisplayLine<T>[]
  /** Per-column enum breakdowns shown in the second-header row (keyed by column key). */
  subtotalEnums?: Record<string, SubtotalEnum>
  /** Plural noun for the visible-row count shown in the second header ("sales"). */
  rowNoun?: string
  /** Cap on how many (ungrouped) rows are rendered; aggregates still use ALL rows. Default: all. */
  displayLimit?: number
  /** Column keys hidden because they are the active group-by field(s) — their value shows in the
   *  group banner instead, so the dedicated column would be redundant. */
  groupedKeys?: string[]
  /** Grouped + every main group collapsed → the header arrow shows "expand", else "collapse all". */
  allCollapsed?: boolean
  /** Column keys to force-visible regardless of width: search-driven "focus" columns + show: tokens (R4/R5). */
  focusKeys?: string[]
  /** Column keys to force-hidden via hide: tokens (R5) — removed even if core (force-show wins). */
  hideKeys?: string[]
}>(), { serialIndex: true, rowNoun: 'rows' })

// Measure the table container so responsive resolution can drop low-relevance columns as it narrows.
const wrapperEl = ref<HTMLElement | null>(null)
const containerWidth = ref(Infinity)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (wrapperEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => { containerWidth.value = entries[0]!.contentRect.width })
    ro.observe(wrapperEl.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

const showSerial = () => props.serialIndex

const layout = computed<{ columns: AppColumn[]; folds: Record<string, string> }>(() => {
  const afterGroup = props.groupedKeys && props.groupedKeys.length
    ? props.columns.filter((c) => !props.groupedKeys!.includes(c.key))
    : props.columns
  const forceShow = new Set(props.focusKeys ?? [])
  const responsive = resolveResponsiveColumns(afterGroup, containerWidth.value, forceShow)
  const hidden = new Set(props.hideKeys ?? [])
  const afterHide = hidden.size ? responsive.filter((c) => !hidden.has(c.key)) : responsive
  return applyStacking(afterHide, shouldStack(containerWidth.value), hidden, forceShow)
})
const visibleColumns = (): AppColumn[] => layout.value.columns
const foldedColOf = (col: AppColumn): AppColumn | null => {
  const key = layout.value.folds[col.key]
  return key ? props.columns.find((c) => c.key === key) ?? null : null
}
const bodyColspan = () => visibleColumns().length + (props.serialIndex ? 1 : 0)

const emit = defineEmits<{
  sort: [payload: { key: string; additive?: boolean }]
  lockSort: [payload: { key: string }]
  rowClick: [row: T]
  filterChange: [payload: { key: string; value: ColumnFilterValue | null }]
  removeFilter: [key: string]
  clearFilters: []
  toggleGroup: [id: string]
  toggleCollapseAll: []
}>()

const isGrouped = () => !!(props.groupLines && props.groupLines.length)
const indentStyle = (level: number) => (level > 0 ? { paddingInlineStart: `${0.75 + level * 1.25}rem` } : undefined)

const agg = (col: AppColumn) => columnAggregate(props.rows, col)
const foldedAgg = (col: AppColumn) => { const f = foldedColOf(col); return f ? columnAggregate(props.rows, f) : null }
const aggAlign = (col: AppColumn): string =>
  (props.subtotalEnums?.[col.key] ? (col.align === 'right' ? 'text-right' : 'text-left')
    : agg(col)?.numeric ? 'text-right' : (col.align === 'right' ? 'text-right' : 'text-left'))
const hasSubtotalRow = () =>
  props.rows.length > 0 && (props.columns.some((c) => c.aggregate) || !!props.subtotalEnums)
const groupCellAlign = (col: AppColumn, groupField: string): string =>
  (col.key === groupField ? 'text-left' : col.aggregate ? 'text-right' : (col.align === 'right' ? 'text-right' : 'text-left'))
</script>

<template>
  <FilterChips
    v-if="chips && chips.length"
    :chips="chips"
    @remove="emit('removeFilter', $event)"
    @clear-all="emit('clearFilters')"
  />
  <div ref="wrapperEl" class="@container sm:rounded-lg sm:ring sm:ring-nui-border bg-nui-bg">
    <table class="w-full text-sm border-collapse">
      <thead class="sticky top-16 z-10 bg-nui-accent text-nui-accent-fg text-sm sm:rounded-t-lg">
        <tr>
          <th v-if="showSerial()" class="px-3 py-2.5 font-normal text-right w-px" :aria-label="t('nui.list.rowNumber', 'Row number')">#</th>
          <th
            v-for="col in visibleColumns()"
            :key="col.key"
            class="px-3 py-2.5 font-normal"
            :class="[col.align === 'right' ? 'text-right' : 'text-left', col.class]"
            :aria-sort="sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : (col.sortable || col.filter === 'date' ? 'none' : undefined)"
          >
            <ColumnHeader
              :column="col"
              :sort-keys="sortKeys"
              :sort-key="sortKey"
              :sort-dir="sortDir"
              :numbered="sortLocked || (sortKeys?.length ?? 0) > 1"
              :sub-label="foldedColOf(col)?.label"
              @sort="emit('sort', $event)"
              @lock-sort="emit('lockSort', $event)"
            />
          </th>
        </tr>
        <tr v-if="hasSubtotalRow()" class="subtotal-row">
          <td v-if="showSerial()" class="px-3 py-1.5 w-px text-center">
            <button
              v-if="isGrouped()"
              type="button"
              class="inline-flex items-center justify-center hover:opacity-70 align-middle text-nui-muted"
              :aria-label="allCollapsed ? t('nui.list.expandGroups', 'Expand all groups') : t('nui.list.collapseGroups', 'Collapse all groups')"
              :title="allCollapsed ? t('nui.list.expandGroups', 'Expand all groups') : t('nui.list.collapseGroups', 'Collapse all groups')"
              @click="emit('toggleCollapseAll')"
            >
              <span class="size-4" :class="allCollapsed ? 'i-lucide-chevrons-up-down' : 'i-lucide-chevrons-down-up'" aria-hidden="true" />
            </button>
          </td>
          <td
            v-for="col in visibleColumns()"
            :key="col.key"
            class="px-3 py-1.5 align-middle"
            :class="[aggAlign(col), col.class]"
          >
            <div class="inline-flex items-center gap-1.5" :class="aggAlign(col) === 'text-right' ? 'flex-row-reverse' : ''">
              <HeaderFilterCell
                v-if="col.filter"
                :column="col"
                :filter="filters?.[col.key]"
                :enum-facets="enumFacets?.[col.key]"
                :entity-facets="entityFacets?.[col.key]"
                @filter-change="emit('filterChange', $event)"
              />
              <span v-if="subtotalEnums?.[col.key]" class="text-xs text-nui-muted leading-snug">
                <template v-for="(it, i) in subtotalEnums[col.key]!.items" :key="it.value"><span v-if="i" class="opacity-50"> · </span><span class="whitespace-nowrap"><span class="font-semibold text-nui-fg">{{ it.count }}</span> {{ it.label ?? it.value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) }}</span></template>
              </span>
              <span
                v-else-if="agg(col)"
                class="whitespace-nowrap tabular-nums"
                :class="col.aggregate === 'sum' || col.aggregate === 'count' ? 'text-sm font-semibold' : 'text-xs text-nui-muted'"
                :title="agg(col)!.title"
              >{{ agg(col)!.text }}</span>
            </div>
            <div v-if="foldedAgg(col)" class="text-[11px] text-nui-muted tabular-nums leading-tight" :class="aggAlign(col)" :title="foldedAgg(col)!.title">{{ foldedAgg(col)!.text }}</div>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td :colspan="bodyColspan()" class="px-3 py-6">
            <slot name="empty"><p class="text-center text-nui-muted">{{ t('nui.list.noData', 'No data.') }}</p></slot>
          </td>
        </tr>

        <template v-if="isGrouped()">
          <template v-for="line in groupLines" :key="line.kind === 'group' ? line.id : (rowKey ? rowKey(line.row) : (line.row.id as string))">
            <tr
              v-if="line.kind === 'group'"
              class="group-row cursor-pointer select-none"
              :class="`group-level-${line.level}`"
              @click="emit('toggleGroup', line.id)"
            >
              <td v-if="showSerial()" class="px-3 py-2 w-px"></td>
              <td
                v-for="(col, ci) in visibleColumns()"
                :key="col.key"
                class="px-3 py-2 font-semibold whitespace-nowrap"
                :class="[ci === 0 ? 'text-left' : groupCellAlign(col, line.field), ci !== 0 && groupCellAlign(col, line.field) === 'text-right' ? 'tabular-nums' : '', col.class]"
                :style="ci === 0 ? indentStyle(line.level) : undefined"
              >
                <div v-if="ci === 0" class="flex items-center justify-between gap-2">
                  <span class="inline-flex items-center gap-1 min-w-0">
                    <span class="tabular-nums text-nui-muted shrink-0">{{ line.serial }}.</span>
                    <span class="size-3.5 shrink-0 text-nui-muted" :class="line.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" aria-hidden="true" />
                    <span class="truncate">{{ line.label }}</span>
                  </span>
                  <span v-if="line.cells[col.key]" class="tabular-nums shrink-0">{{ line.cells[col.key] }}</span>
                </div>
                <template v-else>{{ line.cells[col.key] ?? '' }}</template>
                <div v-if="foldedColOf(col) && line.cells[foldedColOf(col)!.key]" class="text-xs font-normal text-nui-muted leading-tight" :class="ci === 0 ? 'text-right' : ''">{{ line.cells[foldedColOf(col)!.key] }}</div>
              </td>
            </tr>
            <tr
              v-else
              class="border-t border-nui-border hover:bg-nui-bg-accent transition-colors cursor-pointer"
              @click="emit('rowClick', line.row)"
            >
              <td v-if="showSerial()" class="px-3 py-2 text-right tabular-nums text-nui-muted w-px whitespace-nowrap ps-6">{{ line.serial }}</td>
              <td
                v-for="(col, ci) in visibleColumns()"
                :key="col.key"
                class="px-3 py-2 whitespace-nowrap"
                :class="[col.align === 'right' ? 'text-right tabular-nums' : 'text-left', col.class]"
                :style="ci === 0 ? indentStyle(line.level) : undefined"
              >
                <slot :name="`cell-${col.key}`" :row="line.row">{{ line.row[col.key] ?? '' }}</slot>
                <div v-if="foldedColOf(col)" class="text-xs text-nui-muted leading-tight">
                  <slot :name="`cell-${foldedColOf(col)!.key}`" :row="line.row">{{ line.row[foldedColOf(col)!.key] ?? '' }}</slot>
                </div>
              </td>
            </tr>
          </template>
        </template>

        <tr
          v-for="(row, index) in (isGrouped() ? [] : rows.slice(0, displayLimit ?? rows.length))"
          :key="rowKey ? rowKey(row) : (row.id as string)"
          class="border-t border-nui-border hover:bg-nui-bg-accent transition-colors cursor-pointer"
          :class="index % 2 === 1 ? 'zebra' : ''"
          @click="emit('rowClick', row)"
        >
          <td v-if="showSerial()" class="px-3 py-2 text-right tabular-nums text-nui-muted w-px whitespace-nowrap">{{ index + 1 }}</td>
          <td
            v-for="col in visibleColumns()"
            :key="col.key"
            class="px-3 py-2 whitespace-nowrap"
            :class="[col.align === 'right' ? 'text-right tabular-nums' : 'text-left', col.class]"
          >
            <slot :name="`cell-${col.key}`" :row="row">{{ row[col.key] ?? '' }}</slot>
            <div v-if="foldedColOf(col)" class="text-xs text-nui-muted leading-tight">
              <slot :name="`cell-${foldedColOf(col)!.key}`" :row="row">{{ row[foldedColOf(col)!.key] ?? '' }}</slot>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <slot name="after" />
  </div>
</template>

<style scoped>
@container (max-width: 28rem) {
  th, td { padding-left: 0.4rem; padding-right: 0.4rem; }
}
/* Second-header (subtotal) row: a light accent tint, overriding the header, with normal text. */
.subtotal-row td {
  background: color-mix(in srgb, var(--nui-accent) 10%, var(--nui-bg));
  color: var(--nui-fg);
  border-top: 1px solid color-mix(in srgb, var(--nui-accent) 25%, var(--nui-bg));
}
.zebra {
  background: color-mix(in srgb, var(--nui-accent) 4%, var(--nui-bg));
}
/* Group banner rows: stronger accent tint + top divider; deeper levels tint lighter. */
.group-row td {
  background: color-mix(in srgb, var(--nui-accent) 14%, var(--nui-bg));
  border-top: 2px solid color-mix(in srgb, var(--nui-accent) 30%, var(--nui-bg));
}
.group-row.group-level-1 td {
  background: color-mix(in srgb, var(--nui-accent) 9%, var(--nui-bg));
  border-top-color: color-mix(in srgb, var(--nui-accent) 20%, var(--nui-bg));
}
.group-row.group-level-2 td {
  background: color-mix(in srgb, var(--nui-accent) 6%, var(--nui-bg));
  border-top-color: color-mix(in srgb, var(--nui-accent) 14%, var(--nui-bg));
}
thead th:first-child { border-top-left-radius: 0.5rem; }
thead th:last-child { border-top-right-radius: 0.5rem; }
</style>
