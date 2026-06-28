<script setup lang="ts">
// Pills-in-the-box search. Renders the committed query as removable pills plus a trailing text
// input with autocomplete. Two-step disambiguation: a bare word offers field chips + a free-text
// fallback; Tab/Enter commits the highlighted suggestion. Backspace on an empty input removes the
// last pill. v-model is the query STRING (round-trips via the AST). Nuxt-UI-free; takes the engine
// `schema` as a prop (domain-agnostic).
import { computed, ref } from 'vue'
import { astToPills, type Pill, removePill } from '@noy-db/ui'
import { buildSuggestions, type Suggestion } from '@noy-db/ui'
import { parse } from '@noy-db/ui'
import { resolve } from '@noy-db/ui'
import { serialize } from '@noy-db/ui'
import type { EntitySchema } from '@noy-db/ui'
import { useNuiI18n } from '../core/i18n'

const props = withDefaults(defineProps<{
  modelValue: string
  schema: EntitySchema
  /** Source rows, used to derive entity/enum facet values for value suggestions. */
  rows?: readonly Record<string, any>[]
  /** Column list (key+label) so show:/hide: can suggest every column, incl. derived ones. */
  columns?: { key: string; label: string }[]
  placeholder?: string
}>(), { rows: () => [], columns: () => [] })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useNuiI18n()
const effPlaceholder = computed(() => props.placeholder ?? t('nui.search.placeholder', 'Filter — type to search, Tab to add a pill…'))

const draft = ref('')
const open = ref(false)
const active = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
const focused = ref(false)

const ast = computed(() => resolve(parse(props.modelValue).ast, props.schema))
const pills = computed(() => astToPills(ast.value, props.schema))

const facets = computed<Record<string, string[]>>(() => {
  const out: Record<string, string[]> = {}
  for (const f of props.schema.fields) {
    if (f.type !== 'entity' && f.type !== 'enum') continue
    const set = new Set<string>()
    for (const r of props.rows) { const v = r[f.rowKey ?? f.id]; if (v != null && v !== '') set.add(String(v)) }
    out[f.id] = [...set].sort()
  }
  return out
})

const suggestions = computed<Suggestion[]>(() => buildSuggestions(draft.value, props.schema, facets.value, undefined, props.columns))

function setQuery(q: string): void { emit('update:modelValue', q.trim()) }
function accept(s: Suggestion): void {
  if (s.caretAfter === 'value') { draft.value = s.token; focusInput(); return }
  setQuery(`${props.modelValue} ${s.token}`)
  draft.value = ''
  active.value = 0
}
function commitDraft(): void {
  const d = draft.value.trim()
  if (!d) return
  if (open.value && suggestions.value.length) { accept(suggestions.value[Math.min(active.value, suggestions.value.length - 1)]!); return }
  setQuery(`${props.modelValue} ${d}`)
  draft.value = ''
}
function remove(pill: Pill): void { setQuery(serialize(removePill(ast.value, pill))) }
function clearAll(): void { setQuery(''); draft.value = '' }

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') { open.value = true; active.value = Math.min(active.value + 1, suggestions.value.length - 1); e.preventDefault() }
  else if (e.key === 'ArrowUp') { active.value = Math.max(active.value - 1, 0); e.preventDefault() }
  else if (e.key === 'Enter' || e.key === 'Tab') { if (draft.value.trim()) { commitDraft(); e.preventDefault() } }
  else if (e.key === 'Backspace' && !draft.value && pills.value.length) { remove(pills.value[pills.value.length - 1]!); e.preventDefault() }
  else if (e.key === 'Escape') { open.value = false; inputEl.value?.blur() }
}
function focusInput(): void { inputEl.value?.focus(); open.value = true }
function onInput(): void { open.value = true; active.value = 0 }

// Track focus state on the container, not just the input. This lets clicks on pill remove
// buttons not cause a false blur (relatedTarget stays inside the container).
function onContainerFocusIn(): void {
  focused.value = true
}
function onContainerFocusOut(e: FocusEvent): void {
  if (!(e.currentTarget as Element).contains(e.relatedTarget as Node | null)) {
    focused.value = false
    open.value = false
  }
}

const pillClass = (k: Pill['kind']): string =>
  (k === 'filter' || k === 'view') ? 'bg-nui-accent/15 text-nui-accent' : 'bg-nui-bg-accent text-nui-muted'
</script>

