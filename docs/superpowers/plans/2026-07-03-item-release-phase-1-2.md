# Item Release — Phases 1–2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the upstream noy-db metadata/bundle changes (phase 1) and the detail-page layout foundation with schema-driven card groups + dual-language cells (phase 2) of the Item Release spec (`docs/superpowers/specs/2026-07-03-item-release-design.md`).

**Architecture:** Phase 1 touches the noy-db repo (`/Users/vicio/lanna-db/noy-db`): `FieldMeta` gains `group`/`order` flowing through `describe()`, and `_history` joins the `.noydb` bundle internals. After a hub pre-release is adopted, phase 2 works in noy-db-ui: a pure `groups.ts` engine module, i18n-map awareness in `detail.ts`, a container-measuring composable in ui-nuxt, and a `RecordDetail` upgrade — exercised by the showcase (labels gain a bilingual `notes` field; detail pages switch to `locale:'raw'` reads).

**Tech Stack:** TypeScript ESM, zod (validator), vitest, Vue 3 / Nuxt 4, UnoCSS (pre-compiled), pnpm + turbo in BOTH repos.

## Global Constraints

- **Never** add Claude attribution to commits/PRs/CHANGELOGs (family rule; overrides harness default).
- **Never** publish without explicit user confirmation (Task 3 has a hard stop).
- noy-db repo code style: `exactOptionalPropertyTypes`-safe conditional spreads (`...(x !== undefined ? { x } : {})`) — copy the surrounding style exactly.
- `@noy-db/ui` engine modules are pure + framework-free (no Vue imports in `packages/ui/src`).
- Colors/styling: only the `--nui-*` token palette and existing `nui-*` shortcuts; dark parity required.
- Both repos: run single tests with `pnpm vitest run <path>`; full suite `pnpm test` at repo root.
- Peer-dep floors bump by range (`^0.4.0-pre.0`), never pins; versions are independent per repo.
- Showcase dev loop after library changes: `pnpm build` (root) → sync pnpm store copy → clear `node_modules/.vite`, `node_modules/.cache/vite`, `.nuxt` → fresh browser context (see memory: 504 "Outdated Optimize Dep" means stale cache).

---

# PHASE 1 — upstream noy-db (`/Users/vicio/lanna-db/noy-db`)

### Task 1: `FieldMeta.group` + `FieldMeta.order` through `describe()`

**Files:**
- Modify: `packages/hub/src/with-shape/introspection/field-meta.ts`
- Modify: `packages/hub/src/with-shape/introspection/describe.ts`
- Test: `packages/hub/__tests__/introspection/field-group-order.test.ts` (create)

**Interfaces:**
- Consumes: existing `resolveFieldMeta(key, {channel, zodMeta, inferred})`, `DescribedField`, `ZOD_META_KEYS`.
- Produces: `FieldMeta.group?: string`, `FieldMeta.order?: number`; `DescribedField.group?: string`, `DescribedField.order?: number` — consumed by noy-db-ui Task 4 (`groupFields`). Merge precedence unchanged: channel > zod `.meta()` > inferred.

- [ ] **Step 1: Write the failing test**

Create `packages/hub/__tests__/introspection/field-group-order.test.ts`. Match the vault-construction imports used by the sibling `packages/hub/__tests__/introspection/describe.test.ts` (open it first; if it builds a vault differently — e.g. a local memory store helper — reuse that helper instead of the import shown here):

```ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createNoydb } from '../../src/kernel/noydb.js'
import { memoryStore } from './helpers.js' // ← ALIGN with describe.test.ts's actual store setup

describe('FieldMeta group/order flow through describe()', () => {
  async function vaultWith(fieldMeta: Record<string, Record<string, unknown>>) {
    const db = await createNoydb({ store: memoryStore(), user: 'owner', secret: 'test-secret' })
    const vault = await db.openVault('v', { create: true })
    return vault.collection('invoices', {
      schema: z.object({ id: z.string(), total: z.number(), issuedOn: z.string() }),
      fieldMeta: fieldMeta as never,
    })
  }

  it('channel fieldMeta group/order surface on DescribedField', async () => {
    const col = await vaultWith({
      total: { label: 'Total', group: 'Amounts', order: 2 },
      issuedOn: { label: 'Issued', group: 'Dates', order: 1 },
    })
    const fields = col.describe().fields
    const total = fields.find((f) => f.key === 'total')!
    expect(total.group).toBe('Amounts')
    expect(total.order).toBe(2)
    const issued = fields.find((f) => f.key === 'issuedOn')!
    expect(issued.group).toBe('Dates')
    expect(issued.order).toBe(1)
  })

  it('fields stay alphabetically sorted in the emitted array (group/order are metadata only)', async () => {
    const col = await vaultWith({ total: { label: 'Total', order: 1 } })
    const keys = col.describe().fields.map((f) => f.key)
    expect(keys).toEqual([...keys].sort())
  })

  it('zod .meta() group/order flow through the async describe path, channel wins', async () => {
    const db = await createNoydb({ store: memoryStore(), user: 'owner', secret: 'test-secret' })
    const vault = await db.openVault('v2', { create: true })
    const col = vault.collection('items', {
      schema: z.object({
        id: z.string(),
        a: z.number().meta({ group: 'FromZod', order: 7 }),
        b: z.number().meta({ group: 'Loser' }),
      }),
      fieldMeta: { b: { label: 'B', group: 'ChannelWins' } } as never,
    })
    const fields = (await col.describe({})).fields
    expect(fields.find((f) => f.key === 'a')!.group).toBe('FromZod')
    expect(fields.find((f) => f.key === 'a')!.order).toBe(7)
    expect(fields.find((f) => f.key === 'b')!.group).toBe('ChannelWins')
  })

  it('absent group/order are absent, not undefined-valued keys', async () => {
    const col = await vaultWith({ total: { label: 'Total' } })
    const total = col.describe().fields.find((f) => f.key === 'total')!
    expect('group' in total).toBe(false)
    expect('order' in total).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/vicio/lanna-db/noy-db && pnpm vitest run packages/hub/__tests__/introspection/field-group-order.test.ts`
