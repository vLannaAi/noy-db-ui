# Item Release — Phase 3 (In-place Edit + Validation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** P3 of the Item Release spec (`docs/superpowers/specs/2026-07-03-item-release-design.md` §3): `RecordDetail` gains an in-place edit mode (widgets morph into the same grid cells), driven by a `useRecordItem` composable (draft/dirty/errors/submit through `collection.put()`), with noy-db as the validator of record and client-side hints from `describe({})` constraints.

**Architecture:** Mirror the list's engine→composable→component split: pure additions to `packages/ui/src/form.ts` (error mapping, widget kinds, hints), a `useRecordItem` composable in `packages/ui` (vue-reactive like `useCollectionList`, testable against a *structural* collection fake — no vault needed), a shared `internal/FieldControl.vue` widget renderer consumed by both `RecordDetail` (edit mode) and `RecordForm` (create), and showcase wiring with real zod constraints.

**Tech Stack:** TypeScript ESM, Vue 3 (`packages/ui` already has the vue peer), vitest, UnoCSS pre-compiled, pnpm + turbo. Hub floor `^0.3.0-pre.2` (already adopted).

## Global Constraints

- **Never** add Claude attribution to commits/PRs/CHANGELOGs.
- **Never** publish or merge to main without explicit user confirmation; work on a feature branch (`item-release-phase3`), PR at the end.
- `packages/ui/src` stays framework-free EXCEPT vue reactivity (precedent: `use-collection-list.ts`); no DOM/lifecycle APIs in `use-record-item.ts` so it runs in plain vitest.
- Validation is noy-db's job: no duplicate client-side validation logic — client shows *hints* only; `put()` errors flow back via `fieldErrors`.
- Colors/styling: only `--nui-*` tokens + existing `nui-*` shortcuts (`nui-field`, `nui-btn`, `nui-btn-ghost`, `nui-panel`); dark parity required; new icons must be added to the uno safelist.
- Showcase dev loop after library changes: root `pnpm build` → sync store copies of ui/ui-nuxt dist → clear `node_modules/.vite`, `node_modules/.cache/vite`, `.nuxt` → fresh browser context.
- Seed data must stay valid under any tightened zod schema (`pnpm seed` + showcase vitest must pass).

## File structure

| File | Responsibility |
|---|---|
| `packages/ui/src/form.ts` (modify) | + `fieldErrors` maps `MissingTranslationError`; + `InputKind 'i18n-text'`; + `FieldInput.locales/unit`; + `FieldHint`/`fieldHint()` |
| `packages/ui/src/use-record-item.ts` (create) | the edit state machine: record/load/editing/draft/dirty/errors/submit/cancel |
| `packages/ui/src/index.ts` (modify) | barrel exports |
| `packages/ui-nuxt/src/runtime/internal/FieldControl.vue` (create) | ONE widget renderer (text/textarea/number+unit/date/select/checkbox/i18n-text) + error/hint line |
| `packages/ui-nuxt/src/runtime/components/item/RecordForm.vue` (modify) | delegate its control switch to `FieldControl` (dedupe) |
| `packages/ui-nuxt/src/runtime/components/item/RecordDetail.vue` (modify) | `editing` mode: editable cells morph to `FieldControl`, Save/Cancel header, lock affordance on read-only fields |
| `packages/ui-nuxt/uno.config.ts` (modify) | safelist `i-lucide-lock` |
| `packages/ui-nuxt/src/runtime/core/locale-th.ts` (modify) | `nui.detail.readonly` TH string |
| `examples/showcase/src/data/types.ts` (modify) | real constraints on `RecordSchema` + new optional `shopUrl` (the url-pattern field) |
| `examples/showcase/src/data/{dataset,dicts,collections}.ts` (modify) | `shopUrl` seed values + label + fieldMeta |
| `examples/showcase/app/pages/records/[id].vue` (modify) | wire `useRecordItem` + editable RecordDetail + ref-select options |
| `docs/ui-nuxt/3.components.md`, `packages/*/CHANGELOG.md [Unreleased]` (modify) | docs |

---

### Task 1: `fieldErrors` maps `MissingTranslationError`

**Files:**
- Modify: `packages/ui/src/form.ts`
- Test: `packages/ui/src/form.test.ts` (extend)

**Interfaces:**
- Consumes: hub's `MissingTranslationError { field: string; missing: readonly string[]; message: string }` (duck-typed on `field` + array `missing`, same realm-resilience rationale as the existing `issues` duck-typing).
- Produces: `fieldErrors(err)` additionally returns `{ [err.field]: err.message }` for a missing-translation failure. Consumed by `useRecordItem` (Task 3).

- [ ] **Step 1: Write the failing test** — append to `packages/ui/src/form.test.ts`:

```ts
describe('fieldErrors — MissingTranslationError', () => {
  it('maps a missing-translation failure to its field', () => {
    const err = Object.assign(new Error('Field "title": missing required translation(s): th.'), {
      field: 'title',
      missing: ['th'],
    })
    expect(fieldErrors(err)).toEqual({ title: 'Field "title": missing required translation(s): th.' })
  })

  it('still returns {} for a plain error', () => {
    expect(fieldErrors(new Error('boom'))).toEqual({})
  })
})
```

