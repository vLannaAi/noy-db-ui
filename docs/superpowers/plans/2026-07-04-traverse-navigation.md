# Traverse Navigation (Found-Set Navigator) — Implementation Plan (P-A + P-B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a refined+sorted list, traverse the found set inside the detail: fixed vertical stepper cluster with N-of-M, scrubber popover with typed jump, path-shaped title (group trail / natural ref axis), skim controller (instant cursor, debounced fetch), j/k keys, and return-to-list restoration.

**Architecture:** Family-standard three tiers per the spec (`docs/superpowers/specs/2026-07-04-traverse-navigation-design.md`): pure engines `traverse.ts` + `path.ts`, vue-reactive composables `use-found-set.ts` (per-tab store) + `use-traverse.ts` (skim controller), presentational `TraverseBar` + internal scrubber + `ItemPath` in ui-nuxt, wired by the showcase. The page owns the `useTraverse` instance; `TraverseBar` is presentational + keyboard.

**Tech Stack:** TypeScript ESM, Vue 3 reactivity in `packages/ui` (precedent: `use-collection-list.ts`), vitest (fake timers for the skim controller), UnoCSS pre-compiled, pnpm + turbo. **Branch: `traverse-navigation` (stacked on `item-release-phase3` — do not rebase).**

## Global Constraints

- Never add Claude attribution to commits. Never merge/publish without explicit user confirmation.
- Spec decisions D1–D13 bind every task (frozen snapshot; display order; vertical glyphs + named destinations; `router.replace`; sticky fixed-width cluster with `tabular-nums`; j/k + ⌥arrows; traversal inert while `editing`; no wrap).
- Multi-tab invariants (spec §6): snapshots derivable from their `query` string; per-tab store only; navigational elements structured so `href` can be layered later. NO URL seeding in this phase.
- Only `--nui-*` tokens + existing `nui-*` shortcuts; dark parity; new icons must be safelisted in `packages/ui-nuxt/uno.config.ts`.
- Engine modules pure (no vue import); composables may use vue reactivity but NO DOM/lifecycle APIs (`use-traverse` uses `setTimeout` — allowed, mirrors debounce practice; tests use fake timers).
- Commands: single test `pnpm vitest run <path>` from repo root; suites `pnpm test`/`pnpm typecheck`/`pnpm build`/`pnpm lint`; showcase tests `pnpm vitest run` from `examples/showcase`.
- Showcase dev loop after library changes: root `pnpm build` → sync store copies of ui/ui-nuxt dist into `examples/showcase/node_modules/.pnpm/@noy-db+{ui,ui-nuxt}@file*/...` → clear `examples/showcase/node_modules/.vite`, `node_modules/.cache/vite`, `.nuxt`.

## File structure

| File | Responsibility |
|---|---|
| `packages/ui/src/traverse.ts` (create) | `FoundSetItem/FoundSetSnapshot/TraversePosition`, `positionOf`, `itemAt` |
| `packages/ui/src/path.ts` (create) | `PathSegment`, `pathSegments` (group trail / natural axis) |
| `packages/ui/src/use-found-set.ts` (create) | per-entity snapshot store + one-shot return anchor |
| `packages/ui/src/use-traverse.ts` (create) | skim controller (cursor, settle debounce, generation guard, lastDirection) |
| `packages/ui/src/index.ts` (modify) | barrel exports |
| `packages/ui-nuxt/src/runtime/components/item/TraverseBar.vue` (create) | sticky bar: breadcrumb + fixed cluster + keyboard; hosts scrubber |
| `packages/ui-nuxt/src/runtime/internal/TraverseScrubber.vue` (create) | popover: title, M-of-total, typed jump, grouped mini-list |
| `packages/ui-nuxt/src/runtime/components/item/ItemPath.vue` (create) | path-shaped title |
| `packages/ui-nuxt/src/runtime/components/CollectionList.vue` (modify) | `anchorKey` prop: scroll + flash highlight |
| `packages/ui-nuxt/src/runtime/core/locale-th.ts` (modify) | `nui.traverse.*` TH strings |
| `packages/ui-nuxt/uno.config.ts` (modify) | safelist stepper icons |
| `examples/showcase/app/pages/{records,artists,labels}/index.vue` + `[id].vue` (modify) | capture, traverse wiring, return-restore |

---

### Task 1: `traverse.ts` engine

**Files:** Create `packages/ui/src/traverse.ts`; modify `packages/ui/src/index.ts`; test `packages/ui/src/traverse.test.ts`.

**Interfaces — Produces (consumed by Tasks 2–8):**

```ts
export interface FoundSetItem { id: string; label: string; group?: readonly string[] }
export interface FoundSetSnapshot {
  kind: 'query' | 'fixed'
  entity: string
  query: string
  title: string
  items: readonly FoundSetItem[]
  total: number
  capturedAt: string
}
export interface TraversePosition {
  index: number; count: number
  atFirst: boolean; atLast: boolean
  current: FoundSetItem; prev?: FoundSetItem; next?: FoundSetItem
}
export function positionOf(snap: FoundSetSnapshot, id: string): TraversePosition | null
export function itemAt(snap: FoundSetSnapshot, index: number): FoundSetItem | null  // clamps; null only when items is empty
```

