# Vinyl Showcase SPA Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `examples/showcase` package into a static, browser-only Nuxt 4 SPA that unlocks the committed `demo.noydb` with a passphrase and browses one page per collection — list/search/detail driven by `@noy-db/ui-nuxt`, fully Thai/English, with live blob-decrypted cover art and a custom guided "balloon" tour.

**Architecture:** `ssr: false` Nuxt 4 app layered onto the existing Plan A data package. A client plugin opens the vault once (from `/demo.noydb`) after unlock and shares it; pages derive UI schema from `collection.describe()` and render the auto-registered `@noy-db/ui-nuxt` components. Covers are fetched as static assets and round-tripped through the vault's blob API in-browser (proving encryption). All localization (chrome, library `nui.*` strings, enum values, field headers) is resolved app-side from `dicts.ts` + a messages table, because vault dictionaries do not survive the bundle.

**Tech Stack:** Nuxt 4, Vue 3, `@noy-db/ui-nuxt` + `@noy-db/ui` (sibling repo `packages/*`, via `file:`), `@noy-db/hub`/`to-memory`/`as-noydb` (Plan A), vitest (logic), `nuxi generate` (static build).

## Global Constraints

- **Build prereqs:** sibling `noy-db` built (Plan A) AND this repo's `@noy-db/ui-nuxt` built (`pnpm --filter @noy-db/ui-nuxt build` from repo root) so the `file:` link resolves a populated `dist/`.
- **Package isolation:** `examples/showcase` stays its own pnpm root (own `pnpm-workspace.yaml`), NOT in the root workspace. Adding Nuxt must not change the root `@noy-db/ui`/`ui-nuxt` verify gate.
- **Render mode (verbatim):** `ssr: false`; static via `nuxi generate`. The vault runs only client-side.
- **Passphrase (verbatim):** `spin-the-black-circle` (shown as a visible hint on the unlock screen).
- **Languages (verbatim):** `en` (default), `th`. The app must be fully bilingual.
- **Blob naming (verbatim):** import `COVER_FIELD` (`'cover'`) and `COVER_SLOT` (`'art'`) from `src/data/vault.ts` — never re-hardcode them.
- **Reopen contract (proven in Plan A):** after `openVaultFromBundle`, caches are empty — `await collection.list()` to hydrate before any synchronous `query()/toArray()`; declare a reopened collection with its `refs` for joins to resolve. Dictionaries and blobs do NOT survive the bundle.
- **nui namespace:** any showcase-added CSS/classes/i18n keys that touch the library stay under `nui-*`/`nui.*`; app-only chrome may use its own.
- **Commit rule:** NEVER add Claude attribution; use `git commit --no-verify`.

## File Structure

```
examples/showcase/
  package.json            # + nuxt/vue deps, @noy-db/ui-nuxt + @noy-db/ui file: links,
                          #   pnpm.overrides (@noy-db/ui → sibling), scripts: dev/generate
  nuxt.config.ts          # ssr:false, modules:['@noy-db/ui-nuxt/module'], noydbUi config
  app/
    app.vue               # <NuxtLayout><NuxtPage/></NuxtLayout>
    layouts/default.vue   # sidebar (collections) + header (theme + lang switch + ? tour)
    plugins/vault.client.ts   # opens vault post-unlock, provides it + provideNoydbUi
    composables/
      useVault.ts         # access the shared open vault (+ unlock/lock)
      useShowcaseI18n.ts  # app-side locale + t(), enum-label + field-label resolvers
      useTour.ts          # tour state machine (steps, next/prev/skip, localStorage)
    i18n/messages.ts      # { en, th } chrome + nui.* strings
    lib/
      collectionView.ts   # describe()→schema + columns + joined rows for a collection
      cover.ts            # loadCover(vault, id): live blob round-trip → object URL
    components/
      TourBalloon.vue     # the coachmark overlay
      CoverImage.vue      # <img> from a vault blob + "decrypted from a vault blob" caption
    pages/
      index.vue           # unlock screen
      records/index.vue    artists/index.vue    labels/index.vue
      records/[id].vue    # detail + cover hero
  src/data/…              # Plan A (unchanged)
  public/demo.noydb, public/covers/*.png   # Plan A artifacts
  test/                   # vitest for lib/ + composables logic
```

---

### Task 1: Nuxt app scaffold + `@noy-db/ui-nuxt` integration gate

**Files:**
- Modify: `examples/showcase/package.json`
- Create: `examples/showcase/nuxt.config.ts`, `app/app.vue`, `app/pages/index.vue` (temporary placeholder)

**Interfaces:**
- Produces: a Nuxt app that builds with the `@noy-db/ui-nuxt` module registered and its CSS injected. Later tasks replace `index.vue`.

- [ ] **Step 1: Add deps + scripts to `package.json`**