- [ ] **Step 2: Verify red** — `pnpm vitest run packages/ui/src/form.test.ts` → the first new case FAILS (`{}` received).

- [ ] **Step 3: Implement** — in `form.ts`, replace the `fieldErrors` body's first lines:

```ts
export function fieldErrors(err: unknown): Record<string, string> {
  // i18n `required` violation: MissingTranslationError carries the offending field directly
  const mt = err as { field?: unknown; missing?: unknown; message?: unknown } | null | undefined
  if (typeof mt?.field === 'string' && Array.isArray(mt.missing)) {
    return { [mt.field]: String(mt.message ?? 'Missing required translation') }
  }
  const issues = (err as { issues?: readonly StandardSchemaV1Issue[] } | null | undefined)?.issues
  if (!Array.isArray(issues)) return {}
  // … rest unchanged …
```

Also update the docstring's first line to mention both error shapes.

- [ ] **Step 4: Verify green** — `pnpm vitest run packages/ui/src/form.test.ts` → ALL PASS.
- [ ] **Step 5: Commit** — `git add packages/ui/src/form.ts packages/ui/src/form.test.ts && git commit -m "feat(ui): fieldErrors maps MissingTranslationError to its field"`

---

### Task 2: widget coverage — `i18n-text`, unit suffix, ref-select fallback, `fieldHint`

**Files:**
- Modify: `packages/ui/src/form.ts`, `packages/ui/src/index.ts`
- Test: `packages/ui/src/form.test.ts` (extend)

**Interfaces:**
- Consumes: `DescribedField.i18n?.locales`, `.unit`, `.widget === 'ref-select'`, `.optional`, `.constraints` (`minimum/maximum/gt/lt/minLength/maxLength/format/pattern` from the async `describe({})`).
- Produces (consumed by Tasks 4–6):
  - `InputKind` gains `'i18n-text'`.
  - `FieldInput` gains `locales?: readonly string[]` (i18n-text) and `unit?: string` (number suffix).
  - `interface FieldHint { required: boolean; text?: string }` and `fieldHint(field: DescribedField): FieldHint`.

- [ ] **Step 1: Write the failing tests** — append to `form.test.ts` (the `f` builder already exists at the top of the file):

```ts
describe('fieldInput — phase-3 widgets', () => {
  it('an i18n field becomes an i18n-text input carrying its locales', () => {
    const inp = fieldInput(f({ key: 'title', label: 'Title', i18n: { locales: ['en', 'th'] } }))
    expect(inp.kind).toBe('i18n-text')
    expect(inp.locales).toEqual(['en', 'th'])
  })

  it('a currency field keeps kind number and carries its unit', () => {
    const inp = fieldInput(f({ key: 'price', label: 'Price', semanticType: 'currency', unit: 'USD', type: 'number' }))
    expect(inp.kind).toBe('number')
    expect(inp.unit).toBe('USD')
  })

  it('ref-select with host options is a select; without options it falls back to text', () => {
    const field = f({ key: 'labelId', label: 'Label', widget: 'ref-select', ref: { target: 'labels', mode: 'warn' } })
    expect(fieldInput(field, [{ value: 'lb1', label: 'Groove Hill' }]).kind).toBe('select')
    expect(fieldInput(field).kind).toBe('text')
  })
})

describe('fieldHint', () => {
  it('marks non-optional fields required', () => {
    expect(fieldHint(f({ key: 'year', optional: false })).required).toBe(true)
    expect(fieldHint(f({ key: 'notes', optional: true })).required).toBe(false)
  })

  it('composes a numeric range from minimum/maximum', () => {
    expect(fieldHint(f({ key: 'year', constraints: { minimum: 1900, maximum: 2100 } })).text).toBe('1900–2100')
    expect(fieldHint(f({ key: 'price', constraints: { minimum: 0 } })).text).toBe('≥ 0')
  })

  it('composes a length range and a format name', () => {
    expect(fieldHint(f({ key: 'notes', constraints: { maxLength: 300 } })).text).toBe('≤ 300 chars')
    expect(fieldHint(f({ key: 'shopUrl', constraints: { format: 'uri' } })).text).toBe('uri')
  })

  it('no constraints → no text', () => {
    expect(fieldHint(f({ key: 'genre' })).text).toBeUndefined()
  })
})
```

- [ ] **Step 2: Verify red** — `pnpm vitest run packages/ui/src/form.test.ts` → new cases FAIL (compile errors on `fieldHint` count as red).

- [ ] **Step 3: Implement** — in `form.ts`:

```ts
export type InputKind = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'i18n-text'

export interface FieldInput {
  key: string
  label: string
  kind: InputKind
  /** select options (from the field's dictionary, or host-supplied for entity/other fields). */
  options?: { value: string; label: string }[]
  /** locale codes for an i18n-text input (one text box per locale). */
  locales?: readonly string[]
  /** display unit suffix for number inputs (e.g. 'USD', 'min'). */
  unit?: string
}

/** Resolve the input control for a field, honouring its `widget`, then `semanticType`/`type`. */
export function fieldInput(field: DescribedField, extraOptions?: { value: string; label: string }[]): FieldInput {
  const options = extraOptions ?? field.dict?.values?.map((v) => ({ value: v.value, label: v.label ?? v.value }))
  const w = field.widget
  let kind: InputKind = 'text'
  if (field.i18n) kind = 'i18n-text'
  else if (options) kind = 'select'
  else if (w === 'textarea') kind = 'textarea'
  else if (w === 'checkbox' || field.type === 'boolean') kind = 'checkbox'
  else if (w === 'date' || field.semanticType === 'date' || field.semanticType === 'datetime') kind = 'date'
  else if (w === 'number' || w === 'money' || field.semanticType === 'currency' || field.semanticType === 'percent' || field.type === 'number') kind = 'number'
  return {
    key: field.key, label: field.label, kind, options,
    ...(field.i18n?.locales ? { locales: field.i18n.locales } : {}),
    ...(kind === 'number' && field.unit ? { unit: field.unit } : {}),
  }
}

/** A client-side *hint* (never client-side validation): required mark + a compact constraint text. */
export interface FieldHint { required: boolean; text?: string }

/** Derive a hint from the async describe({}) constraints (minimum/maximum/gt/lt/minLength/maxLength/format). */
export function fieldHint(field: DescribedField): FieldHint {
  const c = (field.constraints ?? {}) as Record<string, unknown>
  const num = (v: unknown): v is number => typeof v === 'number'
  const parts: string[] = []
  const lo = num(c.minimum) ? c.minimum : num(c.gt) ? c.gt : undefined
  const hi = num(c.maximum) ? c.maximum : num(c.lt) ? c.lt : undefined
  if (lo !== undefined && hi !== undefined) parts.push(`${lo}–${hi}`)
  else if (lo !== undefined) parts.push(`≥ ${lo}`)
  else if (hi !== undefined) parts.push(`≤ ${hi}`)
  if (num(c.minLength) && num(c.maxLength)) parts.push(`${c.minLength}–${c.maxLength} chars`)
  else if (num(c.minLength)) parts.push(`≥ ${c.minLength} chars`)
  else if (num(c.maxLength)) parts.push(`≤ ${c.maxLength} chars`)
  if (typeof c.format === 'string') parts.push(c.format)
  return { required: field.optional === false, ...(parts.length ? { text: parts.join(' · ') } : {}) }
}
```

Note the i18n branch comes FIRST (an i18n textarea widget must still edit per-locale). `required` uses `field.optional === false` exactly — sync-describe fields (no validator run) default `optional: false`; the showcase passes async-describe fields where `optional` is validator-derived. Barrel (`index.ts`): extend the form line:

```ts
export { fieldInput, formFields, fieldErrors, fieldHint, type FieldInput, type InputKind, type FieldHint } from './form'
```

- [ ] **Step 4: Verify green** — `pnpm vitest run packages/ui/src/form.test.ts` → ALL PASS. Run `pnpm --filter @noy-db/ui test && pnpm typecheck` too.
- [ ] **Step 5: Commit** — `git add packages/ui/src/form.ts packages/ui/src/form.test.ts packages/ui/src/index.ts && git commit -m "feat(ui): i18n-text/unit/ref-select widget coverage + fieldHint constraint hints"`

---

### Task 3: `useRecordItem` — the edit state machine

**Files:**
- Create: `packages/ui/src/use-record-item.ts`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/use-record-item.test.ts` (create)

**Interfaces:**
- Consumes: `fieldErrors` (Tasks 1); vue reactivity (`ref`, `computed` — precedent: `use-collection-list.ts`).
- Produces (consumed by Task 6):

```ts
export interface ItemCollection<T> {
  get(id: string, readOptions?: unknown): Promise<T | null>
  put(id: string, record: T): Promise<void>
}
export function useRecordItem<T extends Record<string, any>>(opts: {
  collection: ItemCollection<T>
  id: string
  /** read options forwarded to get(); default { locale: 'raw' } so i18n fields edit as full maps. */
  readOptions?: unknown
}): {
  record: Ref<T | null>
  load: () => Promise<void>
  editing: Ref<boolean>
  draft: Ref<Record<string, any> | null>
  dirty: ComputedRef<boolean>
  errors: Ref<Record<string, string>>
  /** message of a failed put() that produced no per-field errors (generic banner). */
  errorBanner: Ref<string | null>
  submitting: Ref<boolean>
  enterEdit: () => void
  cancel: () => void
  /** put() the draft; true on success (re-fetches + exits edit), false on failure (errors populated). */
  submit: () => Promise<boolean>
}
```

- [ ] **Step 1: Write the failing test** — `packages/ui/src/use-record-item.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { useRecordItem, type ItemCollection } from './use-record-item'

type Rec = { id: string; title: Record<string, string>; year: number }

function fakeCollection(initial: Rec, opts: { failPut?: unknown } = {}) {
  let stored = structuredClone(initial)
  const calls: { get: unknown[][]; put: unknown[][] } = { get: [], put: [] }
  const collection: ItemCollection<Rec> = {
    async get(id, readOptions) { calls.get.push([id, readOptions]); return structuredClone(stored) },
    async put(id, record) {
      calls.put.push([id, structuredClone(record)])
      if (opts.failPut) throw opts.failPut
      stored = structuredClone(record)
    },
  }
  return { collection, calls, current: () => stored }
}