- [ ] **Step 1: failing test** — `packages/ui/src/traverse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { positionOf, itemAt, type FoundSetSnapshot } from './traverse'

const snap = (ids: string[]): FoundSetSnapshot => ({
  kind: 'query', entity: 'records', query: 'genre:jazz sort:year', title: 'jazz · by year',
  items: ids.map((id) => ({ id, label: `L-${id}` })), total: 24, capturedAt: '2026-07-04T00:00:00Z',
})

describe('positionOf', () => {
  it('finds index, neighbors and end flags', () => {
    const p = positionOf(snap(['a', 'b', 'c']), 'b')!
    expect(p).toMatchObject({ index: 1, count: 3, atFirst: false, atLast: false })
    expect(p.prev!.id).toBe('a'); expect(p.next!.id).toBe('c'); expect(p.current.id).toBe('b')
  })
  it('first/last omit the missing neighbor and set the flag', () => {
    const first = positionOf(snap(['a', 'b']), 'a')!
    expect(first.atFirst).toBe(true); expect(first.prev).toBeUndefined(); expect(first.next!.id).toBe('b')
    const last = positionOf(snap(['a', 'b']), 'b')!
    expect(last.atLast).toBe(true); expect(last.next).toBeUndefined()
  })
  it('single item is both first and last', () => {
    const p = positionOf(snap(['x']), 'x')!
    expect(p).toMatchObject({ index: 0, count: 1, atFirst: true, atLast: true })
  })
  it('unknown id → null', () => { expect(positionOf(snap(['a']), 'zz')).toBeNull() })
})

describe('itemAt', () => {
  it('clamps below and above', () => {
    expect(itemAt(snap(['a', 'b']), -5)!.id).toBe('a')
    expect(itemAt(snap(['a', 'b']), 99)!.id).toBe('b')
  })
  it('empty set → null', () => { expect(itemAt(snap([]), 0)).toBeNull() })
})
```

- [ ] **Step 2: verify red** — `pnpm vitest run packages/ui/src/traverse.test.ts` → module not found.
- [ ] **Step 3: implement** — `packages/ui/src/traverse.ts`:

```ts
// Found-set traversal — the FileMaker found-set contract for the item family.
// A snapshot is FROZEN at capture (spec D1) and fully derivable from its serialized
// query (spec §6 multi-tab invariant 1). Pure + framework-free.

export interface FoundSetItem {
  id: string
  /** Primary display text at capture time (frozen; does not re-localize). */
  label: string
  /** Group-by trail values, outermost first (present only when the list was grouped). */
  group?: readonly string[]
}

export interface FoundSetSnapshot {
  /** 'fixed' is reserved for the lists phase (spec P-D); all machinery reads either. */
  kind: 'query' | 'fixed'
  entity: string
  /** Serialized DSL (filter+sort+group) — the fork seed. */
  query: string
  /** narrate(ast).title at capture time. */
  title: string
  items: readonly FoundSetItem[]
  /** Unfiltered collection size (found-vs-total fraction). */
  total: number
  capturedAt: string
}

export interface TraversePosition {
  index: number
  count: number
  atFirst: boolean
  atLast: boolean
  current: FoundSetItem
  prev?: FoundSetItem
  next?: FoundSetItem
}

/** Position of `id` in the snapshot, with neighbors for destination-labelled steppers. */
export function positionOf(snap: FoundSetSnapshot, id: string): TraversePosition | null {
  const index = snap.items.findIndex((it) => it.id === id)
  if (index < 0) return null
  const count = snap.items.length
  const prev = index > 0 ? snap.items[index - 1] : undefined
  const next = index < count - 1 ? snap.items[index + 1] : undefined
  return {
    index, count, atFirst: index === 0, atLast: index === count - 1,
    current: snap.items[index]!,
    ...(prev !== undefined ? { prev } : {}),
    ...(next !== undefined ? { next } : {}),
  }
}

/** Item at a clamped index; null only for an empty set. */
export function itemAt(snap: FoundSetSnapshot, index: number): FoundSetItem | null {
  if (snap.items.length === 0) return null
  const i = Math.min(Math.max(index, 0), snap.items.length - 1)
  return snap.items[i]!
}
```

Barrel (`packages/ui/src/index.ts`), new section after the Item-family lines:

```ts
// Traverse family: found-set snapshots + traversal position + path-shaped titles
export { positionOf, itemAt, type FoundSetItem, type FoundSetSnapshot, type TraversePosition } from './traverse'
```

- [ ] **Step 4: verify green** — same command → ALL PASS; `pnpm typecheck` clean.
- [ ] **Step 5: commit** — `git add packages/ui/src/traverse.ts packages/ui/src/traverse.test.ts packages/ui/src/index.ts && git commit -m "feat(ui): traverse engine — found-set snapshots + positionOf/itemAt"`

---

### Task 2: `path.ts` engine

**Files:** Create `packages/ui/src/path.ts`; modify `packages/ui/src/index.ts`; test `packages/ui/src/path.test.ts`.

**Interfaces:**
- Consumes: `FoundSetItem` (Task 1), `DescribedField` (hub).
- Produces (consumed by ItemPath, Task 6, and showcase, Task 7):

```ts
export interface PathSegment {
  label: string
  kind: 'group' | 'entity' | 'title'
  ref?: { collection: string; id: string }
}
export function pathSegments(opts: {
  item: FoundSetItem | null
  record: Record<string, unknown> | null
  fields: readonly DescribedField[]
  naturalOrder?: readonly string[]
  labelFor?: (field: string, id: string) => string | undefined
  titleLabel: string
}): PathSegment[]
```

Rules (spec D7 + §4 skim fidelity): if `item?.group?.length` → one `group` segment per trail value, then the `title` terminal. Else if `record` is non-null → one `entity` segment per `naturalOrder` field that has a non-empty record value AND a `ref` on its DescribedField (label = `labelFor(field, id) ?? String(id)`, ref = `{ collection: field.ref.target, id }`), then the terminal. Else (skim without record): terminal only.