Expected: FAIL — `group`/`order` are `undefined` (TS may already fail compile: property does not exist on `FieldMeta`; that also counts as the red state).

- [ ] **Step 3: Implement — `field-meta.ts`**

In `FieldMeta`, after the `widget?` member add:

```ts
  /**
   * Card/section grouping hint for detail & form layouts (e.g. 'Identity',
   * 'Amounts'). Purely descriptive metadata — consumers group; describe()
   * keeps emitting fields alphabetically.
   */
  group?: string
  /** Relative ordering hint within (and across) groups. Lower renders first. */
  order?: number
```

In `resolveFieldMeta`, alongside the other picks add:

```ts
  const group = pick('group')
  const order = pick('order')
```

and in the returned object (before the closing brace, matching the spread style):

```ts
    ...(group !== undefined ? { group } : {}),
    ...(order !== undefined ? { order } : {}),
```

- [ ] **Step 4: Implement — `describe.ts`**

(a) In `interface DescribedField`, after `readonly description?: string` add:

```ts
  /** Card/section grouping hint for detail & form layouts. From fieldMeta/zod .meta(). */
  readonly group?: string
  /** Relative ordering hint within and across groups. Lower renders first. */
  readonly order?: number
```

(b) In `ZOD_META_KEYS` add `'group', 'order'` to the set literal.

(c) In the field-assembly spread (the `const field: DescribedField = {` block), after the `description` spread add:

```ts
      ...(resolved.group !== undefined ? { group: resolved.group } : {}),
      ...(resolved.order !== undefined ? { order: resolved.order } : {}),
```

- [ ] **Step 5: Run the new test + the neighboring describe tests**

Run: `pnpm vitest run packages/hub/__tests__/introspection/ packages/hub/__tests__/describe-contract.test.ts packages/hub/__tests__/describe-extraction.test.ts`
Expected: ALL PASS (the contract test may snapshot DescribedField keys — if it fails on the two new optional keys, update the snapshot/expected shape to include them; that is the intended contract change).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck` → clean. Then:

```bash
git add packages/hub/src/with-shape/introspection/field-meta.ts packages/hub/src/with-shape/introspection/describe.ts packages/hub/__tests__/introspection/field-group-order.test.ts
git commit -m "feat(describe): FieldMeta group/order — layout grouping hints on DescribedField

Descriptive-only: fields stay alphabetically emitted; channel > zod .meta()
> inferred precedence unchanged. Consumed by the UI item family."
```

---

### Task 2: `_history` travels in the `.noydb` bundle

**Files:**
- Modify: `packages/hub/src/with-pod/backup.ts` (the `internalNames` array, ~line 108)
- Test: `packages/hub/__tests__/bundle-history-roundtrip.test.ts` (create)

**Interfaces:**
- Consumes: `dumpVault` internal-collection enumeration; `loadVault` already restores any `backup._internal` entries generically (no load-side change).
- Produces: `collection.history(id)` / `getVersion` / `diff` work on a bundle-restored vault — consumed by the P4 history panel (later plan) and asserted here.

- [ ] **Step 1: Write the failing test**

Create `packages/hub/__tests__/bundle-history-roundtrip.test.ts`. **Copy the local `memory()` store helper verbatim from `packages/hub/__tests__/bundle-blobs-roundtrip.test.ts`** (the one whose `loadAll` filters underscore collections — that realism is what makes the test meaningful), then:

```ts
import { describe, it, expect } from 'vitest'
import { createNoydb } from '../src/kernel/noydb.js'
import { withHistory } from '../src/with-commit/history/index.js'
// … memory() helper copied from bundle-blobs-roundtrip.test.ts …