const REC: Rec = { id: 'r1', title: { en: 'First' }, year: 1990 }

describe('useRecordItem', () => {
  it('load() fetches with { locale: "raw" } by default', async () => {
    const { collection, calls } = fakeCollection(REC)
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    expect(item.record.value).toEqual(REC)
    expect(calls.get[0]).toEqual(['r1', { locale: 'raw' }])
  })

  it('enterEdit deep-clones into draft; edits do not touch the record', async () => {
    const { collection } = fakeCollection(REC)
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    item.draft.value!.title.en = 'Changed'
    expect(item.record.value!.title.en).toBe('First')
    expect(item.dirty.value).toBe(true)
  })

  it('cancel() drops the draft and exits edit', async () => {
    const { collection } = fakeCollection(REC)
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    item.draft.value!.year = 2000
    item.cancel()
    expect(item.editing.value).toBe(false)
    expect(item.draft.value).toBeNull()
    expect(item.dirty.value).toBe(false)
  })

  it('submit() puts the draft, re-fetches, exits edit', async () => {
    const { collection, calls } = fakeCollection(REC)
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    item.draft.value!.year = 2001
    expect(await item.submit()).toBe(true)
    expect(calls.put[0]![0]).toBe('r1')
    expect((calls.put[0]![1] as Rec).year).toBe(2001)
    expect(item.record.value!.year).toBe(2001) // re-fetched
    expect(item.editing.value).toBe(false)
    expect(item.errors.value).toEqual({})
  })

  it('a validation failure populates per-field errors and stays in edit', async () => {
    const failPut = { issues: [{ message: 'Too small', path: ['year'] }] } // SchemaValidationError shape
    const { collection } = fakeCollection(REC, { failPut })
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    item.draft.value!.year = 3
    expect(await item.submit()).toBe(false)
    expect(item.errors.value).toEqual({ year: 'Too small' })
    expect(item.errorBanner.value).toBeNull()
    expect(item.editing.value).toBe(true)
  })

  it('a non-validation failure sets the generic banner', async () => {
    const { collection } = fakeCollection(REC, { failPut: new Error('store offline') })
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    expect(await item.submit()).toBe(false)
    expect(item.errors.value).toEqual({})
    expect(item.errorBanner.value).toBe('store offline')
  })

  it('editing again after an error clears stale errors on enterEdit', async () => {
    const { collection } = fakeCollection(REC, { failPut: new Error('x') })
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    await item.submit()
    item.cancel()
    item.enterEdit()
    expect(item.errorBanner.value).toBeNull()
    expect(item.errors.value).toEqual({})
  })
})
```

- [ ] **Step 2: Verify red** — `pnpm vitest run packages/ui/src/use-record-item.test.ts` → module not found.

- [ ] **Step 3: Implement** — `packages/ui/src/use-record-item.ts`:

```ts
// Item family — the edit state machine behind an in-place editable RecordDetail.
// Mirrors useCollectionList's position: vue-reactive, framework-light (no DOM, no lifecycle),
// testable against a structural collection fake. Validation belongs to noy-db: submit() calls
// put(), and a failure decomposes through fieldErrors into per-field messages.
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { fieldErrors } from './form'

/** Structural slice of a noy-db collection that the item machine needs. */
export interface ItemCollection<T> {
  get(id: string, readOptions?: unknown): Promise<T | null>
  put(id: string, record: T): Promise<void>
}