- [ ] **Step 1: failing test** — `packages/ui/src/path.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { pathSegments } from './path'

const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField
const FIELDS = [
  f({ key: 'labelId', ref: { target: 'labels', mode: 'warn' } }),
  f({ key: 'artistId', ref: { target: 'artists', mode: 'warn' } }),
  f({ key: 'title' }),
]

describe('pathSegments — grouped', () => {
  it('group trail then bold terminal', () => {
    const segs = pathSegments({
      item: { id: 'r1', label: 'After Hours', group: ['Jazz', 'Groove Hill'] },
      record: null, fields: FIELDS, titleLabel: 'After Hours',
    })
    expect(segs).toEqual([
      { label: 'Jazz', kind: 'group' },
      { label: 'Groove Hill', kind: 'group' },
      { label: 'After Hours', kind: 'title' },
    ])
  })
})

describe('pathSegments — natural axis', () => {
  const record = { id: 'r1', labelId: 'lb1', artistId: 'ar2', title: 'After Hours' }
  it('ref segments in naturalOrder with resolved labels + refs', () => {
    const segs = pathSegments({
      item: { id: 'r1', label: 'After Hours' }, record, fields: FIELDS,
      naturalOrder: ['labelId', 'artistId'],
      labelFor: (field, id) => (field === 'labelId' ? 'Groove Hill' : field === 'artistId' ? 'Blue Quartet' : undefined),
      titleLabel: 'After Hours',
    })
    expect(segs).toEqual([
      { label: 'Groove Hill', kind: 'entity', ref: { collection: 'labels', id: 'lb1' } },
      { label: 'Blue Quartet', kind: 'entity', ref: { collection: 'artists', id: 'ar2' } },
      { label: 'After Hours', kind: 'title' },
    ])
  })
  it('missing labelFor falls back to the raw id; empty values are skipped', () => {
    const segs = pathSegments({
      item: null, record: { ...record, artistId: '' }, fields: FIELDS,
      naturalOrder: ['labelId', 'artistId'], titleLabel: 'After Hours',
    })
    expect(segs).toEqual([
      { label: 'lb1', kind: 'entity', ref: { collection: 'labels', id: 'lb1' } },
      { label: 'After Hours', kind: 'title' },
    ])
  })
  it('skim (no record, no group) → title only', () => {
    expect(pathSegments({ item: { id: 'r2', label: 'X' }, record: null, fields: FIELDS, naturalOrder: ['labelId'], titleLabel: 'X' }))
      .toEqual([{ label: 'X', kind: 'title' }])
  })
})
```

- [ ] **Step 2: verify red** — `pnpm vitest run packages/ui/src/path.test.ts`.
- [ ] **Step 3: implement** — `packages/ui/src/path.ts`:

```ts
// Path-shaped titles for the item family (spec D7): the detail title is a path —
// the group-by trail when the found set was grouped, else the entity's natural
// ref axis — terminating in the record title. Pure + framework-free.
import type { DescribedField } from '@noy-db/hub'
import type { FoundSetItem } from './traverse'

export interface PathSegment {
  label: string
  kind: 'group' | 'entity' | 'title'
  /** entity segments navigate to their own detail. */
  ref?: { collection: string; id: string }
}

export function pathSegments(opts: {
  item: FoundSetItem | null
  record: Record<string, unknown> | null
  fields: readonly DescribedField[]
  /** ref field keys in path order (host config, e.g. ['labelId','artistId']). */
  naturalOrder?: readonly string[]
  labelFor?: (field: string, id: string) => string | undefined
  titleLabel: string
}): PathSegment[] {
  const terminal: PathSegment = { label: opts.titleLabel, kind: 'title' }

  if (opts.item?.group?.length) {
    return [...opts.item.group.map((label): PathSegment => ({ label, kind: 'group' })), terminal]
  }

  if (opts.record && opts.naturalOrder?.length) {
    const byKey = new Map(opts.fields.map((f) => [f.key, f]))
    const segs: PathSegment[] = []
    for (const key of opts.naturalOrder) {
      const field = byKey.get(key)
      const raw = opts.record[key]
      if (!field?.ref || raw == null || raw === '') continue
      const id = String(raw)
      segs.push({ label: opts.labelFor?.(key, id) ?? id, kind: 'entity', ref: { collection: field.ref.target, id } })
    }
    return [...segs, terminal]
  }

  return [terminal]
}
```

Barrel: append to the Traverse-family section: `export { pathSegments, type PathSegment } from './path'`

- [ ] **Step 4: verify green** + `pnpm typecheck`.
- [ ] **Step 5: commit** — `git add packages/ui/src/path.ts packages/ui/src/path.test.ts packages/ui/src/index.ts && git commit -m "feat(ui): pathSegments — group-trail / natural-axis path titles"`

---

### Task 3: `use-found-set.ts` store

**Files:** Create `packages/ui/src/use-found-set.ts`; modify `packages/ui/src/index.ts`; test `packages/ui/src/use-found-set.test.ts`.

**Interfaces — Produces (consumed by Task 7):**

```ts
export function captureFoundSet(snap: FoundSetSnapshot): void
export function useFoundSet(entity: string): { snapshot: Ref<FoundSetSnapshot | null>; clear: () => void }
export function setReturnAnchor(entity: string, anchor: { query: string; id: string }): void
export function consumeReturnAnchor(entity: string): { query: string; id: string } | null
```

