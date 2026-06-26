<script setup lang="ts">
// Pills-in-the-box search. Renders the committed query as removable pills plus a trailing text
// input with autocomplete. Two-step disambiguation: a bare word offers field chips + a free-text
// fallback; Tab/Enter commits the highlighted suggestion. Backspace on an empty input removes the
// last pill. v-model is the query STRING (round-trips via the AST). Nuxt-UI-free; takes the engine
// `schema` as a prop (domain-agnostic).
import { computed, ref, watch } from 'vue'
import { astToPills, type Pill, removePill } from '@noy-db/ui'
import { buildSuggestions, type Suggestion } from '@noy-db/ui'
import { parse } from '@noy-db/ui'
import { resolve } from '@noy-db/ui'
import { serialize } from '@noy-db/ui'
import type { EntitySchema } from '@noy-db/ui'
import { useVoiceInput } from '../core/voice'
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
// host-supplied placeholder wins; otherwise the translated default
const effPlaceholder = computed(() => props.placeholder ?? t('nui.search.placeholder', 'Filter — type to search, Tab to add a pill…'))

const draft = ref('')
const open = ref(false)
const active = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

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

// Voice dictation → query term. The composable falls back to the browser Web Speech API unless the
// host injects a VoiceSource; the mic only shows when something is available. Interim transcript
// mirrors into the draft for live feedback; the final phrase is committed as a search term.
const { listening: micOn, transcript: micText, supported: micSupported, toggle: micToggle } = useVoiceInput({
  onFinal: (t) => { const s = t.trim(); if (s) setQuery(`${props.modelValue} ${s}`); draft.value = '' },
})
watch(micText, (t) => { if (micOn.value) draft.value = t })

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') { open.value = true; active.value = Math.min(active.value + 1, suggestions.value.length - 1); e.preventDefault() }
  else if (e.key === 'ArrowUp') { active.value = Math.max(active.value - 1, 0); e.preventDefault() }
  else if (e.key === 'Enter' || e.key === 'Tab') { if (draft.value.trim()) { commitDraft(); e.preventDefault() } }
  else if (e.key === 'Backspace' && !draft.value && pills.value.length) { remove(pills.value[pills.value.length - 1]!); e.preventDefault() }
  else if (e.key === 'Escape') { open.value = false }
}
function focusInput(): void { inputEl.value?.focus(); open.value = true }
function onInput(): void { open.value = true; active.value = 0 }

// pill tint by kind: filter predicates use the accent; sort/group/text use neutral surfaces.
const pillClass = (k: Pill['kind']): string =>
  (k === 'filter' || k === 'view') ? 'bg-nui-accent/15 text-nui-accent' : 'bg-nui-bg-accent text-nui-muted'
const hasContent = computed(() => pills.value.length > 0 || draft.value.length > 0)
</script>

<template>
  <div class="relative w-full max-w-3xl">
    <div
      class="flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-md ring ring-nui-border bg-nui-bg focus-within:(ring-2 ring-nui-accent) cursor-text"
      @click="focusInput"
    >
      <span class="i-lucide-filter size-4 text-nui-muted shrink-0 ms-1" aria-hidden="true" />
      <span v-for="pill in pills" :key="pill.id" class="nui-chip max-w-full" :class="pillClass(pill.kind)">
        <span class="truncate">{{ pill.label }}</span>
        <button type="button" class="ms-0.5 hover:opacity-70 shrink-0" :aria-label="`${t('nui.search.removePill', 'Remove')} ${pill.label}`" @click.stop="remove(pill)">
          <span class="i-lucide-x size-3" aria-hidden="true" />
        </button>
      </span>
      <input
        ref="inputEl"
        v-model="draft"
        type="text"
        class="flex-1 min-w-32 bg-transparent outline-none text-sm px-1 py-0.5"
        :placeholder="pills.length ? '' : effPlaceholder"
        @keydown="onKeydown"
        @input="onInput"
        @focus="open = true"
        @blur="open = false"
      >
      <button
        v-if="micSupported"
        type="button"
        class="nui-icon-btn size-6"
        :class="micOn ? 'text-red-500' : 'text-nui-muted'"
        :aria-label="micOn ? t('nui.voice.stop', 'Stop voice input') : t('nui.voice.search', 'Search by voice')"
        :aria-pressed="micOn"
        @click.stop="micToggle"
      >
        <span class="i-lucide-mic size-3.5" :class="micOn ? 'animate-pulse' : ''" aria-hidden="true" />
      </button>
      <button
        v-if="hasContent"
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