export function useRecordItem<T extends Record<string, any>>(opts: {
  collection: ItemCollection<T>
  id: string
  /** read options forwarded to get(); default { locale: 'raw' } so i18n fields edit as full maps. */
  readOptions?: unknown
}): {
  record: Ref<T | null>
  load: () => Promise<void>
  editing: Ref<boolean>
  draft: Ref<Record<string, any> | null>
  dirty: ComputedRef<boolean>
  errors: Ref<Record<string, string>>
  errorBanner: Ref<string | null>
  submitting: Ref<boolean>
  enterEdit: () => void
  cancel: () => void
  submit: () => Promise<boolean>
} {
  const readOptions = opts.readOptions ?? { locale: 'raw' }
  const record = ref<T | null>(null) as Ref<T | null>
  const editing = ref(false)
  const draft = ref<Record<string, any> | null>(null)
  const errors = ref<Record<string, string>>({})
  const errorBanner = ref<string | null>(null)
  const submitting = ref(false)

  const dirty = computed(() =>
    editing.value && draft.value !== null && record.value !== null
    && JSON.stringify(draft.value) !== JSON.stringify(record.value))

  async function load(): Promise<void> {
    record.value = await opts.collection.get(opts.id, readOptions)
  }

  function enterEdit(): void {
    if (record.value === null) return
    draft.value = structuredClone(record.value) as Record<string, any>
    errors.value = {}
    errorBanner.value = null
    editing.value = true
  }

  function cancel(): void {
    editing.value = false
    draft.value = null
    errors.value = {}
    errorBanner.value = null
  }

  async function submit(): Promise<boolean> {
    if (draft.value === null || submitting.value) return false
    submitting.value = true
    errors.value = {}
    errorBanner.value = null
    try {
      await opts.collection.put(opts.id, draft.value as T)
      await load()
      editing.value = false
      draft.value = null
      return true
    } catch (err) {
      const mapped = fieldErrors(err)
      if (Object.keys(mapped).length > 0) errors.value = mapped
      else errorBanner.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      submitting.value = false
    }
  }

  return { record, load, editing, draft, dirty, errors, errorBanner, submitting, enterEdit, cancel, submit }
}
```

Barrel (`index.ts`), next to `useCollectionList`:

```ts
export { useRecordItem, type ItemCollection } from './use-record-item'
```

- [ ] **Step 4: Verify green** — `pnpm vitest run packages/ui/src/use-record-item.test.ts` then `pnpm --filter @noy-db/ui test && pnpm typecheck` → ALL PASS.
- [ ] **Step 5: Commit** — `git add packages/ui/src/use-record-item.ts packages/ui/src/use-record-item.test.ts packages/ui/src/index.ts && git commit -m "feat(ui): useRecordItem — draft/dirty/errors/submit edit state machine"`

---

### Task 4: `FieldControl.vue` + `RecordForm` delegation

**Files:**
- Create: `packages/ui-nuxt/src/runtime/internal/FieldControl.vue`
- Modify: `packages/ui-nuxt/src/runtime/components/item/RecordForm.vue`

**Interfaces:**
- Consumes: `FieldInput` (with `locales`/`unit`), `FieldHint` (Task 2).
- Produces: `<FieldControl :input="FieldInput" :model-value="any" :error="string?" :hint="FieldHint?" :id-prefix="string?" @update:model-value>` — the single widget renderer, consumed by `RecordForm` (this task) and `RecordDetail` (Task 5). i18n-text emits the whole updated locale map.

- [ ] **Step 1: Implement `FieldControl.vue`** (internal/ — explicitly imported, never auto-registered):

```vue
<script setup lang="ts">
// Item family — ONE widget renderer per FieldInput kind, shared by RecordForm (create) and
// RecordDetail (in-place edit) so both surfaces stay pixel-consistent. Emits update:modelValue;
// i18n-text edits emit the whole updated locale map. Error/hint lines render under the control.
import { computed } from 'vue'
import type { FieldInput, FieldHint } from '@noy-db/ui'

const props = withDefaults(defineProps<{
  input: FieldInput
  modelValue: any
  error?: string
  hint?: FieldHint
  idPrefix?: string
}>(), { idPrefix: 'f' })

const emit = defineEmits<{ 'update:modelValue': [value: any] }>()
const id = computed(() => `${props.idPrefix}-${props.input.key}`)

const i18nMap = computed<Record<string, string>>(() =>
  (typeof props.modelValue === 'object' && props.modelValue !== null) ? props.modelValue : {})
function setLocale(locale: string, v: string): void {
  emit('update:modelValue', { ...i18nMap.value, [locale]: v })
}
function num(v: string): void {
  emit('update:modelValue', v === '' ? undefined : Number(v))
}
</script>

<template>
  <div class="min-w-0">
    <template v-if="input.kind === 'i18n-text'">
      <div v-for="loc in input.locales" :key="loc" class="flex items-center gap-1.5 mb-1 last:mb-0">
        <span class="shrink-0 text-[10px] uppercase leading-4 px-1 rounded border border-nui-border text-nui-muted">{{ loc }}</span>
        <input
          :id="`${id}-${loc}`" type="text" class="nui-field flex-1"
          :value="i18nMap[loc] ?? ''" @input="setLocale(loc, ($event.target as HTMLInputElement).value)"
        >
      </div>
    </template>
    <textarea
      v-else-if="input.kind === 'textarea'" :id="id" rows="3" class="nui-field w-full"
      :value="modelValue ?? ''" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <select
      v-else-if="input.kind === 'select'" :id="id" class="nui-field w-full"
      :value="modelValue ?? ''" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">—</option>
      <option v-for="o in input.options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <label v-else-if="input.kind === 'checkbox'" class="flex items-center gap-2 h-9">
      <input
        :id="id" type="checkbox" class="accent-nui-accent"
        :checked="!!modelValue" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      > <span class="text-sm">{{ input.label }}</span>
    </label>
    <div v-else-if="input.kind === 'number'" class="flex items-center gap-1.5">
      <input
        :id="id" type="number" step="any" class="nui-field flex-1"
        :value="modelValue ?? ''" @input="num(($event.target as HTMLInputElement).value)"
      >
      <span v-if="input.unit" class="text-xs text-nui-muted shrink-0">{{ input.unit }}</span>
    </div>
    <input
      v-else :id="id" :type="input.kind === 'date' ? 'date' : 'text'" class="nui-field w-full"
      :value="modelValue ?? ''" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >

    <p v-if="error" class="text-[11px] text-red-500 mt-1">{{ error }}</p>
    <p v-else-if="hint?.text" class="text-[11px] text-nui-subtle mt-1">{{ hint.text }}</p>
  </div>