- [ ] **Step 1: failing test** — `packages/ui/src/use-found-set.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { captureFoundSet, useFoundSet, setReturnAnchor, consumeReturnAnchor } from './use-found-set'
import type { FoundSetSnapshot } from './traverse'

const snap = (entity: string): FoundSetSnapshot => ({
  kind: 'query', entity, query: 'x', title: 't', items: [{ id: 'a', label: 'A' }], total: 1, capturedAt: 'now',
})

describe('found-set store', () => {
  it('capture is per-entity and reactive through useFoundSet', () => {
    const records = useFoundSet('fs-records')
    expect(records.snapshot.value).toBeNull()
    captureFoundSet(snap('fs-records'))
    expect(records.snapshot.value!.items[0]!.id).toBe('a')
    expect(useFoundSet('fs-artists').snapshot.value).toBeNull() // isolation
  })
  it('clear() empties only its entity', () => {
    captureFoundSet(snap('fs-c1')); captureFoundSet(snap('fs-c2'))
    useFoundSet('fs-c1').clear()
    expect(useFoundSet('fs-c1').snapshot.value).toBeNull()
    expect(useFoundSet('fs-c2').snapshot.value).not.toBeNull()
  })
  it('return anchor is one-shot', () => {
    setReturnAnchor('fs-r', { query: 'genre:jazz', id: 'rc02' })
    expect(consumeReturnAnchor('fs-r')).toEqual({ query: 'genre:jazz', id: 'rc02' })
    expect(consumeReturnAnchor('fs-r')).toBeNull()
  })
})
```

- [ ] **Step 2: verify red.**
- [ ] **Step 3: implement** — `packages/ui/src/use-found-set.ts`:

```ts
// Per-entity found-set session store (module-level, saved-searches pattern).
// PER-TAB BY CONSTRUCTION (spec §6 invariant 2): a new browser tab is a new module
// graph — never assume another tab shares this state. The snapshot's `query` string
// is the cross-tab seed (invariant 1); URL seeding lands in P-C.
import { ref, type Ref } from 'vue'
import type { FoundSetSnapshot } from './traverse'

const snapshots = new Map<string, Ref<FoundSetSnapshot | null>>()
const anchors = new Map<string, { query: string; id: string }>()

function refFor(entity: string): Ref<FoundSetSnapshot | null> {
  let r = snapshots.get(entity)
  if (!r) { r = ref(null); snapshots.set(entity, r) }
  return r
}

/** List row-click: freeze the current display order as the traversable found set. */
export function captureFoundSet(snap: FoundSetSnapshot): void { refFor(snap.entity).value = snap }

export function useFoundSet(entity: string): { snapshot: Ref<FoundSetSnapshot | null>; clear: () => void } {
  const r = refFor(entity)
  return { snapshot: r, clear: () => { r.value = null } }
}

/** Detail "back": where the list should restore to (query + row to anchor). */
export function setReturnAnchor(entity: string, anchor: { query: string; id: string }): void { anchors.set(entity, anchor) }

/** List mount: one-shot read of the return anchor. */
export function consumeReturnAnchor(entity: string): { query: string; id: string } | null {
  const a = anchors.get(entity) ?? null
  anchors.delete(entity)
  return a
}
```

Barrel: `export { captureFoundSet, useFoundSet, setReturnAnchor, consumeReturnAnchor } from './use-found-set'`

- [ ] **Step 4: verify green** + typecheck. **Step 5: commit** — `git add packages/ui/src/use-found-set.ts packages/ui/src/use-found-set.test.ts packages/ui/src/index.ts && git commit -m "feat(ui): useFoundSet — per-tab found-set store + one-shot return anchor"`

---

### Task 4: `use-traverse.ts` skim controller

**Files:** Create `packages/ui/src/use-traverse.ts`; modify `packages/ui/src/index.ts`; test `packages/ui/src/use-traverse.test.ts` (fake timers).

**Interfaces:**
- Consumes: `positionOf`/`itemAt` (Task 1).
- Produces (consumed by Tasks 5 & 7):

```ts
export function useTraverse(opts: {
  snapshot: () => FoundSetSnapshot | null
  currentId: () => string
  settleMs?: number                 // default 250
  onSettle: (id: string) => void
}): {
  cursor: Ref<number>
  cursorItem: ComputedRef<FoundSetItem | null>
  position: ComputedRef<TraversePosition | null>   // derived from the CURSOR
  skimming: Ref<boolean>
  lastDirection: Ref<1 | -1>
  go: (delta: number) => void
  goTo: (index: number) => void      // settles immediately (explicit intent)
  first: () => void; last: () => void  // settle immediately
}
```

Semantics (spec D8/§4): `go` moves the cursor synchronously (clamped), sets `skimming`, restarts the settle timer; `goTo/first/last` settle immediately. Settles are generation-guarded: any newer interaction invalidates older pending settles; a settle only fires `onSettle` when the cursor item differs from `currentId()`. When `currentId()` changes externally (route landed), the cursor re-syncs and `skimming` clears.