describe('.noydb bundle includes _history', () => {
  it('history(), getVersion() and diff() survive dump → fresh-vault load', async () => {
    const db = await createNoydb({ store: memory(), user: 'owner', secret: 's3cret', historyStrategy: withHistory() })
    const vault = await db.openVault('v', { create: true })
    const col = vault.collection<{ id: string; name: string; qty: number }>('items')
    await col.put('i1', { id: 'i1', name: 'first', qty: 1 })
    await col.put('i1', { id: 'i1', name: 'renamed', qty: 1 })

    const dump = await vault.dump()
    expect(JSON.parse(dump)._internal?._history).toBeDefined()   // ← dump-side assertion

    const db2 = await createNoydb({ store: memory(), user: 'owner', secret: 's3cret', historyStrategy: withHistory() })
    const vault2 = await db2.openVault('v', { create: true })
    await vault2.load(dump)
    const col2 = vault2.collection<{ id: string; name: string; qty: number }>('items')

    const entries = await col2.history('i1')
    expect(entries).toHaveLength(2)                               // newest first
    expect(entries[0]!.record.name).toBe('renamed')
    expect((await col2.getVersion('i1', 1))!.name).toBe('first')
    const changes = await col2.diff('i1', 1, 2)
    expect(changes).toEqual([{ path: 'name', type: 'changed', from: 'first', to: 'renamed' }])
  })
})
```

(If `vault.dump()` / `vault.load()` signatures differ from `verifiable-backup.test.ts`'s usage, match that file — it is the canonical dump/load test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/hub/__tests__/bundle-history-roundtrip.test.ts`
Expected: FAIL at the `_internal._history` assertion (undefined) and/or `history('i1')` returning fewer than 2 entries after restore.

- [ ] **Step 3: Implement**

In `packages/hub/src/with-pod/backup.ts`, the `internalNames` array currently reads:

```ts
  const internalNames = [
    LEDGER_COLLECTION, LEDGER_DELTAS_COLLECTION, SCHEMAS_COLLECTION, SEQUENCE_COLLECTION,
    '_blob_index', '_blob_chunks', '_blob_eviction_audit',
    ...Object.keys(snapshot).flatMap((c) => [`_blob_slots_${c}`, `_blob_versions_${c}`]),
  ]
```

Add `'_history'` (literal, mirroring the inlined blob literals — the constant is module-private to `history.ts`):

```ts
  const internalNames = [
    LEDGER_COLLECTION, LEDGER_DELTAS_COLLECTION, SCHEMAS_COLLECTION, SEQUENCE_COLLECTION,
    '_history', // full-snapshot version history — so history()/getVersion()/diff() survive the bundle
    '_blob_index', '_blob_chunks', '_blob_eviction_audit',
    ...Object.keys(snapshot).flatMap((c) => [`_blob_slots_${c}`, `_blob_versions_${c}`]),
  ]
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run packages/hub/__tests__/bundle-history-roundtrip.test.ts packages/hub/__tests__/verifiable-backup.test.ts packages/hub/__tests__/bundle-blobs-roundtrip.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Full hub suite + commit**

Run: `pnpm --filter @noy-db/hub test` → PASS. Then:

```bash
git add packages/hub/src/with-pod/backup.ts packages/hub/__tests__/bundle-history-roundtrip.test.ts
git commit -m "fix(backup): include _history in the bundle internals

history()/getVersion()/diff() now survive a .noydb dump→load; load-side
already restored _internal generically."
```

---

### Task 3: hub pre-release + adoption in noy-db-ui — ⚠ USER GATE

**Files:**
- Modify: `packages/hub/package.json` (version), `packages/hub/CHANGELOG.md` (noy-db repo — follow its existing release conventions)
- Modify (noy-db-ui): `packages/ui/package.json`, `packages/ui-nuxt/package.json` (hub peer + dev dep floors)

**Interfaces:**
- Produces: published `@noy-db/hub@0.4.0-pre.0` on the `next` tag, with `DescribedField.group/order` types — Tasks 4+ typecheck against the installed package.

- [ ] **Step 1: Version + changelog in noy-db** — bump `packages/hub` to `0.4.0-pre.0`, changelog entry covering both Task 1 and Task 2, matching the repo's existing entry style. Commit per repo convention.
- [ ] **Step 2: ⚠ STOP — ask the user to confirm the publish** ("Never publish without explicit user confirmation"). Publish via noy-db's own release flow (check its CI/release scripts — do NOT run raw `npm publish` if a workflow exists). Verify: `npm view @noy-db/hub@0.4.0-pre.0 version` and `dist-tags`.
- [ ] **Step 3: Adopt in noy-db-ui** — in both `packages/ui/package.json` and `packages/ui-nuxt/package.json` bump every `@noy-db/hub` range to `^0.4.0-pre.0` (peerDependencies AND devDependencies, mirroring commit `7c54006`). Run `pnpm install` at the noy-db-ui root, then `pnpm build && pnpm test && pnpm typecheck` → all green.
- [ ] **Step 4: Commit** — `chore: adopt @noy-db/hub 0.4.0-pre.0 — peer floor ^0.4.0-pre.0 (group/order metadata, _history in bundle)`.

---

# PHASE 2 — noy-db-ui (`/Users/vicio/lanna-db/noy-db-ui`)

### Task 4: `groups.ts` — describe()-driven field grouping (engine)

**Files:**
- Create: `packages/ui/src/groups.ts`
- Modify: `packages/ui/src/index.ts` (barrel — add export next to the detail/form line, §"Item family")
- Test: `packages/ui/src/groups.test.ts` (create)

**Interfaces:**
- Consumes: `DescribedField` (now with `group?`/`order?`) from `@noy-db/hub`.
- Produces: `interface FieldGroup { id: string; title: string; fields: DescribedField[] }` and `groupFields(fields: readonly DescribedField[], t?: (key: string, fallback: string) => string): FieldGroup[]` — consumed by `RecordDetail.vue` (Task 6) and later by `RecordForm`/P3.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/groups.test.ts` (builder `f` copied from `detail.test.ts` conventions):