</template>
```

- [ ] **Step 2: Delegate in `RecordForm.vue`** — replace the whole control switch (the `<textarea v-if…>` through the final `<input v-else …>` block, keeping the label and error `<p>` OUT — FieldControl owns the error line now):

Script: add `import FieldControl from '../../internal/FieldControl.vue'`; keep everything else.

Template — the per-input block becomes:

```vue
        <div v-for="inp in card.inputs" :key="inp.key" class="min-w-0" :class="inp.kind === 'textarea' ? 'sm:col-span-2' : ''">
          <label v-if="inp.kind !== 'checkbox'" class="block text-xs text-nui-muted mb-1" :for="`f-${inp.key}`">{{ inp.label }}</label>
          <FieldControl
            :input="inp" :model-value="draft[inp.key]" :error="errors?.[inp.key]"
            @update:model-value="(v) => { draft[inp.key] = v }"
          />
        </div>
```

(Remove the now-duplicated error `<p>`; checkbox renders its own label inside FieldControl.)

- [ ] **Step 3: Verify** — `pnpm build && pnpm typecheck` → clean; `grep -o 'accent-nui-accent' packages/ui-nuxt/dist/style.css | head -1` → present (CSS regenerated).
- [ ] **Step 4: Commit** — `git add packages/ui-nuxt/src/runtime/internal/FieldControl.vue packages/ui-nuxt/src/runtime/components/item/RecordForm.vue && git commit -m "feat(ui-nuxt): FieldControl — shared widget renderer; RecordForm delegates to it"`

---

### Task 5: `RecordDetail` in-place edit mode

**Files:**
- Modify: `packages/ui-nuxt/src/runtime/components/item/RecordDetail.vue`
- Modify: `packages/ui-nuxt/uno.config.ts` (safelist `i-lucide-lock`)
- Modify: `packages/ui-nuxt/src/runtime/core/locale-th.ts` (add `'nui.detail.readonly': 'อ่านอย่างเดียว'` next to the other `nui.detail.*` keys)

**Interfaces:**
- Consumes: `FieldControl` (Task 4), `fieldInput`/`formFields`/`fieldHint`/`FieldHint` (Task 2), existing `groupFields`/`formatDetailCell`.
- Produces: new props on `RecordDetail` — `editing?: boolean`, `draft?: Record<string, any> | null`, `errors?: Record<string, string>`, `hints?: Record<string, FieldHint>`, `options?: Record<string, { value: string; label: string }[]>`, `submitting?: boolean`, `errorBanner?: string | null` — and new emits `save`, `cancel` (existing `edit`, `navigate` unchanged). In edit mode the component mutates `draft[key]` in place (the host owns the object via `useRecordItem`).

- [ ] **Step 1: Extend the script** — add to the imports: `fieldInput, formFields, fieldHint, type FieldHint, type FieldInput` from `@noy-db/ui` and `import FieldControl from '../../internal/FieldControl.vue'`. Extend props/emits:

```ts
const props = withDefaults(defineProps<{
  record: T
  fields: readonly DescribedField[]
  groups?: { title: string; keys: string[] }[]
  routeFor?: (collection: string, id: string) => string
  reveal?: boolean
  /** Show an Edit affordance (emits `edit`). */
  editable?: boolean
  /** In-place edit mode: editable cells morph into their input widgets bound to `draft`. */
  editing?: boolean
  /** The working copy (from useRecordItem). The component mutates draft[key] in place. */
  draft?: Record<string, any> | null
  /** Per-field error text (from a failed put()). */
  errors?: Record<string, string>
  /** Per-field constraint hints (from fieldHint over async describe({}) fields). */
  hints?: Record<string, FieldHint>
  /** Select options for entity/ref fields, keyed by field key. */
  options?: Record<string, { value: string; label: string }[]>
  submitting?: boolean
  /** Non-field failure message (generic banner over the cards). */
  errorBanner?: string | null
}>(), { reveal: false, editable: false, editing: false, submitting: false })

const emit = defineEmits<{ edit: []; save: []; cancel: []; navigate: [{ collection: string; id: string }] }>()
```

Extend the card model so每 cell knows its edit face (add after the `cards` computed's group resolution, replacing the `.map` body):

```ts
const editableKeys = computed(() => new Set(formFields(props.fields).map((f) => f.key)))

const cards = computed(() => {
  const groups = props.groups?.length
    ? props.groups.map((g) => ({ title: g.title, fields: g.keys.map((k) => byKey.value.get(k)).filter(Boolean) as DescribedField[] }))
    : groupFields(shown.value, t)
  return groups.map((g) => ({
    title: g.title,
    cells: g.fields.map((f) => ({
      cell: formatDetailCell(f, props.record, { reveal: props.reveal }),
      input: fieldInput(f, props.options?.[f.key]) as FieldInput,
      hint: fieldHint(f),
      canEdit: editableKeys.value.has(f.key),
    })),
  }))
})
```

- [ ] **Step 2: Extend the template** — header block becomes Save/Cancel in edit mode; each cell renders `FieldControl` when `editing && canEdit`:

```vue
    <div v-if="editable || editing" class="flex items-center justify-end gap-2">
      <template v-if="editing">
        <button type="button" class="nui-btn-ghost px-3 py-1.5" :disabled="submitting" @click="emit('cancel')">{{ t('nui.cancel', 'Cancel') }}</button>
        <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" :disabled="submitting" @click="emit('save')">
          {{ submitting ? '…' : t('nui.save', 'Save') }}
        </button>
      </template>
      <button v-else type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" @click="emit('edit')">
        <span class="i-lucide-pencil size-3.5" aria-hidden="true" /> {{ t('nui.detail.edit', 'Edit') }}
      </button>
    </div>
    <p v-if="editing && errorBanner" class="text-[11px] text-red-500">{{ errorBanner }}</p>