- [ ] **Step 1: failing test** — `packages/ui/src/use-traverse.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useTraverse } from './use-traverse'
import type { FoundSetSnapshot } from './traverse'

const SNAP: FoundSetSnapshot = {
  kind: 'query', entity: 'records', query: 'q', title: 't', total: 9, capturedAt: 'now',
  items: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id.toUpperCase() })),
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function make(startId = 'a') {
  const currentId = ref(startId)
  const settled: string[] = []
  const t = useTraverse({
    snapshot: () => SNAP,
    currentId: () => currentId.value,
    onSettle: (id) => { settled.push(id); currentId.value = id }, // simulates router.replace landing
  })
  return { t, settled, currentId }
}

describe('useTraverse — skim', () => {
  it('rapid steps move the cursor instantly and settle ONCE at the end', () => {
    const { t, settled } = make('a')
    t.go(1); t.go(1); t.go(1)                      // a → cursor d, three steps inside 250ms
    expect(t.cursor.value).toBe(3)
    expect(t.cursorItem.value!.id).toBe('d')
    expect(t.skimming.value).toBe(true)
    expect(settled).toEqual([])                     // nothing fetched yet
    vi.advanceTimersByTime(250)
    expect(settled).toEqual(['d'])                  // one settle
    expect(t.skimming.value).toBe(false)            // currentId landed → skim cleared
  })
  it('slow steps settle each one', () => {
    const { t, settled } = make('a')
    t.go(1); vi.advanceTimersByTime(250)
    t.go(1); vi.advanceTimersByTime(250)
    expect(settled).toEqual(['b', 'c'])
  })
  it('clamps at the ends and tracks lastDirection', () => {
    const { t } = make('a')
    t.go(-1)
    expect(t.cursor.value).toBe(0)
    expect(t.lastDirection.value).toBe(-1)
    t.go(1); expect(t.lastDirection.value).toBe(1)
  })
  it('a settle for an already-current id does not fire', () => {
    const { t, settled } = make('a')
    t.go(1); t.go(-1)                               // back to a
    vi.advanceTimersByTime(250)
    expect(settled).toEqual([])
  })
  it('goTo/first/last settle immediately', () => {
    const { t, settled } = make('a')
    t.last()
    expect(settled).toEqual(['e'])
    t.first()
    expect(settled).toEqual(['e', 'a'])
    t.goTo(2)
    expect(settled).toEqual(['e', 'a', 'c'])
  })
  it('generation guard: an immediate settle after pending skim kills the old timer', () => {
    const { t, settled } = make('a')
    t.go(1)                                          // pending settle for b
    t.last()                                         // immediate settle e
    vi.advanceTimersByTime(300)
    expect(settled).toEqual(['e'])                   // b never fired
  })
  it('external currentId change re-syncs the cursor', async () => {
    const { t, currentId } = make('a')
    currentId.value = 'd'
    await Promise.resolve()                          // let the watcher flush
    expect(t.cursor.value).toBe(3)
    expect(t.skimming.value).toBe(false)
  })
})
```

- [ ] **Step 2: verify red.**
- [ ] **Step 3: implement** — `packages/ui/src/use-traverse.ts`:

```ts
// The skim controller (spec D8): every step moves a lightweight cursor instantly
// (labels from the snapshot — zero data access); a settle debounce triggers the real
// record load, generation-guarded so a stale settle can never fire after a newer
// interaction. Slow clicks screen records; fast clicks skim titles.
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { positionOf, itemAt, type FoundSetSnapshot, type FoundSetItem, type TraversePosition } from './traverse'

export function useTraverse(opts: {
  snapshot: () => FoundSetSnapshot | null
  currentId: () => string
  settleMs?: number
  onSettle: (id: string) => void
}): {
  cursor: Ref<number>
  cursorItem: ComputedRef<FoundSetItem | null>
  position: ComputedRef<TraversePosition | null>
  skimming: Ref<boolean>
  lastDirection: Ref<1 | -1>
  go: (delta: number) => void
  goTo: (index: number) => void
  first: () => void
  last: () => void
} {
  const settleMs = opts.settleMs ?? 250
  const cursor = ref(0)
  const skimming = ref(false)
  const lastDirection = ref<1 | -1>(1)
  let timer: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  const cursorItem = computed(() => {
    const s = opts.snapshot()
    return s ? itemAt(s, cursor.value) : null
  })
  const position = computed<TraversePosition | null>(() => {
    const s = opts.snapshot()
    const it = cursorItem.value
    return s && it ? positionOf(s, it.id) : null
  })

  function settle(immediate: boolean): void {
    if (timer) { clearTimeout(timer); timer = null }
    const gen = ++generation
    const fire = (): void => {
      if (gen !== generation) return
      const it = cursorItem.value
      if (it && it.id !== opts.currentId()) opts.onSettle(it.id)
    }
    if (immediate) fire()
    else timer = setTimeout(fire, settleMs)
  }

  function moveTo(index: number, immediate: boolean): void {
    const s = opts.snapshot()
    if (!s || s.items.length === 0) return
    const clamped = Math.min(Math.max(index, 0), s.items.length - 1)
    if (clamped > cursor.value) lastDirection.value = 1
    else if (clamped < cursor.value) lastDirection.value = -1
    cursor.value = clamped
    skimming.value = true
    settle(immediate)
  }

  const go = (delta: number): void => moveTo(cursor.value + delta, false)
  const goTo = (index: number): void => moveTo(index, true)
  const first = (): void => moveTo(0, true)
  const last = (): void => {
    const s = opts.snapshot()
    if (s) moveTo(s.items.length - 1, true)
  }

  watch(() => opts.currentId(), (id) => {
    const s = opts.snapshot()
    const p = s ? positionOf(s, id) : null
    if (p) cursor.value = p.index
    skimming.value = false
  }, { immediate: true })

  return { cursor, cursorItem, position, skimming, lastDirection, go, goTo, first, last }
}
```

Barrel: `export { useTraverse } from './use-traverse'`

- [ ] **Step 4: verify green** (`pnpm vitest run packages/ui/src/use-traverse.test.ts`, then `pnpm test && pnpm typecheck`). **Step 5: commit** — `git add packages/ui/src/use-traverse.ts packages/ui/src/use-traverse.test.ts packages/ui/src/index.ts && git commit -m "feat(ui): useTraverse — skim controller with generation-guarded settle"`