<template>
  <div
    class="nui-search-root relative w-full max-w-3xl"
    @focusin="onContainerFocusIn"
    @focusout="onContainerFocusOut"
  >
    <div
      class="nui-search-inner flex flex-wrap items-center gap-1 px-2 py-1.5 cursor-text"
      :class="{ 'nui-search-inner--on': focused }"
      @click="focusInput"
    >
      <!-- Pills: inline text at rest, capsules while editing.
           The × button uses visibility (not v-if) so the chip never changes size — text stays
           pixel-stable when toggling between rest and edit modes. -->
      <template v-for="(pill, i) in pills" :key="pill.id">
        <span class="nui-chip max-w-full" :class="pillClass(pill.kind)">
          <span class="truncate">{{ pill.label }}</span>
          <button
            type="button"
            class="ms-0.5 hover:opacity-70 shrink-0"
            :style="{ visibility: focused ? 'visible' : 'hidden', pointerEvents: focused ? 'auto' : 'none' }"
            :aria-label="`${t('nui.search.removePill', 'Remove')} ${pill.label}`"
            @click.stop="remove(pill)"
          >
            <span class="i-lucide-x size-3" aria-hidden="true" />
          </button>
        </span>
        <!-- Comma between pills — only shown at rest (hidden by CSS when focused) -->
        <span v-if="i < pills.length - 1" class="nui-pill-sep" aria-hidden="true">,</span>
      </template>

      <!-- Text input: fills space in edit mode, zero-width invisible at rest -->
      <input
        ref="inputEl"
        v-model="draft"
        type="text"
        :class="[
          'bg-transparent outline-none text-sm px-1 py-0.5',
          focused ? 'flex-1 min-w-32 nui-search-input--on' : 'w-0 opacity-0 pointer-events-none overflow-hidden'
        ]"
        :placeholder="focused ? (pills.length ? '' : effPlaceholder) : ''"
        @keydown="onKeydown"
        @input="onInput"
        @focus="open = true"
        @blur="open = false"
      >

      <!-- Placeholder shown at rest when nothing is typed or committed -->
      <span
        v-if="!focused && !pills.length"
        class="text-nui-subtle text-sm px-1 select-none"
      >{{ effPlaceholder }}</span>

      <!-- Clear: only visible while editing -->
      <button
        v-if="focused && (pills.length || draft.length)"
        type="button"
        class="nui-icon-btn text-nui-muted size-6"
        :aria-label="t('nui.search.clearFilters', 'Clear all filters')"
        @click.stop="clearAll"
      >
        <span class="i-lucide-x size-3.5" aria-hidden="true" />
      </button>
    </div>

    <ul
      v-if="open && suggestions.length"
      class="nui-panel absolute z-20 mt-1 w-full max-w-md max-h-72 overflow-y-auto py-1"
      role="listbox"
    >
      <li
        v-for="(s, i) in suggestions"
        :key="s.token"
        :class="['flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer', i === active ? 'bg-nui-bg-accent' : 'hover:bg-nui-bg-accent']"
        role="option"
        :aria-selected="i === active"
        @mousedown.prevent="accept(s)"
        @mouseenter="active = i"
      >
        <span class="flex-1 truncate">{{ s.label }}</span>
        <span v-if="s.hint" class="text-[11px] uppercase tracking-wide text-nui-muted shrink-0">{{ s.hint }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* ── Container: borderless at rest, outlined ring when editing ───────────── */

.nui-search-inner {
  border-radius: var(--radius-control);
  transition: background 0.15s, box-shadow 0.15s;
}

.nui-search-inner--on {
  background: var(--nui-bg);
  box-shadow: 0 0 0 2px var(--nui-accent);
}

/* ── Pills: transparent at rest, coloured when editing ───────────────────── */
/* Specificity beats the bg-nui-* utility class (2 classes + 1 attr vs 1 class). */

.nui-search-inner:not(.nui-search-inner--on) .nui-chip {
  background: transparent !important;
}

/* ── Comma separators: visible at rest, hidden when editing ──────────────── */

.nui-pill-sep {
  color: var(--nui-muted);
  font-size: 0.75rem;
  line-height: 1;
  align-self: center;
  transition: opacity 0.1s;
}

.nui-search-inner--on .nui-pill-sep {
  display: none;
}

/* ── Dotted baseline on the text input area while editing ────────────────── */

.nui-search-input--on {
  border-bottom: 1.5px dashed color-mix(in srgb, var(--nui-accent) 45%, transparent);
}
</style>