```

Cell body (`<dd>` content) becomes a three-way: edit-widget / read link / read text. The `v-for="c in card.cells"` items are now `{ cell, input, hint, canEdit }` — update references (`c.cell.label` etc.):

```vue
          <div v-for="c in card.cells" :key="c.cell.key" class="min-w-0" :class="editing && c.input.kind === 'textarea' ? 'md:col-span-2' : ''">
            <dt class="text-xs text-nui-muted flex items-center gap-1">
              {{ c.cell.label }}
              <span v-if="editing && c.hint.required" class="text-red-500" aria-hidden="true">*</span>
              <span v-if="editing && !c.canEdit" class="i-lucide-lock size-3 text-nui-subtle" :title="t('nui.detail.readonly', 'Read-only')" />
            </dt>
            <dd class="text-sm mt-0.5" :class="c.cell.empty ? 'text-nui-subtle' : 'text-nui-fg'">
              <FieldControl
                v-if="editing && c.canEdit && draft"
                :input="c.input" :model-value="draft[c.cell.key]" :error="errors?.[c.cell.key]" :hint="c.hint"
                id-prefix="d" @update:model-value="(v) => { draft![c.cell.key] = v }"
              />
              <a
                v-else-if="linkHref(c.cell)" :href="linkHref(c.cell)" class="text-nui-accent hover:underline"
                @click="onLink(c.cell, $event)"
              >{{ c.cell.display }}</a>
              <template v-else-if="c.cell.i18n">
                <span v-for="e in c.cell.i18n" :key="e.locale" class="flex items-baseline gap-1.5 min-w-0">
                  <span
                    class="shrink-0 text-[10px] uppercase leading-4 px-1 rounded border border-nui-border"
                    :class="e.missing ? 'text-nui-subtle opacity-60' : 'text-nui-muted'"
                  >{{ e.locale }}</span>
                  <NuiText :reps="[e.display]" :class="e.missing ? 'text-nui-subtle' : ''" />
                </span>
              </template>
              <NuiText v-else :reps="[c.cell.display]" />
            </dd>
          </div>
```

(The `<dl>` grid class stays width-driven; note `md:col-span-2` only matters when 2-col.) uno.config.ts: append `i-lucide-lock` to the safelist array next to the other `i-lucide-*` entries.

- [ ] **Step 3: Verify** — `pnpm build && pnpm typecheck && pnpm test` → clean; `grep -o 'i-lucide-lock' packages/ui-nuxt/dist/style.css | head -1` → present.
- [ ] **Step 4: Commit** — `git add packages/ui-nuxt/src/runtime/components/item/RecordDetail.vue packages/ui-nuxt/uno.config.ts packages/ui-nuxt/src/runtime/core/locale-th.ts && git commit -m "feat(ui-nuxt): RecordDetail in-place edit — widgets morph into the grid cells"`

---

### Task 6: showcase — constraints, `shopUrl`, wired edit flow

**Files:**
- Modify: `examples/showcase/src/data/types.ts` — tighten `RecordSchema` + add `shopUrl`:

```ts
export const RecordSchema = z.object({
  id: z.string(),
  title: z.record(z.string()),
  artistId: z.string(),
  labelId: z.string(),
  year: z.number().int().min(1900).max(2100),
  genre: z.enum(GENRES),
  format: z.enum(FORMATS),
  condition: z.enum(CONDITIONS),
  durationMin: z.number().min(0),
  trackCount: z.number().int().min(1),
  rating: z.number().int().min(1).max(5),
  priceUsd: z.number().min(0),
  purchasedOn: z.string(),   // ISO date
  favorite: z.boolean(),
  notes: z.string().max(300),
  shopUrl: z.string().url().optional(),
})
```

- Modify: `examples/showcase/src/data/dicts.ts` — `FIELD_LABELS.records` gains `shopUrl: { en: 'Shop link', th: 'ลิงก์ร้านค้า' },`
- Modify: `examples/showcase/src/data/dataset.ts` — add `shopUrl` to three records (e.g. rc02 `shopUrl: 'https://vinyl.example/quartet-in-blue'`, rc05 `'https://vinyl.example/boom-bap-almanac'`, rc18 `'https://vinyl.example/tokyo-pulse-ii'`) — leave the rest without (optional).
- Modify: `examples/showcase/src/data/collections.ts` — records fieldMeta gains `shopUrl: { semanticType: 'url', group: 'Condition & Value', order: 24 },`
- Modify: `examples/showcase/app/pages/records/[id].vue` — full rewrite of the script + editable RecordDetail:

```vue
<script setup lang="ts">
import { fieldHint, useRecordItem, type FieldHint } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'

const route = useRoute()
const { vault } = useVault()
const { fieldLabel, locale } = useShowcaseI18n()

const id = route.params.id as string
const records = vault.value!.collection('records')

const item = useRecordItem({ collection: records, id })
await item.load()