---

### Task 5: `TraverseBar.vue` + `TraverseScrubber.vue`

**Files:** Create `packages/ui-nuxt/src/runtime/components/item/TraverseBar.vue` and `packages/ui-nuxt/src/runtime/internal/TraverseScrubber.vue`; modify `packages/ui-nuxt/uno.config.ts` (safelist `i-lucide-chevron-up`, `i-lucide-chevron-down`, `i-lucide-chevrons-up`, `i-lucide-chevrons-down` — check which are already listed) and `packages/ui-nuxt/src/runtime/core/locale-th.ts`.

**Interfaces:**
- Consumes: `TraversePosition`, `FoundSetSnapshot`, `FoundSetItem` (Task 1). The PAGE owns `useTraverse`; the bar is presentational + keyboard.
- Produces (consumed by Task 7):
  - `TraverseBar` props: `{ snapshot: FoundSetSnapshot; position: TraversePosition | null; skimming?: boolean; editing?: boolean }`; emits: `go(delta: number)`, `goTo(index: number)`, `first()`, `last()`, `back()`.
  - Keyboard (owned by the bar, window listener): `j`/`⌥↓` → `go(1)`, `k`/`⌥↑` → `go(-1)`; inert when `editing` or when `event.target` is an input/textarea/select/contenteditable.
  - `TraverseScrubber` (internal) props: `{ snapshot: FoundSetSnapshot; index: number }`; emits `jump(index: number)`.

Before writing: READ `packages/ui-nuxt/src/runtime/components/SavedSearchMenu.vue` for the family's dropdown/popover idiom (trigger button + panel + outside-click close) and mirror it; read `packages/ui-nuxt/src/runtime/internal/Popover.vue` and use it if it fits the same way the menus do.

TraverseBar structure (behavioral contract; write idiomatic template code mirroring the codebase):
- Root: `<div class="nui-traverse sticky top-0 z-10 bg-nui-bg flex items-center gap-2 py-1.5" :class="editing ? 'opacity-50 pointer-events-none' : ''">`.
- Left, flexing: back button (`nui-btn-ghost`) — `←` + `<NuiText :reps="[snapshot.title]"/>` (explicit import of NuiText, as RecordDetail does), `:title="snapshot.title"`, click → `emit('back')`.
- Right, FIXED cluster (`shrink-0 flex items-center gap-1`, spec D9):
  - first `⤒` (`i-lucide-chevrons-up`), prev `▲` (`i-lucide-chevron-up`), position button, next `▼` (`i-lucide-chevron-down`), last `⤓` (`i-lucide-chevrons-down`) — all `nui-icon-btn`.
  - prev/next disabled via `position?.atFirst`/`atLast` (`:disabled` + `disabled:opacity-40`); tooltips `:title` = `t('nui.traverse.prev','Previous')` + (`position?.prev?.label` appended when present), same for next. On containers ≥640 (use the existing `useContainerSize` on the bar root) show inline muted destination labels beside prev/next (`text-xs text-nui-muted max-w-32 truncate`).
  - position button: `tabular-nums` text `{{ position ? position.index + 1 : '–' }}/{{ snapshot.items.length }}` with `:style="{ minWidth: posWidth }"` where `posWidth` = `` `${String(snapshot.items.length).length * 2 + 1}ch` `` — fixed width per D9; `aria-haspopup`; click toggles the scrubber. While `skimming`, give the counter `text-nui-accent` (live feedback).
- Scrubber panel (TraverseScrubber inside the popover/panel):
  - Header: `<NuiText :reps="[snapshot.title]"/>` + `{{ snapshot.items.length }} {{ t('nui.traverse.of','of') }} {{ snapshot.total }}` muted.
  - Typed jump: `<input type="number" min="1" :max="snapshot.items.length" class="nui-field w-20">` + `t('nui.traverse.goto','Go to #')` label; Enter → `emit('jump', n - 1)`.
  - The list: `<ul class="max-h-80 overflow-y-auto">`; iterate `snapshot.items` with index; when an item's `group` differs from the previous item's `group` (compare joined trails), first render banner row(s) for the changed levels (`text-xs font-semibold text-nui-muted`, indent by level). Item rows: button, `truncate`, current index highlighted `bg-nui-bg-accent text-nui-accent`; click → `emit('jump', i)`. Current item scrolled into view when the panel opens (`scrollIntoView({ block: 'nearest' })` on mount).
- Keyboard listener in TraverseBar: `onMounted`/`onBeforeUnmount` window `keydown`; guard `props.editing`, `e.metaKey/ctrlKey`, and target element tag/contenteditable; `j` and `Alt+ArrowDown` → `emit('go', 1)`; `k` and `Alt+ArrowUp` → `emit('go', -1)`; `preventDefault()` on handled keys.
- locale-th.ts additions next to `nui.detail.*`: `'nui.traverse.prev': 'ก่อนหน้า'`, `'nui.traverse.next': 'ถัดไป'`, `'nui.traverse.first': 'รายการแรก'`, `'nui.traverse.last': 'รายการสุดท้าย'`, `'nui.traverse.of': 'จาก'`, `'nui.traverse.goto': 'ไปที่ #'`, `'nui.traverse.back': 'กลับไปที่รายการ'`.