```ts
import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { groupFields } from './groups'

const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField

describe('groupFields', () => {
  it('groups by field.group, ordered by the minimum member order', () => {
    const groups = groupFields([
      f({ key: 'total', group: 'Amounts', order: 10 }),
      f({ key: 'issuedOn', group: 'Dates', order: 1 }),
      f({ key: 'vat', group: 'Amounts', order: 11 }),
    ])
    expect(groups.map((g) => g.id)).toEqual(['Dates', 'Amounts'])
    expect(groups[1]!.fields.map((x) => x.key)).toEqual(['total', 'vat'])
  })

  it('fields sort by order inside a group; missing order sinks last, ties keep input order', () => {
    const groups = groupFields([
      f({ key: 'b', group: 'G' }),           // no order → last
      f({ key: 'c', group: 'G', order: 2 }),
      f({ key: 'a', group: 'G', order: 1 }),
    ])
    expect(groups[0]!.fields.map((x) => x.key)).toEqual(['a', 'c', 'b'])
  })

  it('ungrouped fields land in a default bucket, last, with the localizable title', () => {
    const t = (key: string, fallback: string) => (key === 'nui.detail.details' ? 'รายละเอียด' : fallback)
    const groups = groupFields([f({ key: 'x' }), f({ key: 'total', group: 'Amounts', order: 1 })], t)
    expect(groups.map((g) => g.id)).toEqual(['Amounts', '_default'])
    expect(groups[1]!.title).toBe('รายละเอียด')
  })

  it('group titles localize via t(nui.detail.group.<id>) with the id as fallback', () => {
    const t = (key: string, fallback: string) => (key === 'nui.detail.group.Amounts' ? 'ยอดเงิน' : fallback)
    expect(groupFields([f({ key: 'total', group: 'Amounts' })], t)[0]!.title).toBe('ยอดเงิน')
  })

  it('all fields ungrouped → single default group (back-compat with the one-card render)', () => {
    const groups = groupFields([f({ key: 'a' }), f({ key: 'b' })])
    expect(groups).toHaveLength(1)
    expect(groups[0]!).toMatchObject({ id: '_default', title: 'Details' })
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run packages/ui/src/groups.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `packages/ui/src/groups.ts`**

```ts
// Card grouping for the Item family — turns describe()'s group/order metadata into ordered
// card sections. Pure + framework-free; RecordDetail and RecordForm share it.
import type { DescribedField } from '@noy-db/hub'

export interface FieldGroup {
  /** The raw group id from field.group ('_default' for the ungrouped bucket). */
  id: string
  /** Localized title: t(`nui.detail.group.${id}`, id); default bucket uses t('nui.detail.details', 'Details'). */
  title: string
  fields: DescribedField[]
}

const DEFAULT_ID = '_default'

/** Group fields into ordered card sections. Groups sort by their minimum member `order`
 *  (groups with no ordered member sink last, default bucket very last); fields inside a
 *  group sort by `order` (missing → last, stable). */