// async describe({}) → validator-derived optional + constraints drive the hints
const described = await records.describe({})
const fields = computed(() => described.fields.map((f) => {
  const l = fieldLabel('records', f.key)
  return l === f.key ? f : { ...f, label: l }
}))
const hints = computed(() => Object.fromEntries(described.fields.map((f) => [f.key, fieldHint(f)])) as Record<string, FieldHint>)

// ref-select options: entity pickers fed by the target collections (localized names)
const artistRows = await vault.value!.collection('artists').list({ locale: locale.value }) as { id: string; name: string }[]
const labelRows = await vault.value!.collection('labels').list({ locale: locale.value }) as { id: string; name: string }[]
const options = {
  artistId: artistRows.map((a) => ({ value: a.id, label: a.name })),
  labelId: labelRows.map((l) => ({ value: l.id, label: l.name })),
}
</script>

<template>
  <article v-if="item.record.value" class="p-4 space-y-6">
    <NuxtLink to="/records" class="text-sm text-nui-accent hover:underline">← records</NuxtLink>
    <CoverImage :id="id" />
    <RecordDetail
      :record="item.record.value"
      :fields="fields"
      editable
      :editing="item.editing.value"
      :draft="item.draft.value"
      :errors="item.errors.value"
      :error-banner="item.errorBanner.value"
      :hints="hints"
      :options="options"
      :submitting="item.submitting.value"
      :route-for="(c: string, i: string) => `/${c}/${i}`"
      @edit="item.enterEdit"
      @save="item.submit"
      @cancel="item.cancel"
      @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
    />
  </article>
  <p v-else class="p-4">Not found.</p>
</template>
```

(Check the current file first for the exact `CoverImage` usage and keep it as-is; the previous top-level `record` const is replaced by `item.record`.)

- Modify: `examples/showcase/public/demo.noydb` — re-seed.

- [ ] **Step 1: Apply the data-layer edits** (types/dicts/dataset/collections as above), then `cd examples/showcase && pnpm seed && pnpm vitest run` → seed writes; ALL showcase tests PASS (seed data satisfies the tightened schema — if a seed record violates a constraint, fix the DATA, not the constraint).
- [ ] **Step 2: Rewrite `records/[id].vue`** as above (verify `list({ locale })` returns resolved-name rows — the list pages already rely on this).
- [ ] **Step 3: Full dev-loop verification** (Global Constraints loop), fresh browser context, unlock `spin-the-black-circle`, open `/records/rc02`:
  - Edit → widgets morph in place: `title` shows EN+TH inputs with badges, `genre/format/condition` selects with localized labels, `artistId/labelId` entity selects with names, `priceUsd` number + `USD` suffix, `year` shows hint `1900–2100`, required `*` marks, `id` shows the lock.
  - Set `year` to `3` → Save → red error under Year (zod message), still editing.
  - Clear both `title` locales → Save → error under Title (MissingTranslationError).
  - Fix values → Save → read mode with updated values; reload page → edit persisted for the session vault.
  - `shopUrl` renders as a link in read mode; Thai locale: labels + groups localized in both modes. Zero console errors.
- [ ] **Step 4: Commit** — `git add examples/showcase && git commit -m "feat(showcase): in-place record editing with real constraints + shopUrl"`

---

### Task 7: phase gate — docs, changelogs, PR

**Files:**
- Modify: `docs/ui-nuxt/3.components.md` — RecordDetail row gains the editing mode sentence; RecordForm row notes the shared `FieldControl`.
- Modify: `packages/ui/CHANGELOG.md`, `packages/ui-nuxt/CHANGELOG.md` — `[Unreleased]` entries (fieldErrors/MissingTranslationError, i18n-text/unit/fieldHint, useRecordItem; FieldControl, RecordDetail editing). No version bump — release is a separate user decision.

- [ ] **Step 1:** Root `pnpm build && pnpm test && pnpm typecheck && pnpm lint` + showcase `pnpm vitest run` → ALL green.
- [ ] **Step 2:** Write the docs + changelog entries; commit `docs: record in-place editing in components page + unreleased changelogs`.
- [ ] **Step 3:** Push branch, open PR titled `feat: Item Release phase 3 — in-place edit + validation`, body summarizing tasks 1–6 + test counts; wait for CI green. Merging + any release stays with the user.

---

## Self-review notes

- **Spec coverage (P3):** editing morph → Task 5; useRecordItem → Task 3; server-of-record validation + `fieldErrors` gap → Task 1; hints from async `describe({})` → Tasks 2, 6; widget coverage (text/textarea/number/date/select/checkbox pre-existing; money-unit, ref-select, i18n-text → Task 2/4); showcase constraints incl. url pattern → Task 6 (`shopUrl` added — the spec asked for a url-pattern field and records had none). RecordForm-stays-for-create honored (Task 4 refactor, no removal). Client-side validation deliberately absent per spec.
- **Type consistency:** `FieldInput{key,label,kind,options,locales,unit}`, `FieldHint{required,text}`, `ItemCollection{get,put}`, `useRecordItem` return shape — identical across Tasks 2–6; `draft` mutation contract stated in both Task 5 (produces) and Task 6 (consumes).
- **Judgment calls flagged:** Task 6 requires checking `list({ locale })` row shape and the current `[id].vue` before rewriting; seed data must satisfy the tightened schema (fix data, not constraints).