- [ ] **Step 1:** Read SavedSearchMenu.vue + Popover.vue; implement both components per the contract.
- [ ] **Step 2:** `pnpm build && pnpm typecheck` clean; `grep -o 'i-lucide-chevrons-up' packages/ui-nuxt/dist/style.css | head -1` → present.
- [ ] **Step 3: commit** — `git add packages/ui-nuxt/src/runtime/components/item/TraverseBar.vue packages/ui-nuxt/src/runtime/internal/TraverseScrubber.vue packages/ui-nuxt/uno.config.ts packages/ui-nuxt/src/runtime/core/locale-th.ts && git commit -m "feat(ui-nuxt): TraverseBar + scrubber — fixed vertical cluster, named destinations, typed jump"`

---

### Task 6: `ItemPath.vue` + `CollectionList` anchorKey

**Files:** Create `packages/ui-nuxt/src/runtime/components/item/ItemPath.vue`; modify `packages/ui-nuxt/src/runtime/components/CollectionList.vue`.

**Interfaces:**
- Consumes: `PathSegment` (Task 2), `useContainerSize`, `NuiText`.
- Produces (consumed by Task 7):
  - `ItemPath` props `{ segments: readonly PathSegment[] }`; emits `back()` (group segment click), `navigate({ collection, id })` (entity segment click).
  - `CollectionList` new optional prop `anchorKey?: string` — when set/changed, scrolls the matching row into view and flash-highlights it once.

ItemPath contract: a single line, list-title typography — group/entity segments as `nui-btn-ghost`-style inline buttons (`text-nui-muted hover:text-nui-accent`), `›` separators (`text-nui-subtle`), terminal segment `<NuiText :reps="[label]"/>` in `text-lg font-semibold text-nui-fg`. Container `<448px`: render only the FIRST segment, an ellipsis `…`, and the terminal (when >2 segments). Entity segments with `ref` emit `navigate(seg.ref)`; group segments emit `back()`.

CollectionList anchorKey: READ the row `<tr>` rendering first (two sites: the grouped `line.kind === 'row'` tr near line ~513 and the ungrouped tr near ~535; keys derive from `rowKey ? rowKey(row) : row.id`). Add `:data-row-key="..."` (the same key expression) to both trs. Add the prop + a `watch(() => props.anchorKey, ...)` that (nextTick) queries `[data-row-key="${anchorKey}"]` within the component root, `scrollIntoView({ block: 'center' })`, adds class `nui-row-anchored`, removes it after ~1.6s. Scoped CSS:

```css
.nui-row-anchored td { animation: nui-anchor-flash 1.6s ease-out; }
@keyframes nui-anchor-flash {
  0%, 35% { background-color: color-mix(in oklab, var(--nui-accent) 18%, transparent); }
  100% { background-color: transparent; }
}
```

- [ ] **Step 1:** Implement ItemPath; add anchorKey to CollectionList.
- [ ] **Step 2:** `pnpm build && pnpm typecheck && pnpm test` clean.
- [ ] **Step 3: commit** — `git add packages/ui-nuxt/src/runtime/components/item/ItemPath.vue packages/ui-nuxt/src/runtime/components/CollectionList.vue && git commit -m "feat(ui-nuxt): ItemPath path-title + CollectionList anchorKey scroll/flash"`

---

### Task 7: showcase wiring

**Files:** Modify `examples/showcase/app/pages/records/index.vue`, `artists/index.vue`, `labels/index.vue`, `records/[id].vue`, `artists/[id].vue`, `labels/[id].vue`.

**Interfaces — Consumes:** everything above. READ each page before editing.

**7a — capture on row click (all three list pages).** Replace the bare `@row-click` handler with a capture + navigate. Records page (adapt names to each page — artists/labels use `buildSimpleView`; their primary label field is the localized `name`):

```ts
import { captureFoundSet, consumeReturnAnchor, type FoundSetItem } from '@noy-db/ui'

function foundSetItems(): FoundSetItem[] {
  // Grouped: walk groupLines in display order, tracking the banner trail by level.
  const lines = list.groupLines.value
  if (lines.length > 0) {
    const trail: string[] = []
    const items: FoundSetItem[] = []
    for (const line of lines) {
      if (line.kind === 'group') { trail.length = line.level; trail[line.level] = line.label }
      else items.push({ id: String(line.row.id), label: String(line.row.title ?? line.row.name ?? line.row.id), group: [...trail] })
    }
    return items
  }
  return list.visibleRows.value.map((r: any) => ({ id: String(r.id), label: String(r.title ?? r.name ?? r.id) }))
}

function openRecord(r: any): void {
  captureFoundSet({
    kind: 'query', entity: 'records',
    query: query.value,                       // the SearchBox v-model string (check the page's actual ref name)
    title: searchText.value.title,            // the existing narrate computed (records page: `searchText`)
    items: foundSetItems(),
    total: view.value.rows.length,            // unfiltered base rows (check the page's base-rows source)
    capturedAt: new Date().toISOString(),
  })
  navigateTo(`/records/${r.id}`)
}
```
Template: `@row-click="openRecord"`. Artists/labels pages: entity `'artists'`/`'labels'`, their own query ref + narrate computed (labels/artists pages compute narration for the print header — reuse; if a page lacks one, compute `narrate(list.ast.value, schema, { t }).title`).

**7b — return-restore (all three list pages).** On setup (after `list` exists):

```ts
const anchor = consumeReturnAnchor('records')
if (anchor) query.value = anchor.query
const anchorKey = ref<string | undefined>()
onMounted(() => { if (anchor) nextTick(() => { anchorKey.value = anchor.id }) })
```
Pass `:anchor-key="anchorKey"` to `<CollectionList>`.