Add to `dependencies`: `"nuxt": "^4.0.0"`, `"vue": "^3.5.0"`, `"@noy-db/ui-nuxt": "file:../../packages/ui-nuxt"`, `"@noy-db/ui": "file:../../packages/ui"`.
Add to `pnpm.overrides` (next to the existing `@noy-db/attestation` one): `"@noy-db/ui": "file:../../packages/ui"` (so `@noy-db/ui-nuxt`'s `workspace:*` dep on `@noy-db/ui` resolves outside the workspace — same pattern as attestation in Plan A).
Add to `scripts`: `"dev": "nuxi dev"`, `"generate": "nuxi generate"`, `"postinstall": "nuxi prepare"`.

- [ ] **Step 2: Write `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  ssr: false,
  modules: ['@noy-db/ui-nuxt/module'],
  noydbUi: { theme: 'system', locale: 'en' },
  app: { head: { title: 'noy-db · Vinyl' } },
  compatibilityDate: '2025-01-01',
})
```

- [ ] **Step 3: Write `app/app.vue` and a placeholder `app/pages/index.vue`**

```vue
<!-- app/app.vue -->
<template><NuxtLayout><NuxtPage /></NuxtLayout></template>
```
```vue
<!-- app/pages/index.vue (placeholder; replaced in Task 4) -->
<template><main style="padding:2rem"><CollectionList :columns="[]" :rows="[]" /></main></template>
```
The placeholder references `<CollectionList>` purely to prove the module auto-registered the component.

- [ ] **Step 4: Install and build (the integration gate)**

Run: `cd examples/showcase && pnpm install && pnpm exec nuxi build`
Expected: prepare + build succeed; `.output/` produced; no "failed to resolve `@noy-db/ui-nuxt`" or "Unknown component CollectionList".
If install fails with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` for another `@noy-db/*` package, add a matching `file:` override (sibling `packages/*` or this repo's `packages/*`), as in Plan A. Record any overrides added.
If `CollectionList` is unknown, confirm the module registered components (it should via `noydbUi.components` default true).

- [ ] **Step 5: Confirm the Plan A vitest suite still passes and root gate is untouched**

Run: `cd examples/showcase && npx vitest run` → 11 passed.
Run: `git -C ../.. diff --stat HEAD -- packages pnpm-workspace.yaml` → empty (no root changes).

- [ ] **Step 6: Commit**

```bash
git add examples/showcase/package.json examples/showcase/pnpm-lock.yaml examples/showcase/nuxt.config.ts examples/showcase/app
git commit --no-verify -m "feat(showcase): scaffold Nuxt 4 SPA with @noy-db/ui-nuxt module"
```

---

### Task 2: Vault plugin + `useVault` + `provideNoydbUi`

**Files:**
- Create: `app/plugins/vault.client.ts`, `app/composables/useVault.ts`

**Interfaces:**
- Consumes: `openVaultFromBundle(bytes, secret)`, `VAULT_NAME` from `src/data/vault.ts`.
- Produces:
  - `useVault(): { vault: Ref<Vault | null>; unlock(secret: string): Promise<void>; locked: ComputedRef<boolean> }`
  - `unlock` fetches `/demo.noydb`, opens it (throws on wrong passphrase), hydrates `records`/`artists`/`labels` (`await list()`), declares `records` with its `refs`, and stores the open vault. Subsequent `useVault()` callers read the same instance.

- [ ] **Step 1: Write `useVault.ts`**

```ts
import { ref, computed } from 'vue'
import type { Vault } from '@noy-db/hub'
import { ref as nref } from '@noy-db/hub'
import { openVaultFromBundle } from '../../src/data/vault'

const vault = ref<Vault | null>(null)

export function useVault() {
  async function unlock(secret: string) {
    const bytes = new Uint8Array(await fetch('/demo.noydb').then((r) => r.arrayBuffer()))
    const v = await openVaultFromBundle(bytes, secret) // throws InvalidKeyError on wrong passphrase
    // Re-declare records with refs (needed for joins) and hydrate all collections.
    v.collection('records', { refs: { artistId: nref('artists', 'warn'), labelId: nref('labels', 'warn') } })
    await v.collection('records').list()
    await v.collection('artists').list()
    await v.collection('labels').list()
    vault.value = v
  }
  return { vault, unlock, locked: computed(() => vault.value === null) }
}
```

- [ ] **Step 2: Write `vault.client.ts`** (provide library config; route guard to unlock)

```ts
import { provideNoydbUi } from '@noy-db/ui-nuxt/core'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

export default defineNuxtPlugin(() => {
  const { locale, t } = useShowcaseI18n()
  provideNoydbUi({ theme: 'system', locale: locale.value, t })
})
```
> Note: `useShowcaseI18n` arrives in Task 7. Until then, stub `provideNoydbUi({ theme: 'system', locale: 'en' })` and wire `t`/`locale` in Task 7.

- [ ] **Step 3: Manual verify** (no unit test — integration covered by Task 3/4)

Run: `pnpm exec nuxi build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add examples/showcase/app/plugins examples/showcase/app/composables/useVault.ts
git commit --no-verify -m "feat(showcase): vault client plugin + useVault (open, hydrate, share)"
```

---

### Task 3: Unlock page

**Files:**
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `useVault()`. On submit: `unlock(secret)`; on success `navigateTo('/records')`; on throw, show an inline error and stay locked.

- [ ] **Step 1: Write `index.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useVault } from '../composables/useVault'
const { unlock } = useVault()
const pass = ref('')
const error = ref('')
const busy = ref(false)
async function submit() {
  busy.value = true; error.value = ''
  try { await unlock(pass.value); await navigateTo('/records') }
  catch { error.value = "That didn't unlock the vault." }
  finally { busy.value = false }
}
</script>
<template>
  <main class="nui-unlock" data-tour="unlock">
    <h1>noy-db · Vinyl</h1>
    <p>Passphrase hint: <code>spin-the-black-circle</code></p>
    <form @submit.prevent="submit">
      <input v-model="pass" type="password" placeholder="passphrase" autofocus />
      <button :disabled="busy || !pass">Unlock</button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
  </main>
</template>
```

- [ ] **Step 2: Verify the gate end-to-end** (the real browser integration check)

Run: `pnpm exec nuxi build`; then `pnpm exec nuxi preview` (or `nuxi dev`) and confirm in a browser: wrong passphrase shows the error; `spin-the-black-circle` routes to `/records` without console errors about decryption. (If using the Plan's CI-less environment, a Playwright/`claude-in-chrome` smoke is acceptable; otherwise document the manual result in the report.)

- [ ] **Step 3: Commit**

```bash
git add examples/showcase/app/pages/index.vue
git commit --no-verify -m "feat(showcase): passphrase unlock screen"
```

---

### Task 4: Records collection page (list + search + joins) — UI integration gate

**Files:**
- Create: `app/lib/collectionView.ts`, `app/pages/records/index.vue`
- Test: `examples/showcase/test/collectionView.test.ts`

**Interfaces:**
- Consumes: `useVault()`, `@noy-db/ui` (`schemaFromDescribe`, `joinedSchema`, `joinedRows`, `useCollectionList`).
- Produces: `buildRecordsView(vault)` → `{ schema, columns, rows }` where `schema` is the joined schema (records + artist.name + label.name), `columns` is an `AppColumn[]`, and `rows` are joined record rows. This is unit-testable against a seeded vault (no DOM).

- [ ] **Step 1: Write the failing test** — `test/collectionView.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { seedVault } from '../scripts/seed'
import { buildRecordsView } from '../app/lib/collectionView'

describe('buildRecordsView', () => {
  it('produces a joined schema + 24 rows with artist/label names', async () => {
    const vault = await seedVault()
    await vault.collection('artists').list(); await vault.collection('labels').list(); await vault.collection('records').list()
    const { schema, columns, rows } = buildRecordsView(vault)
    expect(rows).toHaveLength(24)
    expect(columns.some((c) => c.key === 'title')).toBe(true)
    expect((rows[0] as any).artist_name ?? (rows[0] as any).artist?.name).toBeTruthy()
    expect(schema.entity).toBe('records')
  })
})
```

- [ ] **Step 2: Run it** → FAIL (`buildRecordsView` not found).

- [ ] **Step 3: Implement `collectionView.ts`**

```ts
import { schemaFromDescribe, joinedSchema, joinedRows } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'

export function buildRecordsView(vault: Vault) {
  const records = vault.collection('records')
  const artists = vault.collection('artists')
  const labels = vault.collection('labels')

  const base = schemaFromDescribe('records', records.describe().fields)
  const artistsSchema = schemaFromDescribe('artists', artists.describe().fields)
  const labelsSchema = schemaFromDescribe('labels', labels.describe().fields)

  const legs = [
    { schema: artistsSchema, rows: artists.query().toArray(), localKey: 'artistId', fields: ['name'], as: 'artist' },
    { schema: labelsSchema, rows: labels.query().toArray(), localKey: 'labelId', fields: ['name'], as: 'label' },
  ]
  const schema = joinedSchema(base, legs)
  const rows = joinedRows(records.query().toArray(), legs)

  const columns = [
    { key: 'cover', label: '', width: 56 },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'artist_name', label: 'Artist', sortable: true, filter: 'enum' },
    { key: 'year', label: 'Year', sortable: true, align: 'right' },
    { key: 'genre', label: 'Genre', sortable: true, filter: 'enum' },
    { key: 'format', label: 'Format', filter: 'enum' },
    { key: 'condition', label: 'Condition', filter: 'enum' },
    { key: 'priceUsd', label: 'Price', sortable: true, align: 'right' },
  ]
  return { schema, columns, rows }
}
```
> If `joinedRows` namespaces the joined name as a different key than `artist_name` (Plan A explorer: `joinedKey(ns, id)` = `${ns}_${id}`, so `artist_name`), align the column key + test assertion to the real key.

- [ ] **Step 4: Run the test** → PASS (adjust the joined-key name if needed).

- [ ] **Step 5: Write `records/index.vue`** (wires the engine to the components)

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCollectionList } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildRecordsView } from '../../lib/collectionView'
const { vault } = useVault()
if (!vault.value) await navigateTo('/')
const view = buildRecordsView(vault.value!)
const baseRows = ref(view.rows)
const query = ref('')
const list = useCollectionList({ baseRows, query, entity: 'records', columns: view.columns, defaultSort: [{ field: 'title', dir: 'asc' }], schema: view.schema })
</script>
<template>
  <section>
    <SearchBox v-model="query" :schema="view.schema" :rows="list.visibleRows.value" data-tour="search" />
    <CollectionList
      :columns="view.columns" :rows="list.visibleRows.value"
      :sort-key="list.sortKey?.value" :sort-dir="list.sortDir?.value" :filters="list.columnFilters.value" :enum-facets="list.enumFacets.value"
      row-noun="records" data-tour="list"
      @sort="list.onSort" @filter-change="list.setColumnFilter" @row-click="(r:any) => navigateTo(`/records/${r.id}`)">
      <template #cell-cover="{ row }"><CoverImage :id="row.id" :thumb="true" /></template>
    </CollectionList>
  </section>
</template>
```
> The exact `useCollectionList` return shape (refs vs values) and `CollectionList` prop/emit names were mapped in Plan A's exploration; reconcile against the actual `@noy-db/ui` types and make `pnpm exec nuxi build` + a browser render succeed. `CoverImage` arrives in Task 6 — until then use a `<td/>` stub in the slot.

- [ ] **Step 6: Verify** — `pnpm exec nuxi build` succeeds; in a browser the `/records` page lists 24 rows with artist/label columns, search filters, column sort/filter work, clicking a row routes to a (404-for-now) detail URL.

- [ ] **Step 7: Commit**

```bash
git add examples/showcase/app/lib/collectionView.ts examples/showcase/app/pages/records/index.vue examples/showcase/test/collectionView.test.ts
git commit --no-verify -m "feat(showcase): records page — joined list + search via @noy-db/ui"
```

---

### Task 5: Artists & Labels pages

**Files:**
- Create: `app/lib/simpleView.ts`, `app/pages/artists/index.vue`, `app/pages/labels/index.vue`
- Test: `examples/showcase/test/simpleView.test.ts`

**Interfaces:**
- Produces: `buildSimpleView(vault, entity)` → `{ schema, columns, rows }` for a join-free collection (`schemaFromDescribe` + a columns list derived from `describe().fields`).

- [ ] **Step 1: Failing test** — `test/simpleView.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { seedVault } from '../scripts/seed'
import { buildSimpleView } from '../app/lib/simpleView'
describe('buildSimpleView', () => {
  it('builds schema + rows for artists (9) and labels (5)', async () => {
    const vault = await seedVault()
    await vault.collection('artists').list(); await vault.collection('labels').list()
    expect(buildSimpleView(vault, 'artists').rows).toHaveLength(9)
    expect(buildSimpleView(vault, 'labels').rows).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `simpleView.ts`**

```ts
import { schemaFromDescribe } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'

export function buildSimpleView(vault: Vault, entity: string) {
  const col = vault.collection(entity)
  const fields = col.describe().fields
  const schema = schemaFromDescribe(entity, fields)
  const columns = fields
    .filter((f: any) => f.key !== 'id')
    .map((f: any) => ({ key: f.key, label: f.label ?? f.key, sortable: true }))
  return { schema, columns, rows: col.query().toArray() }
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Write `artists/index.vue` and `labels/index.vue`** (each mirrors the records page minus joins/cover)

```vue
<!-- artists/index.vue (labels/index.vue is identical with entity='labels', noun='labels') -->
<script setup lang="ts">
import { ref } from 'vue'
import { useCollectionList } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildSimpleView } from '../../lib/simpleView'
const { vault } = useVault()
if (!vault.value) await navigateTo('/')
const view = buildSimpleView(vault.value!, 'artists')
const baseRows = ref(view.rows); const query = ref('')
const list = useCollectionList({ baseRows, query, entity: 'artists', columns: view.columns, defaultSort: [{ field: 'name', dir: 'asc' }], schema: view.schema })
</script>
<template>
  <section>
    <SearchBox v-model="query" :schema="view.schema" :rows="list.visibleRows.value" />
    <CollectionList :columns="view.columns" :rows="list.visibleRows.value" :sort-key="list.sortKey?.value" :sort-dir="list.sortDir?.value" :filters="list.columnFilters.value" row-noun="artists" @sort="list.onSort" @filter-change="list.setColumnFilter" />
  </section>
</template>
```

- [ ] **Step 6: Verify** — build + browser: `/artists` (9 rows), `/labels` (5 rows) render, search/sort work.

- [ ] **Step 7: Commit**

```bash
git add examples/showcase/app/lib/simpleView.ts examples/showcase/app/pages/artists examples/showcase/app/pages/labels examples/showcase/test/simpleView.test.ts
git commit --no-verify -m "feat(showcase): artists + labels pages"
```

---

### Task 6: Cover art via live blob round-trip + `CoverImage` + record detail

**Files:**
- Create: `app/lib/cover.ts`, `app/components/CoverImage.vue`, `app/pages/records/[id].vue`
- Test: `examples/showcase/test/cover.test.ts`

**Interfaces:**
- Consumes: `useVault()`, `COVER_FIELD`/`COVER_SLOT` from `src/data/vault.ts`, `RecordDetail` (auto-registered).
- Produces: `loadCoverBytes(vault, id): Promise<Uint8Array>` — fetches `/covers/<id>.png`, writes it into the vault as a blob (`collection.blob(id).put(COVER_SLOT, …)`), reads it back (`.get(COVER_SLOT)`), and returns the round-tripped bytes (proving the encrypt→store→decrypt path). `CoverImage` turns those bytes into an object URL.

- [ ] **Step 1: Failing test** — `test/cover.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { seedVault } from '../scripts/seed'
import { loadCoverBytes } from '../app/lib/cover'

describe('loadCoverBytes (live blob round-trip)', () => {
  it('writes a cover into the vault and reads back a PNG', async () => {
    const vault = await seedVault()
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const out = await loadCoverBytes(vault, 'rc01', async () => bytes) // inject fetch
    expect(Array.from(out.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `cover.ts`**

```ts
import type { Vault } from '@noy-db/hub'
import { COVER_FIELD, COVER_SLOT } from '../../src/data/vault'

// fetchPng defaults to the static asset; injectable for tests.
export async function loadCoverBytes(
  vault: Vault, id: string,
  fetchPng: (id: string) => Promise<Uint8Array> = (i) => fetch(`/covers/${i}.png`).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)),
): Promise<Uint8Array> {
  const png = await fetchPng(id)
  const records = vault.collection('records', { blobFields: { [COVER_FIELD]: { retainDays: 36500 } } })
  await records.blob(id).put(COVER_SLOT, png, { mimeType: 'image/png' })   // encrypt into vault
  const back = await records.blob(id).get(COVER_SLOT)                        // decrypt out
  if (!back) throw new Error(`cover blob missing for ${id}`)
  return back
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Write `CoverImage.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useVault } from '../composables/useVault'
import { loadCoverBytes } from '../lib/cover'
const props = defineProps<{ id: string; thumb?: boolean }>()
const url = ref<string | null>(null); const kb = ref(0)
const { vault } = useVault()
onMounted(async () => {
  if (!vault.value) return
  const bytes = await loadCoverBytes(vault.value, props.id)
  kb.value = Math.round(bytes.length / 1024)
  url.value = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
})
onUnmounted(() => { if (url.value) URL.revokeObjectURL(url.value) })
</script>
<template>
  <figure :class="thumb ? 'nui-cover-thumb' : 'nui-cover-hero'" data-tour="cover">
    <img v-if="url" :src="url" alt="cover" />
    <figcaption v-if="!thumb && url">decrypted from a vault blob · {{ kb }} KB</figcaption>
  </figure>
</template>
```

- [ ] **Step 6: Write `records/[id].vue`**

```vue
<script setup lang="ts">
import { useVault } from '../../composables/useVault'
const route = useRoute()
const { vault } = useVault()
if (!vault.value) await navigateTo('/')
const id = route.params.id as string
const record = await vault.value!.collection('records').get(id)
const fields = vault.value!.collection('records').describe().fields
</script>
<template>
  <article v-if="record">
    <NuxtLink to="/records">← records</NuxtLink>
    <CoverImage :id="id" />
    <RecordDetail :record="record" :fields="fields" :route-for="(c:string,i:string)=>`/${c}/${i}`" @navigate="(e:any)=>navigateTo(`/${e.collection}/${e.id}`)" />
  </article>
  <p v-else>Not found.</p>
</template>
```

- [ ] **Step 7: Verify** — build + browser: `/records/rc01` shows the cover hero with the "decrypted from a vault blob" caption and the detail fields; list thumbnails render; ref fields link to artists/labels.

- [ ] **Step 8: Commit**

```bash
git add examples/showcase/app/lib/cover.ts examples/showcase/app/components/CoverImage.vue examples/showcase/app/pages/records/\[id\].vue examples/showcase/test/cover.test.ts
git commit --no-verify -m "feat(showcase): live blob-decrypted cover art + record detail"
```

---

### Task 7: Thai/English localization + switcher

**Files:**
- Create: `app/i18n/messages.ts`, `app/composables/useShowcaseI18n.ts`
- Modify: `app/plugins/vault.client.ts` (wire real `t`/`locale`), `app/layouts/default.vue` (switcher)
- Test: `examples/showcase/test/i18n.test.ts`

**Interfaces:**
- Consumes: `GENRE_LABELS`/`FORMAT_LABELS`/`CONDITION_LABELS`/`FIELD_LABELS` from `src/data/dicts.ts`.
- Produces: `useShowcaseI18n()` → `{ locale: Ref<'en'|'th'>, t(key, fallback?), enumLabel(field, value), fieldLabel(entity, key), setLocale }`. Enum values + field headers + chrome all resolve from locale, app-side (vault dicts don't survive the bundle).

- [ ] **Step 1: Failing test** — `test/i18n.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { useShowcaseI18n } from '../app/composables/useShowcaseI18n'
describe('useShowcaseI18n', () => {
  it('localizes enum values + field headers + chrome for en/th', () => {
    const i = useShowcaseI18n()
    i.setLocale('en'); expect(i.enumLabel('genre', 'rock')).toBe('Rock'); expect(i.fieldLabel('records', 'title')).toBe('Title')
    i.setLocale('th'); expect(i.enumLabel('genre', 'rock')).toBe('ร็อก'); expect(i.fieldLabel('records', 'title')).toBe('ชื่ออัลบั้ม')
    expect(i.t('nav.records', 'Records')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `messages.ts`**

```ts
export const MESSAGES: Record<'en' | 'th', Record<string, string>> = {
  en: { 'nav.records': 'Records', 'nav.artists': 'Artists', 'nav.labels': 'Labels', 'unlock.title': 'noy-db · Vinyl', 'unlock.hint': 'Passphrase hint', 'unlock.button': 'Unlock', 'unlock.error': "That didn't unlock the vault.", 'cover.caption': 'decrypted from a vault blob', 'tour.next': 'Next', 'tour.prev': 'Back', 'tour.skip': 'Skip' },
  th: { 'nav.records': 'แผ่นเสียง', 'nav.artists': 'ศิลปิน', 'nav.labels': 'ค่ายเพลง', 'unlock.title': 'noy-db · ไวนิล', 'unlock.hint': 'คำใบ้รหัสผ่าน', 'unlock.button': 'ปลดล็อก', 'unlock.error': 'รหัสผ่านไม่ถูกต้อง', 'cover.caption': 'ถอดรหัสจากบล็อบในวอลต์', 'tour.next': 'ถัดไป', 'tour.prev': 'ย้อนกลับ', 'tour.skip': 'ข้าม' },
}
```

- [ ] **Step 4: Implement `useShowcaseI18n.ts`**

```ts
import { ref } from 'vue'
import { GENRE_LABELS, FORMAT_LABELS, CONDITION_LABELS, FIELD_LABELS } from '../../src/data/dicts'
import { MESSAGES } from '../i18n/messages'

const DICTS: Record<string, Record<string, { en: string; th: string }>> = { genre: GENRE_LABELS, format: FORMAT_LABELS, condition: CONDITION_LABELS }
const locale = ref<'en' | 'th'>('en')

export function useShowcaseI18n() {
  const setLocale = (l: 'en' | 'th') => { locale.value = l }
  const t = (key: string, fallback = key) => MESSAGES[locale.value][key] ?? fallback
  const enumLabel = (field: string, value: string) => DICTS[field]?.[value]?.[locale.value] ?? value
  const fieldLabel = (entity: string, key: string) => FIELD_LABELS[entity]?.[key]?.[locale.value] ?? key
  return { locale, setLocale, t, enumLabel, fieldLabel }
}
```

- [ ] **Step 5: Run** → PASS.

- [ ] **Step 6: Wire it** — in `vault.client.ts` pass `{ locale: locale.value, t: (k, f) => t(\`nui.\${k}\`, f) }` to `provideNoydbUi` (map `nui.*` keys through the same `t`; add the `nui.*` strings the components actually request to `MESSAGES` as they surface during the browser check). In `collectionView.ts`/`simpleView.ts` column builders, set `label: fieldLabel(entity, key)` and render enum cells via `enumLabel`. Add a `<select>` TH/EN switcher (`data-tour="lang"`) in `layouts/default.vue` calling `setLocale`.

- [ ] **Step 7: Verify** — build + browser: toggling TH/EN flips nav, headers, enum cell values, unlock copy. No missing-key fallthroughs visible.

- [ ] **Step 8: Commit**

```bash
git add examples/showcase/app/i18n examples/showcase/app/composables/useShowcaseI18n.ts examples/showcase/app/plugins examples/showcase/app/layouts examples/showcase/app/lib examples/showcase/test/i18n.test.ts
git commit --no-verify -m "feat(showcase): Thai/English localization + switcher (app-side)"
```

---

### Task 8: Layout shell (sidebar nav + header) + theme toggle

**Files:**
- Modify/Create: `app/layouts/default.vue`

**Interfaces:**
- Consumes: `useShowcaseI18n()` (nav labels + switcher), `useTheme()` (from `@noy-db/ui-nuxt` core, auto-imported).
- Produces: the persistent chrome wrapping every page — sidebar listing Records/Artists/Labels, header with theme toggle + language switch + a "?" button that triggers the tour (Task 9).

- [ ] **Step 1: Write `default.vue`**

```vue
<script setup lang="ts">
import { useShowcaseI18n } from '../composables/useShowcaseI18n'
const { t, locale, setLocale } = useShowcaseI18n()
const theme = useTheme() // { mode, resolved, set } — auto-imported by the module
const nav = [['/records','nav.records'],['/artists','nav.artists'],['/labels','nav.labels']] as const
</script>
<template>
  <div class="nui-shell">
    <aside data-tour="nav">
      <NuxtLink v-for="[to,key] in nav" :key="to" :to="to">{{ t(key) }}</NuxtLink>
    </aside>
    <div>
      <header>
        <button data-tour="theme" @click="theme.set(theme.resolved.value === 'dark' ? 'light' : 'dark')">◐</button>
        <select data-tour="lang" :value="locale" @change="(e:any)=>setLocale(e.target.value)"><option value="en">EN</option><option value="th">TH</option></select>
        <button data-tour="help" @click="$emit('tour')">?</button>
      </header>
      <slot />
    </div>
  </div>
</template>
```
> The unlock page (`index.vue`) should opt out of the sidebar (use `definePageMeta({ layout: false })` or a dedicated layout) so the lock screen isn't wrapped in nav.

- [ ] **Step 2: Verify** — build + browser: nav links route between pages; theme toggle flips light/dark (the `--nui-*` tokens react); switcher present.

- [ ] **Step 3: Commit**

```bash
git add examples/showcase/app/layouts/default.vue examples/showcase/app/pages/index.vue
git commit --no-verify -m "feat(showcase): app shell — sidebar nav, theme toggle, lang switch"
```

---

### Task 9: TourBalloon + per-page tours

**Files:**
- Create: `app/components/TourBalloon.vue`, `app/composables/useTour.ts`
- Modify: `app/layouts/default.vue` (mount `<TourBalloon>`, wire "?"), pages already carry `data-tour="…"` anchors.
- Test: `examples/showcase/test/tour.test.ts`

**Interfaces:**
- Produces: `useTour()` → `{ steps, index, active, start(steps), next, prev, skip }` — a small state machine; `start` is a no-op-after-seen guard keyed in `localStorage`. `TourBalloon` reads the current step's `[data-tour]` target, positions a balloon beside it, dims the rest, shows localized title/body + Prev/Next/Skip + "n / N".

- [ ] **Step 1: Failing test** — `test/tour.test.ts` (pure state machine, no DOM)

```ts
import { describe, it, expect } from 'vitest'
import { useTour } from '../app/composables/useTour'
describe('useTour', () => {
  it('advances, clamps, and ends', () => {
    const tour = useTour()
    tour.start([{ target: '[data-tour=a]', title: 'A', body: 'a' }, { target: '[data-tour=b]', title: 'B', body: 'b' }], { force: true })
    expect(tour.active.value).toBe(true); expect(tour.index.value).toBe(0)
    tour.next(); expect(tour.index.value).toBe(1)
    tour.next(); expect(tour.active.value).toBe(false)   // past the end → closes
    tour.start([{ target: '[data-tour=a]', title: 'A', body: 'a' }], { force: true }); tour.skip()
    expect(tour.active.value).toBe(false)
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `useTour.ts`**

```ts
import { ref } from 'vue'
export type TourStep = { target: string; title: string; body: string }
const steps = ref<TourStep[]>([]); const index = ref(0); const active = ref(false)
export function useTour() {
  function start(s: TourStep[], opts: { force?: boolean; key?: string } = {}) {
    if (opts.key && !opts.force && typeof localStorage !== 'undefined' && localStorage.getItem(`tour:${opts.key}`)) return
    if (opts.key && typeof localStorage !== 'undefined') localStorage.setItem(`tour:${opts.key}`, '1')
    steps.value = s; index.value = 0; active.value = s.length > 0
  }
  const next = () => { if (index.value + 1 >= steps.value.length) active.value = false; else index.value++ }
  const prev = () => { if (index.value > 0) index.value-- }
  const skip = () => { active.value = false }
  return { steps, index, active, start, next, prev, skip }
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Write `TourBalloon.vue`** (overlay; positions beside the current target)

```vue
<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useTour } from '../composables/useTour'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'
const { steps, index, active, next, prev, skip } = useTour()
const { t } = useShowcaseI18n()
const rect = ref<DOMRect | null>(null)
const step = computed(() => steps.value[index.value])
watch([index, active], async () => {
  if (!active.value || !step.value) return
  const el = document.querySelector(step.value.target)
  rect.value = el ? el.getBoundingClientRect() : null
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})
</script>
<template>
  <div v-if="active" class="nui-tour-overlay">
    <div class="nui-tour-balloon" :style="rect ? { top: rect.bottom + 8 + 'px', left: rect.left + 'px' } : {}">
      <h4>{{ step?.title }}</h4><p>{{ step?.body }}</p>
      <footer>
        <button @click="prev" :disabled="index === 0">{{ t('tour.prev', 'Back') }}</button>
        <span>{{ index + 1 }} / {{ steps.length }}</span>
        <button @click="skip">{{ t('tour.skip', 'Skip') }}</button>
        <button @click="next">{{ t('tour.next', 'Next') }}</button>
      </footer>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Mount + define a per-page tour** — in `default.vue`, render `<TourBalloon />` and on the "?" click call `start(recordsTour, { force: true })`; auto-start once per page via `start(tour, { key: 'records' })` in `records/index.vue` `onMounted`. Steps (localized via `t`/`enumLabel`) walk: `search → list → cover → theme → lang`. Add a minimal `nui-tour-*` stylesheet (dim overlay, balloon card using `--nui-*` tokens).

- [ ] **Step 7: Verify** — build + browser: the tour auto-runs once on `/records`, highlights each target in order, Prev/Next/Skip + counter work, re-runs from "?", and renders in the active language.

- [ ] **Step 8: Commit**

```bash
git add examples/showcase/app/components/TourBalloon.vue examples/showcase/app/composables/useTour.ts examples/showcase/app/layouts/default.vue examples/showcase/app/pages/records/index.vue examples/showcase/test/tour.test.ts
git commit --no-verify -m "feat(showcase): guided balloon tour"
```

---

### Task 10: Static generate + README + final smoke

**Files:**
- Create: `examples/showcase/README.md`
- Verify: `nuxi generate` output

**Interfaces:** none (release/verification task).

- [ ] **Step 1: Write `README.md`** — prerequisites (build sibling `noy-db`; build this repo's `@noy-db/ui-nuxt`), then `pnpm install && pnpm seed && pnpm generate`; the demo passphrase; the note that `demo.noydb` is non-deterministic across re-seeds (don't recommit a no-op) and the cosmetic "legacy backup, no ledgerHead" console warning is expected.

- [ ] **Step 2: Static build**

Run: `cd examples/showcase && pnpm generate`
Expected: `.output/public/` contains `index.html`, the hashed JS/CSS, `demo.noydb`, and `covers/`. No SSR/vault errors during prerender (there is no prerender — `ssr:false`).

- [ ] **Step 3: Serve + smoke the static output**

Run: `pnpm exec nuxi preview` (or `npx serve .output/public`) and confirm in a browser: unlock → records → detail (cover decrypts) → artists/labels → TH/EN toggle → tour — all work from the static bundle with no backend.

- [ ] **Step 4: Full vitest suite green**

Run: `cd examples/showcase && npx vitest run`
Expected: all tests pass (Plan A 11 + Plan B logic tests).

- [ ] **Step 5: Commit**

```bash
git add examples/showcase/README.md
git commit --no-verify -m "docs(showcase): README + static build verification"
```

---

## Self-Review

**Spec coverage (against `2026-06-27-vinyl-showcase-spa-design.md`):** static `ssr:false` SPA (Task 1, 10) ✓; passphrase unlock + wrong-pass error (Task 3) ✓; one page per collection with describe-driven list/search (Tasks 4–5) ✓; joins surfaced (Task 4) ✓; record detail with ref links (Task 6) ✓; cover art proving the blob — live in-browser round-trip + caption (Task 6) ✓; Thai/English across chrome + `nui.*` + enum values + field headers (Task 7) ✓; theme toggle (Task 8) ✓; balloon tour with per-item help, Prev/Next/Skip, once-per-page + "?" relaunch, localized (Task 9) ✓; package isolation preserved (Task 1) ✓.

**Placeholder scan:** No TBD/TODO. The "reconcile against the real `@noy-db/ui` types / make the build+browser render succeed" notes are deliberate — the Plan A pattern: the provided component code is the best-known-correct starting point and the build + browser check is the contract, because the exact `useCollectionList` return-ref shape and `CollectionList` prop/emit names can only be pinned against the actual built `@noy-db/ui` types at execution time.

**Type/name consistency:** `useVault`/`unlock`/`vault` consistent (Tasks 2–6); `buildRecordsView`/`buildSimpleView` return `{ schema, columns, rows }` (Tasks 4–5); `loadCoverBytes(vault, id, fetchPng?)` consistent (Task 6); `COVER_FIELD`/`COVER_SLOT` imported, never re-hardcoded (Task 6, per Plan A); `useShowcaseI18n` surface (`t`/`enumLabel`/`fieldLabel`/`locale`/`setLocale`) consistent (Tasks 7–9); `useTour` (`start`/`next`/`prev`/`skip`/`active`/`index`/`steps`) consistent (Task 9).

**Known integration risks (front-loaded, like Plan A's spikes):** Task 1 is the module-resolution gate (`@noy-db/ui-nuxt` + `@noy-db/ui` via `file:` + overrides); Tasks 3–4 are the runtime gate (vault opens in-browser; `@noy-db/ui` renders real `describe()` data). If Task 1 or 4 reveals the `@noy-db/ui` API differs from the Plan A exploration map, fix forward against the real types and record the deltas — these two tasks are where the whole stack is proven to compose.