export function groupFields(
  fields: readonly DescribedField[],
  t: (key: string, fallback: string) => string = (_k, fb) => fb,
): FieldGroup[] {
  const buckets = new Map<string, DescribedField[]>()
  for (const field of fields) {
    const id = field.group ?? DEFAULT_ID
    const bucket = buckets.get(id)
    if (bucket) bucket.push(field)
    else buckets.set(id, [field])
  }

  const rank = (id: string, members: DescribedField[]): number => {
    if (id === DEFAULT_ID) return Number.POSITIVE_INFINITY
    const orders = members.map((f) => f.order).filter((o): o is number => o !== undefined)
    return orders.length ? Math.min(...orders) : Number.MAX_SAFE_INTEGER
  }

  return [...buckets.entries()]
    .sort((a, b) => rank(a[0], a[1]) - rank(b[0], b[1]))
    .map(([id, members]) => ({
      id,
      title: id === DEFAULT_ID ? t('nui.detail.details', 'Details') : t(`nui.detail.group.${id}`, id),
      fields: members
        .map((f, i) => ({ f, i }))
        .sort((a, b) => (a.f.order ?? Number.MAX_SAFE_INTEGER) - (b.f.order ?? Number.MAX_SAFE_INTEGER) || a.i - b.i)
        .map((x) => x.f),
    }))
}
```

Barrel (`packages/ui/src/index.ts`), next to the existing Item-family line:

```ts
export { groupFields, type FieldGroup } from './groups'
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run packages/ui/src/groups.test.ts` → PASS. Also `pnpm --filter @noy-db/ui test && pnpm typecheck`.

- [ ] **Step 5: Commit** — `git add packages/ui/src/groups.ts packages/ui/src/groups.test.ts packages/ui/src/index.ts && git commit -m "feat(ui): groupFields — describe()-driven card grouping for the item family"`.

---

### Task 5: dual-language cells in `detail.ts`

**Files:**
- Modify: `packages/ui/src/detail.ts`
- Test: `packages/ui/src/detail.test.ts` (extend)

**Interfaces:**
- Consumes: `DescribedField.i18n?.locales`.
- Produces: `DetailCell.i18n?: { locale: string; display: string; missing: boolean }[]` — when a field is i18n-declared AND the record value is a locale map (i.e. the host read with `{ locale: 'raw' }`). `display` stays the first non-missing locale's value (print/back-compat). Resolved-string reads (host passed `{ locale: 'en' }`) are untouched. Consumed by `RecordDetail.vue` (Task 6).

- [ ] **Step 1: Add failing tests to `detail.test.ts`**

```ts
describe('formatDetailCell — i18n locale maps (raw reads)', () => {
  const nameField = f({ key: 'name', label: 'Name', i18n: { locales: ['en', 'th'] } })

  it('explodes a raw locale map into per-locale entries, display = first non-missing', () => {
    const c = formatDetailCell(nameField, { name: { en: 'Groove Hill', th: 'กรูฟ ฮิลล์' } })
    expect(c.display).toBe('Groove Hill')
    expect(c.i18n).toEqual([
      { locale: 'en', display: 'Groove Hill', missing: false },
      { locale: 'th', display: 'กรูฟ ฮิลล์', missing: false },
    ])
  })

  it('missing locale renders as an empty-dash entry', () => {
    const c = formatDetailCell(nameField, { name: { en: 'Only English' } })
    expect(c.i18n).toEqual([
      { locale: 'en', display: 'Only English', missing: false },
      { locale: 'th', display: '—', missing: true },
    ])
    expect(c.empty).toBe(false)
  })

  it('a resolved-string read (locale collapsed) has no i18n entries', () => {
    expect(formatDetailCell(nameField, { name: 'Groove Hill' }).i18n).toBeUndefined()
  })

  it('all locales missing → empty cell', () => {
    expect(formatDetailCell(nameField, { name: {} }).empty).toBe(true)
  })

  it('sensitivity masking wins over locale explosion', () => {
    const field = f({ key: 'alias', label: 'Alias', sensitivity: 'pii', i18n: { locales: ['en', 'th'] } })
    const c = formatDetailCell(field, { alias: { en: 'x', th: 'y' } })
    expect(c.masked).toBe(true)
    expect(c.i18n).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run packages/ui/src/detail.test.ts` → new cases FAIL.

- [ ] **Step 3: Implement in `detail.ts`**

(a) Extend `DetailCell` (after `ref?`):

```ts
  /** Per-locale entries when the field is i18n-declared and the record was read with { locale: 'raw' }. */
  i18n?: { locale: string; display: string; missing: boolean }[]
```

(b) In `formatDetailCell`, insert AFTER the sensitivity check and BEFORE the entity-pairing branch:

```ts
  // i18n locale map (host read with { locale: 'raw' }) → per-locale entries
  if (field.i18n && typeof raw === 'object' && !Array.isArray(raw)) {
    const map = raw as Record<string, unknown>
    const locales = field.i18n.locales ?? Object.keys(map)
    const entries = locales.map((locale) => {
      const v = map[locale]
      const missing = v == null || v === ''
      return { locale, display: missing ? '—' : String(v), missing }
    })
    const first = entries.find((e) => !e.missing)
    if (!first) return { key, label, display: '—', masked: false, empty: true }
    return { key, label, display: first.display, i18n: entries, masked: false, empty: false }
  }
```

(c) The existing `empty` guard (`raw == null || raw === ''`) stays above — an empty object `{}` passes it and is handled by the `!first` branch.

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run packages/ui/src/detail.test.ts` → ALL PASS (old + new).

- [ ] **Step 5: Commit** — `git add packages/ui/src/detail.ts packages/ui/src/detail.test.ts && git commit -m "feat(ui): formatDetailCell explodes raw i18n locale maps into per-locale entries"`.

---

### Task 6: `useContainerSize` + card density vars (ui-nuxt core)

**Files:**
- Create: `packages/ui-nuxt/src/runtime/core/container.ts`
- Test: typecheck only (ui-nuxt has no vitest harness; behavior is exercised via Task 7 + showcase)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `useContainerSize(host: Ref<HTMLElement | null>): { width: Ref<number>; size: Ref<'sm' | 'md' | 'lg'> }` — container-measured (ResizeObserver), thresholds identical to `CollectionList.densityFor`: `<448` → `'sm'`, `<640` → `'md'`, else `'lg'`. `width` starts `Infinity` (widest-first render, no flash — the list's convention). Consumed by `RecordDetail.vue` (Task 7); designed for later adoption by `CollectionList` (NOT refactored now — spec §8 backlog).

- [ ] **Step 1: Implement `packages/ui-nuxt/src/runtime/core/container.ts`**

```ts
import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'
// Container-measured size for the Item family — the element-level counterpart of useViewport().
// Same tier thresholds as CollectionList's densityFor, so cards and tables agree on density.
export type ContainerSize = 'sm' | 'md' | 'lg'

export function useContainerSize(host: Ref<HTMLElement | null>): { width: Ref<number>; size: Ref<ContainerSize> } {
  const width = ref(Number.POSITIVE_INFINITY) // widest-first: render everything until measured
  const size = ref<ContainerSize>('lg')
  let ro: ResizeObserver | null = null

  function apply(w: number): void {
    width.value = w
    size.value = w < 448 ? 'sm' : w < 640 ? 'md' : 'lg'
  }

  onMounted(() => {
    if (!host.value || typeof ResizeObserver === 'undefined') return
    ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w !== undefined && w > 0) apply(w)
    })
    ro.observe(host.value)
    const w = host.value.getBoundingClientRect().width
    if (w > 0) apply(w)
  })
  onBeforeUnmount(() => { ro?.disconnect(); ro = null })

  return { width, size }
}
```

(It lands in `core/`, which the Nuxt module already auto-imports via `addImportsDir('./runtime/core')` — no module.ts change needed.)

- [ ] **Step 2: Verify** — `pnpm typecheck` at repo root → clean.

- [ ] **Step 3: Commit** — `git add packages/ui-nuxt/src/runtime/core/container.ts && git commit -m "feat(ui-nuxt): useContainerSize — container-measured density tiers for the item family"`.

---

### Task 7: `RecordDetail.vue` — container grid, describe()-driven groups, dual-language cells, NuiText

**Files:**
- Modify: `packages/ui-nuxt/src/runtime/components/item/RecordDetail.vue`

**Interfaces:**
- Consumes: `groupFields`/`FieldGroup` (Task 4), `DetailCell.i18n` (Task 5), `useContainerSize` (Task 6), existing `NuiText` (`:reps="[c.display]"` mode — the display strings are already formatted).
- Produces: unchanged public props/events — `groups` prop becomes an optional override; with it omitted, cards derive from `field.group`/`order`. New behavior only.

- [ ] **Step 1: Rewrite the script's card derivation**

Replace the `cards` computed and add container sizing (imports: add `groupFields` to the `@noy-db/ui` import, `ref` to the vue import, `import { useContainerSize } from '../../core/container'`):

```ts
const host = ref<HTMLElement | null>(null)
const { width, size } = useContainerSize(host)

const cards = computed(() => {
  const groups = props.groups?.length
    ? props.groups.map((g) => ({ title: g.title, fields: g.keys.map((k) => byKey.value.get(k)).filter(Boolean) as DescribedField[] }))
    : groupFields(shown.value, t)
  return groups.map((g) => ({ title: g.title, cells: g.fields.map((f) => formatDetailCell(f, props.record, { reveal: props.reveal })) }))
})
```

Also update the `groups` prop docblock: `/** Card grouping override. Omit → derived from describe()'s field.group/order. */`

- [ ] **Step 2: Rewrite the template**

Root div gets the measure ref + density attribute; the `<dl>` grid goes container-driven (delete `sm:grid-cols-2`); the value cell renders per-locale entries or a `NuiText`:

```vue
<template>
  <div ref="host" class="nui-detail space-y-4" :data-nui-size="size">
    <div v-if="editable" class="flex justify-end">
      <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" @click="emit('edit')">
        <span class="i-lucide-pencil size-3.5" aria-hidden="true" /> {{ t('nui.detail.edit', 'Edit') }}
      </button>
    </div>

    <div class="grid gap-4" :class="width >= 992 ? 'grid-cols-2' : 'grid-cols-1'">
      <section v-for="card in cards" :key="card.title" class="nui-panel nui-card">
        <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted mb-3">{{ card.title }}</h3>
        <dl class="grid gap-x-6 gap-y-3" :class="width < 448 ? 'grid-cols-1' : 'grid-cols-2'">
          <div v-for="c in card.cells" :key="c.key" class="min-w-0">
            <dt class="text-xs text-nui-muted">{{ c.label }}</dt>
            <dd class="text-sm mt-0.5" :class="c.empty ? 'text-nui-subtle' : 'text-nui-fg'">
              <a
                v-if="linkHref(c)"
                :href="linkHref(c)"
                class="text-nui-accent hover:underline"
                @click="onLink(c, $event)"
              >{{ c.display }}</a>
              <template v-else-if="c.i18n">
                <span v-for="e in c.i18n" :key="e.locale" class="flex items-baseline gap-1.5 min-w-0">
                  <span
                    class="shrink-0 text-[10px] uppercase leading-4 px-1 rounded border border-nui-border"
                    :class="e.missing ? 'text-nui-subtle opacity-60' : 'text-nui-muted'"
                  >{{ e.locale }}</span>
                  <NuiText :reps="[e.display]" :class="e.missing ? 'text-nui-subtle' : ''" />
                </span>
              </template>
              <NuiText v-else :reps="[c.display]" />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>
```

Add `import NuiText from '../NuiText.vue'` (internal explicit import — RecordDetail must not rely on global registration). Add scoped CSS for the card density vars:

```vue
<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
[data-nui-size='md'] .nui-card, :where([data-nui-size='md']) .nui-card { --nui-card-px: 0.75rem; }
[data-nui-size='sm'] .nui-card { --nui-card-px: 0.625rem; }
</style>
```

(Remove the old `p-4` from the section class — `.nui-card` now owns padding, host-overridable via `--nui-card-px`.)

- [ ] **Step 3: Rebuild + typecheck** — `pnpm build && pnpm typecheck` at repo root → clean. UnoCSS regenerates `dist/style.css` (the new arbitrary classes `text-[10px]` etc. are scanned from the .vue source — verify with `grep -c 'text-\[10px\]' packages/ui-nuxt/dist/style.css` → ≥1).

- [ ] **Step 4: Commit** — `git add packages/ui-nuxt/src/runtime/components/item/RecordDetail.vue && git commit -m "feat(ui-nuxt): RecordDetail — container-measured grid, describe()-driven groups, dual-language cells"`.

---

### Task 8: showcase — bilingual `notes` on labels, group/order metadata, raw-locale detail reads

**Files:**
- Modify: `examples/showcase/src/data/types.ts` (LabelSchema)
- Modify: `examples/showcase/src/data/dataset.ts` (5 labels)
- Modify: `examples/showcase/src/data/dicts.ts` (`FIELD_LABELS.labels.notes`)
- Modify: `examples/showcase/src/data/collections.ts` (i18nFields + fieldMeta group/order)
- Modify: `examples/showcase/app/pages/records/[id].vue`, `artists/[id].vue`, `labels/[id].vue` (raw reads)
- Modify: `examples/showcase/public/demo.noydb` (re-seed output)
- Test: `examples/showcase/src/data/__tests__/seed.test.ts` (extend if it asserts label field sets)

**Interfaces:**
- Consumes: everything from Tasks 1–7 through the local `file:` deps (hub) and workspace packages (ui/ui-nuxt).
- Produces: the running demo for phase 2's acceptance.

- [ ] **Step 1: LabelSchema + dataset + dict label**

`types.ts` — add to `LabelSchema` after `founded`:

```ts
  notes: z.record(z.string()).optional(),
```

`dataset.ts` — extend each of the 5 labels, e.g. (write all five; vary the content):

```ts
  { id: 'lb1', name: { en: 'Groove Hill', th: 'กรูฟ ฮิลล์' }, country: 'US', founded: 1958,
    notes: { en: 'Independent jazz and soul imprint; deep-groove pressings through 1972.', th: 'ค่ายแจ๊สและโซลอิสระ งานปั๊มแบบดีพกรูฟจนถึงปี 1972' } },
```

(lb5 'Sakura Sound' gets an EN-only note — `notes: { en: 'City pop and ambient catalogue.' }` — so the demo shows a *missing-locale* badge, exercising Task 5's dimmed entry.)

`dicts.ts` — in `FIELD_LABELS.labels` add: `notes: { en: 'Notes', th: 'บันทึก' },`

- [ ] **Step 2: collections.ts — i18nFields + groups**

Labels collection: `i18nFields: { name: NAME_I18N, notes: i18nText({ languages: ['en', 'th'], required: 'any' }) }`.

fieldMeta group/order via the existing `fieldMeta()` overrides (English group ids; they double as fallback titles):

```ts
    // labels
    fieldMeta: fieldMeta('labels', {
      name:    { group: 'Identity', order: 1 },
      country: { semanticType: 'country', group: 'Identity', order: 2 },
      founded: { semanticType: 'number', group: 'History', order: 10 },
      notes:   { widget: 'textarea', group: 'History', order: 11 },
    }),
```

```ts
    // records
    fieldMeta: fieldMeta('records', {
      title:       { group: 'Identity', order: 1 },
      artistId:    { semanticType: 'entity', group: 'Identity', order: 2 },
      labelId:     { semanticType: 'entity', group: 'Identity', order: 3 },
      year:        { semanticType: 'number', group: 'Release', order: 10 },
      genre:       { group: 'Release', order: 11 },
      format:      { group: 'Release', order: 12 },
      condition:   { group: 'Condition & Value', order: 20 },
      rating:      { semanticType: 'number', group: 'Condition & Value', order: 21 },
      priceUsd:    { semanticType: 'currency', unit: 'USD', group: 'Condition & Value', order: 22 },
      purchasedOn: { semanticType: 'date', group: 'Condition & Value', order: 23 },
      durationMin: { semanticType: 'number', unit: 'min', group: 'Listening', order: 30 },
      trackCount:  { semanticType: 'number', group: 'Listening', order: 31 },
      favorite:    { widget: 'checkbox', group: 'Listening', order: 32 },
      notes:       { widget: 'textarea', group: 'Listening', order: 33 },
    }),
```

```ts
    // artists
    fieldMeta: fieldMeta('artists', {
      name:       { group: 'Identity', order: 1 },
      country:    { semanticType: 'country', group: 'Identity', order: 2 },
      genre:      { group: 'Career', order: 10 },
      formedYear: { semanticType: 'number', group: 'Career', order: 11 },
    }),
```

(Align override keys with the actual `FIELD_LABELS.artists` keys — check `dicts.ts`; only add `group`/`order` to keys that exist.)

- [ ] **Step 3: detail pages read raw**

In all three `[id].vue` pages change the read to `{ locale: 'raw' }` (the `locale` import may become unused in a page — remove it there per surgical-change rules):

```ts
const record = await vault.value!.collection('labels').get(id, { locale: 'raw' })
```

- [ ] **Step 4: Re-seed + tests**

Run: `cd examples/showcase && pnpm seed` → writes `public/demo.noydb`. Then `pnpm vitest run` (showcase) — if `seed.test.ts` asserts label shapes, extend its expectations to include `notes`. Expected: ALL PASS.

- [ ] **Step 5: Full-loop visual verification (per showcase-dev-loop memory)**

At repo root: `pnpm build`; sync the store copy (`STORE=$(ls -d examples/showcase/node_modules/.pnpm/@noy-db+ui-nuxt@file*/node_modules/@noy-db/ui-nuxt | head -1); rm -rf "$STORE/dist" && cp -R packages/ui-nuxt/dist "$STORE/dist"` — repeat for `@noy-db+ui@file*` with `packages/ui/dist`); clear `examples/showcase/node_modules/.vite`, `examples/showcase/node_modules/.cache/vite`, `examples/showcase/.nuxt`; `pnpm dev`; in a FRESH browser context unlock with `spin-the-black-circle` and verify on `/labels/lb1`, `/records/rc01`, `/artists/ar1`:
  - cards render grouped (Identity / History etc.), ordered per `order`;
  - `name`/`title`/`notes` show stacked `EN`/`TH` badge rows; `lb5` shows a dimmed `TH —`;
  - narrow the window below 448px → single-column cells; ≥992px → two card columns; `data-nui-size` attribute changes;
  - dark theme + TH locale switch: group titles fall back to English ids (host may add `nui.detail.group.*` catalog entries later — not in scope);
  - zero console errors.

- [ ] **Step 6: Commit**

```bash
git add examples/showcase
git commit -m "feat(showcase): grouped detail cards + bilingual fields end-to-end

Labels gain an i18n notes field (EN-only on Sakura Sound to show the
missing-locale state); all collections declare group/order metadata;
detail pages read locale:'raw' for dual-language cells; re-seeded bundle."
```

---

### Task 9: phase gate — full verification + docs touch

**Files:**
- Modify: `docs/ui-nuxt/3.components.md` (RecordDetail section: groups now derive from describe(); `groups` prop = override)
- Modify: `docs/ui/2.schema-driven.md` (add `group`/`order` row to the describe()-mapping table)

**Interfaces:** none new — closes the phase.

- [ ] **Step 1:** noy-db repo: `pnpm test && pnpm typecheck && pnpm lint` → green.
- [ ] **Step 2:** noy-db-ui repo: `pnpm build && pnpm test && pnpm typecheck && pnpm lint` and showcase `pnpm vitest run` → green.
- [ ] **Step 3:** Update the two docs pages (one paragraph + one table row each, matching surrounding prose style).
- [ ] **Step 4:** Commit docs: `git commit -m "docs: describe()-driven detail groups (group/order) in schema-driven + components pages"`.
- [ ] **Step 5:** Report phase 1–2 complete against the spec's §7 phasing; later phases (P3 edit, P4 history, P5 attachments, P6 related, P1 parity) get their own plans.

---

## Self-review notes

- **Spec coverage (phases 1–2 only):** upstream asks §2.1/§2.2 → Tasks 1–2; adoption → Task 3; P2 groups → Tasks 4, 7, 8; P2 dual-language → Tasks 5, 7, 8; layout foundation §4 (container sizing, density vars, NuiText) → Tasks 6–7; T1/T2 test-surface rows → Tasks 1, 5, 8; T4's bundle question → answered by Task 2's test. Print §8c, edit/history/blobs/joins: later plans by design.
- **Type consistency:** `groupFields(fields, t?) → FieldGroup { id, title, fields }` used identically in Tasks 4 and 7; `DetailCell.i18n[{locale, display, missing}]` identical in Tasks 5 and 7; `useContainerSize → { width, size }` identical in Tasks 6 and 7; `DescribedField.group/order` identical in Tasks 1, 4, 8.
- **Known judgment calls for the executor:** Task 1/2 test-harness imports must match the neighboring hub test files (explicitly flagged in-step); Task 8 artist fieldMeta keys must be checked against `dicts.ts` before writing.