**7c — detail pages.** Records page gains (adapt to the existing phase-3 setup — `item`, `described`, `fields`, `options` already exist):

```ts
import { useFoundSet, setReturnAnchor, useTraverse, pathSegments } from '@noy-db/ui'

const router = useRouter()
const { snapshot } = useFoundSet('records')
const traverse = useTraverse({
  snapshot: () => snapshot.value,
  currentId: () => (route.params.id as string),
  onSettle: (nid) => { router.replace(`/records/${nid}`) },
})
function goBack(): void {
  if (snapshot.value) setReturnAnchor('records', { query: snapshot.value.query, id: String(route.params.id) })
  navigateTo('/records')
}
const segments = computed(() => pathSegments({
  item: traverse.cursorItem.value,
  record: traverse.skimming.value ? null : (item.record.value as Record<string, unknown> | null),
  fields: described.fields,
  naturalOrder: ['labelId', 'artistId'],
  labelFor: (field, id) => options.value[field as 'artistId' | 'labelId']?.find((o) => o.value === id)?.label,
  titleLabel: traverse.cursorItem.value?.label
    ?? (item.record.value ? String((item.record.value as any).title ?? route.params.id) : String(route.params.id)),
}))
```
Template (above `<RecordDetail>`; the old back-link `<NuxtLink to="/records">` is REPLACED by the bar when a snapshot exists, kept as fallback when not):

```vue
<TraverseBar
  v-if="snapshot"
  :snapshot="snapshot" :position="traverse.position.value"
  :skimming="traverse.skimming.value" :editing="item.editing.value"
  @go="traverse.go" @go-to="traverse.goTo" @first="traverse.first" @last="traverse.last" @back="goBack"
/>
<NuxtLink v-else to="/records" class="text-sm text-nui-accent hover:underline">← records</NuxtLink>
<ItemPath
  :segments="segments"
  @back="goBack"
  @navigate="(r) => navigateTo(`/${r.collection}/${r.id}`)"
/>
<div :class="traverse.skimming.value ? 'opacity-60 pointer-events-none' : ''">
  <CoverImage ... /><RecordDetail ... />
</div>
```
IMPORTANT — route-change reload: the page's record fetch is top-level `await` in setup; verify that `router.replace` to another id re-runs setup (Nuxt pages re-run setup when the path changes). If the record does NOT reload on replace (component reuse), add `definePageMeta({ key: (route) => route.fullPath })`. Verify with the dev server before committing. Missing-record skip (spec §4): after load, `if (!item.record.value && snapshot.value) traverse.go(traverse.lastDirection.value)`.
Artists/labels detail pages: same TraverseBar wiring with their entity names; `pathSegments` with no `naturalOrder` (their paths are group-trail or title-only); titleLabel from the record's localized `name` map first non-missing value or cursor label.

**7d — verification.** Showcase `pnpm vitest run` green; root gate green; dev-loop prep (build → store sync ui+ui-nuxt → cache clear). Do NOT start the dev server (controller runs the browser pass).

- [ ] **Step 1:** 7a+7b on the three list pages. **Step 2:** 7c on the three detail pages. **Step 3:** 7d. **Step 4: commit** — `git add examples/showcase && git commit -m "feat(showcase): found-set traversal — capture, traverse bar, path title, return-restore"`

---

### Task 8: gate + docs + changelogs

**Files:** Modify `docs/ui-nuxt/3.components.md` (Item-family table: TraverseBar + ItemPath rows; CollectionList row gains anchorKey mention), `docs/ui/3.search-engine.md` (one paragraph: the found set as a frozen, query-derivable snapshot), `packages/ui/CHANGELOG.md` + `packages/ui-nuxt/CHANGELOG.md` `[Unreleased]` entries. NO version bump.

- [ ] **Step 1:** Root `pnpm build && pnpm test && pnpm typecheck && pnpm lint` + showcase `pnpm vitest run` → ALL green.
- [ ] **Step 2:** Docs + changelog entries (write from what actually shipped).
- [ ] **Step 3: commit** — `git commit -m "docs: traverse navigation — components, search-engine found-set note, unreleased changelogs"`

---

## Self-review notes

- **Spec coverage:** D1/D2 → Tasks 1, 7a (frozen capture in display order); D3/D9/D13 → Task 5; D4 → Task 7c (`router.replace`); D5 → Task 7c (`v-if="snapshot"` + fallback link); D6/§6 invariants → Tasks 3 (per-tab store comment), 5/6 (button-based elements, href layerable); D7 + §4 skim fidelity → Tasks 2, 6, 7c (record: null while skimming); D8 → Task 4; D10 → Task 5 (editing prop) + 7c; D11 → Task 1 (`kind`); D12 → Task 6/7c (group segment → `back`). Scrubber grouped banners → Task 5. Return-restore (rule 5) → Tasks 3, 6, 7b. Missing-record skip → Task 7c. Testing §5 engine/composable coverage → Tasks 1–4; browser pass = controller.
- **Type consistency:** `FoundSetItem/FoundSetSnapshot/TraversePosition/PathSegment` and the `useTraverse` return shape are identical across Tasks 1–7; TraverseBar emits (`go/goTo/first/last/back`) match Task 7c's bindings (`@go-to` kebab).
- **Judgment calls flagged:** Task 5 mirrors the SavedSearchMenu popover idiom (read first); Task 6 must read CollectionList's two row-`<tr>` sites; Task 7 adapts to each page's actual ref names (`query`, `searchText`, `view`) — read before editing; Nuxt page-reuse on `router.replace` must be verified in Task 7c and fixed with a page key if needed.
