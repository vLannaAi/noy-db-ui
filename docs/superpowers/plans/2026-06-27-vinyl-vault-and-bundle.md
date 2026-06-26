# Vinyl Vault & Bundle Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a committed, passphrase-gated `examples/showcase/public/demo.noydb` bundle containing a vinyl collection (3 joined collections, 24 records with encrypted cover-art blobs, TH/EN localized labels), plus the seed tooling and verification tests that prove it round-trips in a browser-safe way.

**Architecture:** A self-contained `examples/showcase` package (outside the root pnpm workspace) that `file:`-links the local sibling `noy-db` runtime. Verification "spikes" pin the exact create→export→reopen→query APIs first; then a deterministic seed script builds the vault from a typed dataset + procedural cover PNGs and exports the `.noydb` bundle. All logic is unit-tested with vitest against the real sibling runtime.

**Tech Stack:** TypeScript, vitest, `tsx` (script runner), `zod` (collection schemas), `@noy-db/hub` + `@noy-db/to-memory` + `@noy-db/as-noydb` (sibling `0.2.0-pre.30`, via `file:` links).

## Global Constraints

- **Runtime source:** sibling `noy-db@0.2.0-pre.30` via `file:` links; `noy-db` must be built first (`cd ../../../noy-db && pnpm install && pnpm build`). Every task depends on this.
- **Package isolation:** `examples/showcase` is NOT added to root `pnpm-workspace.yaml`; it installs independently. Adding the showcase must not change this repo's verify gate.
- **Passphrase (verbatim):** `spin-the-black-circle`.
- **Languages (verbatim):** `en`, `th`. English is the default/base.
- **Record counts (verbatim):** 9 artists, 5 labels, 24 records.
- **Blob field name (verbatim):** `cover` (a single slot named `art`).
- **Commit rule:** NEVER add Claude attribution (`Co-Authored-By`, "Generated with…") to commits. Use `git commit --no-verify` to avoid hook-injected footers.
- **Opt-in subsystems:** blobs require `blobStrategy: withBlobs()`; i18n requires `i18nStrategy: withI18n()` on `createNoydb`.

## File Structure

```
examples/showcase/
  package.json                 # file: deps, scripts (test, seed); NOT in root workspace
  tsconfig.json
  vitest.config.ts
  scripts/
    seed.ts                    # builds public/demo.noydb (run via tsx)
  src/data/
    types.ts                   # Artist, Label, Record TS types + zod schemas + enums
    dataset.ts                 # the 9 artists / 5 labels / 24 records (typed literals)
    cover.ts                   # procedural PNG cover generator (title → Uint8Array)
    dicts.ts                   # TH/EN dictionary tables for genre/format/condition + field labels
    vault.ts                   # buildVault(secret) + openVaultFromBundle(bytes, secret) helpers
  src/data/__tests__/
    spike-passphrase.test.ts   # Task 2
    spike-blob.test.ts         # Task 3
    spike-i18n.test.ts         # Task 4
    cover.test.ts              # Task 5
    dataset.test.ts            # Task 6
    seed.test.ts               # Task 7
  public/demo.noydb            # generated bundle (committed)
  public/covers/<id>.png       # generated cover art, static assets (committed)
```

---

### Task 1: Scaffold the `examples/showcase` package

**Files:**
- Create: `examples/showcase/package.json`
- Create: `examples/showcase/tsconfig.json`
- Create: `examples/showcase/vitest.config.ts`
- Test: `examples/showcase/src/data/__tests__/imports.test.ts`

**Interfaces:**
- Produces: an installable package whose tests can `import { createNoydb } from '@noy-db/hub'`, `{ memory } from '@noy-db/to-memory'`, `{ toBytes } from '@noy-db/as-noydb'`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@noy-db/showcase",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "seed": "tsx scripts/seed.ts"
  },
  "dependencies": {
    "@noy-db/hub": "file:../../../noy-db/packages/hub",
    "@noy-db/to-memory": "file:../../../noy-db/packages/to-memory",
    "@noy-db/as-noydb": "file:../../../noy-db/packages/as-noydb",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"],
    "esModuleInterop": true,
    "verbatimModuleSyntax": false
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 4: Write the import smoke test** — `src/data/__tests__/imports.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createNoydb } from '@noy-db/hub'
import { memory } from '@noy-db/to-memory'
import { toBytes } from '@noy-db/as-noydb'

describe('sibling runtime resolves', () => {
  it('exports are functions', () => {
    expect(typeof createNoydb).toBe('function')
    expect(typeof memory).toBe('function')
    expect(typeof toBytes).toBe('function')
  })
})
```

- [ ] **Step 5: Install and run**

Run: `cd examples/showcase && pnpm install && pnpm test`
Expected: PASS, 1 test. (If install fails resolving `file:` deps, confirm the sibling `noy-db` is built — `ls ../../../noy-db/packages/hub/dist`.)

- [ ] **Step 6: Confirm root workspace is unaffected**

Run: `grep -n showcase ../../pnpm-workspace.yaml || echo "not in workspace (correct)"`
Expected: `not in workspace (correct)`

- [ ] **Step 7: Add a `.gitignore` line for the app's node_modules, then commit**

Run: `printf 'node_modules\n.output\n.nuxt\n' > examples/showcase/.gitignore`

```bash
git add examples/showcase/package.json examples/showcase/tsconfig.json examples/showcase/vitest.config.ts examples/showcase/src examples/showcase/.gitignore
git commit --no-verify -m "chore(showcase): scaffold package linking sibling noy-db runtime"
```

---

### Task 2: SPIKE — passphrase-gated bundle round-trip + the `vault.ts` helpers

**Files:**
- Create: `examples/showcase/src/data/vault.ts`
- Test: `examples/showcase/src/data/__tests__/spike-passphrase.test.ts`

**Interfaces:**
- Produces:
  - `buildVault(secret: string): Promise<{ db: Noydb; vault: Vault }>` — creates an in-memory, encrypted vault named `vinyl` with blobs + i18n enabled (no data yet).
  - `openVaultFromBundle(bytes: Uint8Array, secret: string): Promise<Vault>` — the canonical reopen sequence; throws if `secret` is wrong.
- Consumes: `@noy-db/hub` (`createNoydb`, `readNoydbBundle`, `withBlobs`, `withI18n`), `@noy-db/to-memory` (`memory`), `@noy-db/as-noydb` (`toBytes`).

- [ ] **Step 1: Write the failing spike test** — `spike-passphrase.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { toBytes } from '@noy-db/as-noydb'
import { buildVault, openVaultFromBundle } from '../vault'

const PASS = 'spin-the-black-circle'

describe('passphrase gates the bundle', () => {
  it('right passphrase reads, wrong passphrase throws', async () => {
    const { vault } = await buildVault(PASS)
    const col = vault.collection<{ id: string; n: number }>('probe')
    await col.put('a', { id: 'a', n: 1 })
    const bytes = await toBytes(vault)

    // right passphrase: reads back
    const reopened = await openVaultFromBundle(bytes, PASS)
    const rows = reopened.collection<{ id: string; n: number }>('probe').query().toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.n).toBe(1)

    // wrong passphrase: denied
    await expect(openVaultFromBundle(bytes, 'wrong-pass')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test -- spike-passphrase`
Expected: FAIL (`buildVault` not found).

- [ ] **Step 3: Implement `vault.ts`**

```ts
import { createNoydb, readNoydbBundle, type Noydb, type Vault } from '@noy-db/hub'
import { withBlobs } from '@noy-db/hub/blobs'
import { withI18n } from '@noy-db/hub/i18n'
import { memory } from '@noy-db/to-memory'

export const VAULT_NAME = 'vinyl'
export const LANGS = ['en', 'th'] as const

/** Create a fresh in-memory, encrypted vault with blobs + i18n enabled. */
export async function buildVault(secret: string): Promise<{ db: Noydb; vault: Vault }> {
  const db = await createNoydb({
    store: memory(),
    user: 'viewer',
    secret,
    blobStrategy: withBlobs(),
    i18nStrategy: withI18n(),
  })
  const vault = await db.openVault(VAULT_NAME, { create: true })
  return { db, vault }
}

/** Reopen a .noydb bundle. Throws if `secret` cannot unlock it. */
export async function openVaultFromBundle(bytes: Uint8Array, secret: string): Promise<Vault> {
  const db = await createNoydb({
    store: memory(),
    user: 'viewer',
    secret,
    blobStrategy: withBlobs(),
    i18nStrategy: withI18n(),
  })
  const vault = await db.openVault(VAULT_NAME, { create: true })
  const { dumpJson } = await readNoydbBundle(bytes)
  await vault.load(dumpJson)
  return vault
}
```

- [ ] **Step 4: Run the spike**

Run: `pnpm test -- spike-passphrase`
Expected: PASS. **If wrong-passphrase does NOT throw**, the gate is enforced at read time, not load time — change the helper to read one record before returning (`vault.collection('probe').query().toArray()` inside a try) OR adjust the test to assert the *read* throws. Make the test green, then record the working sequence here as a comment in `vault.ts`.

- [ ] **Step 5: Commit**

```bash
git add examples/showcase/src/data/vault.ts examples/showcase/src/data/__tests__/spike-passphrase.test.ts
git commit --no-verify -m "feat(showcase): vault build + passphrase-gated bundle reopen helpers"
```

---

### Task 3: SPIKE — live in-vault blob round-trip (put→get)

> **Architecture pivot (proven during execution):** cover blobs do NOT survive the `.noydb` bundle export — `vault.dump()` omits the internal `_blob_*` collections (`to-memory`'s `loadAll` skips `_`-prefixed collections, `to-memory/src/index.ts:113`). So the showcase proves the blob capability **live**: covers ship as static PNG assets (Task 7) and the browser writes each into the vault then reads it back at runtime (Plan B). This spike proves the in-vault `put`→`get` round-trip the browser will use.

**Files:**
- Test: `examples/showcase/src/data/__tests__/spike-blob.test.ts`

**Interfaces:**
- Consumes: `buildVault` from Task 2.
- Produces: confirmed blob write/read API — `collection.blob(id).put(slot, bytes, { mimeType })` / `.get(slot)` round-trips inside a live vault.

- [ ] **Step 1: Write the failing test** — `spike-blob.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { buildVault } from '../vault'

const PASS = 'spin-the-black-circle'

describe('blob put→get round-trips inside a live vault', () => {
  it('reads back identical bytes from a vault blob', async () => {
    const { vault } = await buildVault(PASS)
    const records = vault.collection<{ id: string; title: string }>('records', {
      blobFields: { cover: { retainDays: 36500 } },
    })
    await records.put('r1', { id: 'r1', title: 'Test LP' })

    const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5])
    await records.blob('r1').put('art', original, { mimeType: 'image/png' })
    const got = await records.blob('r1').get('art')

    expect(got).not.toBeNull()
    expect(Array.from(got!)).toEqual(Array.from(original))
  })
})
```

- [ ] **Step 2: Run it**

Run: `pnpm test -- spike-blob`
Expected: PASS — `put` then `get` in the same live vault returns the identical bytes (this is the capability the browser uses; no bundle export involved).

- [ ] **Step 3: Commit**

```bash
git add examples/showcase/src/data/__tests__/spike-blob.test.ts
git commit --no-verify -m "test(showcase): prove live in-vault blob put/get round-trip"
```

---

### Task 4: SPIKE — TH/EN localized labels via dictionaries + `describe()`

**Files:**
- Test: `examples/showcase/src/data/__tests__/spike-i18n.test.ts`

**Interfaces:**
- Consumes: `buildVault` from Task 2.
- Produces: confirmed pattern for localized enum labels — `dictKeyFields` + `vault.dictionary(name).put(key, { en, th })`, read via `collection.get(id, { locale })` (resolved `<field>Label`) and/or `collection.describe(locale)`.

- [ ] **Step 1: Write the failing test** — `spike-i18n.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { dictKey } from '@noy-db/hub/i18n'
import { buildVault } from '../vault'

const PASS = 'spin-the-black-circle'

describe('enum labels localize per locale', () => {
  it('resolves a dict label in EN and TH', async () => {
    const { vault } = await buildVault(PASS)
    const records = vault.collection<{ id: string; genre: string }>('records', {
      dictKeyFields: { genre: dictKey('genre', ['rock', 'jazz']) },
    })
    const dict = vault.dictionary('genre')
    await dict.put('rock', { en: 'Rock', th: 'ร็อก' })
    await dict.put('jazz', { en: 'Jazz', th: 'แจ๊ส' })

    await records.put('r1', { id: 'r1', genre: 'rock' })

    const en = await records.get('r1', { locale: 'en' })
    const th = await records.get('r1', { locale: 'th' })
    expect((en as any).genreLabel).toBe('Rock')
    expect((th as any).genreLabel).toBe('ร็อก')
  })
})
```

- [ ] **Step 2: Run it**

Run: `pnpm test -- spike-i18n`
Expected: PASS. **If the resolved field is not `genreLabel`**, inspect the returned object keys (`console.log(Object.keys(en))`) and update the assertion to the real label key (e.g. `genre_label`). Record the real key as a comment in `dicts.ts` (Task referenced) for downstream use. If `dictKey('genre', [...])` needs a value→label map instead of vault-level `dictionary().put`, switch to `staticDict('genre', { rock: { en, th }, ... })` and make the test green.

- [ ] **Step 3: Commit**

```bash
git add examples/showcase/src/data/__tests__/spike-i18n.test.ts
git commit --no-verify -m "test(showcase): prove TH/EN dictionary label resolution"
```

---

### Task 5: Procedural cover-art generator

**Files:**
- Create: `examples/showcase/src/data/cover.ts`
- Test: `examples/showcase/src/data/__tests__/cover.test.ts`

**Interfaces:**
- Produces: `makeCover(seedText: string): Uint8Array` — a deterministic, valid PNG (gradient background derived from a hash of `seedText`, with no external assets). Deterministic so the committed bundle is stable across re-seeds.

- [ ] **Step 1: Write the failing test** — `cover.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { makeCover } from '../cover'

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('makeCover', () => {
  it('returns a valid PNG with the magic header', () => {
    const png = makeCover('Kind of Blue')
    expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    expect(png.length).toBeGreaterThan(100)
  })
  it('is deterministic for the same seed and varies by seed', () => {
    expect(Array.from(makeCover('A'))).toEqual(Array.from(makeCover('A')))
    expect(Array.from(makeCover('A'))).not.toEqual(Array.from(makeCover('B')))
  })
})
```

- [ ] **Step 2: Run it**

Run: `pnpm test -- cover`
Expected: FAIL (`makeCover` not found).

- [ ] **Step 3: Implement `cover.ts`** — a minimal, dependency-free PNG encoder of a small solid-color image whose hue is derived from the seed. (A 64×64 truecolor PNG with one IDAT using stored/uncompressed zlib blocks; no external libs.)

```ts
// Minimal PNG writer: 64x64 RGB, color derived from a hash of the seed.
// Uncompressed (stored) zlib + CRC32 — no dependencies, deterministic.

function crc32(bytes: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i]!
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1, b = 0
  for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]!) % 65521; b = (b + a) % 65521 }
  return ((b << 16) | a) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new TextEncoder().encode(type)
  const len = data.length
  const out = new Uint8Array(12 + len)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, len)
  out.set(t, 4)
  out.set(data, 8)
  dv.setUint32(8 + len, crc32(out.subarray(4, 8 + len)))
  return out
}

function hashHue(seed: string): { r: number; g: number; b: number } {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  // map to a pleasant mid-tone RGB
  return { r: 60 + (h & 0x7f), g: 60 + ((h >>> 8) & 0x7f), b: 60 + ((h >>> 16) & 0x7f) }
}

export function makeCover(seedText: string): Uint8Array {
  const W = 64, H = 64
  const { r, g, b } = hashHue(seedText)
  // raw image: each row prefixed with filter byte 0
  const raw = new Uint8Array(H * (1 + W * 3))
  for (let y = 0; y < H; y++) {
    const row = y * (1 + W * 3)
    raw[row] = 0
    for (let x = 0; x < W; x++) {
      const px = row + 1 + x * 3
      const shade = 1 - y / (H * 2) // subtle vertical gradient
      raw[px] = Math.round(r * shade)
      raw[px + 1] = Math.round(g * shade)
      raw[px + 2] = Math.round(b * shade)
    }
  }
  // zlib stored blocks
  const blocks: number[] = [0x78, 0x01]
  let off = 0
  while (off < raw.length) {
    const len = Math.min(65535, raw.length - off)
    const final = off + len >= raw.length ? 1 : 0
    blocks.push(final, len & 0xff, (len >>> 8) & 0xff, (~len) & 0xff, ((~len) >>> 8) & 0xff)
    for (let i = 0; i < len; i++) blocks.push(raw[off + i]!)
    off += len
  }
  const zlib = new Uint8Array(blocks.length + 4)
  zlib.set(blocks, 0)
  new DataView(zlib.buffer).setUint32(blocks.length, adler32(raw))

  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, W); dv.setUint32(4, H)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit, truecolor RGB

  const magic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const parts = [magic, chunk('IHDR', ihdr), chunk('IDAT', zlib), chunk('IEND', new Uint8Array(0))]
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const part of parts) { out.set(part, p); p += part.length }
  return out
}
```

- [ ] **Step 4: Run it**

Run: `pnpm test -- cover`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add examples/showcase/src/data/cover.ts examples/showcase/src/data/__tests__/cover.test.ts
git commit --no-verify -m "feat(showcase): deterministic dependency-free cover PNG generator"
```

---

### Task 6: The typed dataset (artists, labels, records) + dicts

**Files:**
- Create: `examples/showcase/src/data/types.ts`
- Create: `examples/showcase/src/data/dicts.ts`
- Create: `examples/showcase/src/data/dataset.ts`
- Test: `examples/showcase/src/data/__tests__/dataset.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `Artist`, `Label`, `Record` TS types; `ArtistSchema`, `LabelSchema`, `RecordSchema` (zod); `GENRES`, `FORMATS`, `CONDITIONS` const arrays.
  - `dicts.ts`: `GENRE_LABELS`, `FORMAT_LABELS`, `CONDITION_LABELS` as `Record<string, { en: string; th: string }>`; `FIELD_LABELS` per collection as `Record<string, { en: string; th: string }>`.
  - `dataset.ts`: `artists: Artist[]` (9), `labels: Label[]` (5), `records: Record[]` (24).
- Consumes: nothing (pure data).

- [ ] **Step 1: Write the failing test** — `dataset.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { artists, labels, records } from '../dataset'
import { ArtistSchema, LabelSchema, RecordSchema, GENRES, FORMATS, CONDITIONS } from '../types'

describe('dataset integrity', () => {
  it('has the required counts', () => {
    expect(artists).toHaveLength(9)
    expect(labels).toHaveLength(5)
    expect(records).toHaveLength(24)
  })
  it('every row matches its schema', () => {
    for (const a of artists) expect(ArtistSchema.safeParse(a).success).toBe(true)
    for (const l of labels) expect(LabelSchema.safeParse(l).success).toBe(true)
    for (const r of records) expect(RecordSchema.safeParse(r).success).toBe(true)
  })
  it('refs resolve and enums are in range', () => {
    const artistIds = new Set(artists.map((a) => a.id))
    const labelIds = new Set(labels.map((l) => l.id))
    for (const r of records) {
      expect(artistIds.has(r.artistId)).toBe(true)
      expect(labelIds.has(r.labelId)).toBe(true)
      expect(GENRES).toContain(r.genre)
      expect(FORMATS).toContain(r.format)
      expect(CONDITIONS).toContain(r.condition)
    }
  })
  it('ids are unique within each collection', () => {
    expect(new Set(records.map((r) => r.id)).size).toBe(24)
  })
})
```

- [ ] **Step 2: Run it**

Run: `pnpm test -- dataset`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `types.ts`**

```ts
import { z } from 'zod'

export const GENRES = ['rock', 'jazz', 'soul', 'electronic', 'hiphop', 'classical'] as const
export const FORMATS = ['LP', 'EP', 'Single', '12"'] as const
export const CONDITIONS = ['M', 'NM', 'VG+', 'VG', 'G'] as const

export const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),       // ISO-3166 alpha-2 (semanticType: country)
  formedYear: z.number().int(),
  genre: z.enum(GENRES),
})
export const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  founded: z.number().int(),
})
export const RecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistId: z.string(),
  labelId: z.string(),
  year: z.number().int(),
  genre: z.enum(GENRES),
  format: z.enum(FORMATS),
  condition: z.enum(CONDITIONS),
  durationMin: z.number(),
  trackCount: z.number().int(),
  rating: z.number().int().min(1).max(5),
  priceUsd: z.number(),
  purchasedOn: z.string(),   // ISO date
  favorite: z.boolean(),
  notes: z.string(),
})

export type Artist = z.infer<typeof ArtistSchema>
export type Label = z.infer<typeof LabelSchema>
export type Record = z.infer<typeof RecordSchema>
```

- [ ] **Step 4: Implement `dicts.ts`**

```ts
export const GENRE_LABELS: Record<string, { en: string; th: string }> = {
  rock: { en: 'Rock', th: 'ร็อก' },
  jazz: { en: 'Jazz', th: 'แจ๊ส' },
  soul: { en: 'Soul', th: 'โซล' },
  electronic: { en: 'Electronic', th: 'อิเล็กทรอนิก' },
  hiphop: { en: 'Hip-Hop', th: 'ฮิปฮอป' },
  classical: { en: 'Classical', th: 'คลาสสิก' },
}
export const FORMAT_LABELS: Record<string, { en: string; th: string }> = {
  LP: { en: 'LP', th: 'แผ่นใหญ่ (LP)' },
  EP: { en: 'EP', th: 'อีพี (EP)' },
  Single: { en: 'Single', th: 'ซิงเกิล' },
  '12"': { en: '12-inch', th: '12 นิ้ว' },
}
export const CONDITION_LABELS: Record<string, { en: string; th: string }> = {
  M: { en: 'Mint', th: 'สภาพดีเยี่ยม' },
  NM: { en: 'Near Mint', th: 'เกือบสมบูรณ์' },
  'VG+': { en: 'Very Good Plus', th: 'ดีมากบวก' },
  VG: { en: 'Very Good', th: 'ดีมาก' },
  G: { en: 'Good', th: 'พอใช้' },
}
// Per-collection field labels (used as i18n metadata when seeding).
export const FIELD_LABELS: Record<string, Record<string, { en: string; th: string }>> = {
  records: {
    title: { en: 'Title', th: 'ชื่ออัลบั้ม' },
    artistId: { en: 'Artist', th: 'ศิลปิน' },
    labelId: { en: 'Label', th: 'ค่ายเพลง' },
    year: { en: 'Year', th: 'ปี' },
    genre: { en: 'Genre', th: 'แนวเพลง' },
    format: { en: 'Format', th: 'รูปแบบ' },
    condition: { en: 'Condition', th: 'สภาพ' },
    durationMin: { en: 'Duration', th: 'ความยาว' },
    trackCount: { en: 'Tracks', th: 'จำนวนเพลง' },
    rating: { en: 'Rating', th: 'คะแนน' },
    priceUsd: { en: 'Price', th: 'ราคา' },
    purchasedOn: { en: 'Purchased', th: 'วันที่ซื้อ' },
    favorite: { en: 'Favorite', th: 'รายการโปรด' },
    notes: { en: 'Notes', th: 'บันทึก' },
  },
  artists: {
    name: { en: 'Name', th: 'ชื่อ' },
    country: { en: 'Country', th: 'ประเทศ' },
    formedYear: { en: 'Formed', th: 'ก่อตั้ง' },
    genre: { en: 'Genre', th: 'แนวเพลง' },
  },
  labels: {
    name: { en: 'Name', th: 'ชื่อ' },
    country: { en: 'Country', th: 'ประเทศ' },
    founded: { en: 'Founded', th: 'ก่อตั้ง' },
  },
}
```

- [ ] **Step 5: Implement `dataset.ts`** — 9 artists, 5 labels, 24 records. Use real-sounding but generic catalogue entries; every `artistId`/`labelId` must exist; spread genres/formats/conditions for variety.

```ts
import type { Artist, Label, Record } from './types'

export const artists: Artist[] = [
  { id: 'ar1', name: 'The Midnight Echoes', country: 'GB', formedYear: 1971, genre: 'rock' },
  { id: 'ar2', name: 'Blue Quartet', country: 'US', formedYear: 1959, genre: 'jazz' },
  { id: 'ar3', name: 'Marvelle', country: 'US', formedYear: 1966, genre: 'soul' },
  { id: 'ar4', name: 'Neon Circuit', country: 'DE', formedYear: 1978, genre: 'electronic' },
  { id: 'ar5', name: 'Crate Diggers', country: 'US', formedYear: 1992, genre: 'hiphop' },
  { id: 'ar6', name: 'Aurelia Strings', country: 'AT', formedYear: 1948, genre: 'classical' },
  { id: 'ar7', name: 'Velvet Static', country: 'GB', formedYear: 1985, genre: 'rock' },
  { id: 'ar8', name: 'Sun Ra Tribute', country: 'US', formedYear: 1974, genre: 'jazz' },
  { id: 'ar9', name: 'Tokyo Pulse', country: 'JP', formedYear: 1983, genre: 'electronic' },
]

export const labels: Label[] = [
  { id: 'lb1', name: 'Groove Hill', country: 'US', founded: 1958 },
  { id: 'lb2', name: 'Northern Wax', country: 'GB', founded: 1969 },
  { id: 'lb3', name: 'Kosmos Audio', country: 'DE', founded: 1975 },
  { id: 'lb4', name: 'Deep Crate', country: 'US', founded: 1990 },
  { id: 'lb5', name: 'Sakura Sound', country: 'JP', founded: 1981 },
]

// 24 records — vary every enum, ref, and numeric field.
export const records: Record[] = [
  { id: 'rc01', title: 'Echoes at Dawn', artistId: 'ar1', labelId: 'lb2', year: 1973, genre: 'rock', format: 'LP', condition: 'NM', durationMin: 42.5, trackCount: 9, rating: 5, priceUsd: 34, purchasedOn: '2024-03-11', favorite: true, notes: 'Gatefold sleeve, first press.' },
  { id: 'rc02', title: 'Quartet in Blue', artistId: 'ar2', labelId: 'lb1', year: 1961, genre: 'jazz', format: 'LP', condition: 'VG+', durationMin: 38.2, trackCount: 6, rating: 5, priceUsd: 58, purchasedOn: '2023-11-02', favorite: true, notes: 'Mono pressing.' },
  { id: 'rc03', title: 'Sweet Marvelle', artistId: 'ar3', labelId: 'lb1', year: 1968, genre: 'soul', format: 'LP', condition: 'VG', durationMin: 35.0, trackCount: 10, rating: 4, priceUsd: 22, purchasedOn: '2024-01-19', favorite: false, notes: 'Light surface noise side B.' },
  { id: 'rc04', title: 'Circuit Bloom', artistId: 'ar4', labelId: 'lb3', year: 1981, genre: 'electronic', format: '12"', condition: 'NM', durationMin: 18.4, trackCount: 3, rating: 4, priceUsd: 27, purchasedOn: '2024-05-06', favorite: false, notes: 'Extended club mix.' },
  { id: 'rc05', title: 'Boom Bap Almanac', artistId: 'ar5', labelId: 'lb4', year: 1995, genre: 'hiphop', format: 'LP', condition: 'M', durationMin: 51.0, trackCount: 14, rating: 5, priceUsd: 45, purchasedOn: '2024-02-28', favorite: true, notes: 'Sealed reissue.' },
  { id: 'rc06', title: 'Adagio for Strings', artistId: 'ar6', labelId: 'lb3', year: 1955, genre: 'classical', format: 'LP', condition: 'VG+', durationMin: 47.3, trackCount: 4, rating: 4, priceUsd: 30, purchasedOn: '2023-09-14', favorite: false, notes: 'Deutsche pressing.' },
  { id: 'rc07', title: 'Static Velvet', artistId: 'ar7', labelId: 'lb2', year: 1987, genre: 'rock', format: 'EP', condition: 'NM', durationMin: 22.0, trackCount: 4, rating: 3, priceUsd: 15, purchasedOn: '2024-04-21', favorite: false, notes: '' },
  { id: 'rc08', title: 'Space Chant', artistId: 'ar8', labelId: 'lb1', year: 1976, genre: 'jazz', format: 'LP', condition: 'VG', durationMin: 44.6, trackCount: 7, rating: 4, priceUsd: 40, purchasedOn: '2023-12-09', favorite: false, notes: 'Spiritual jazz classic.' },
  { id: 'rc09', title: 'Tokyo Pulse I', artistId: 'ar9', labelId: 'lb5', year: 1984, genre: 'electronic', format: 'LP', condition: 'NM', durationMin: 39.9, trackCount: 8, rating: 5, priceUsd: 62, purchasedOn: '2024-06-01', favorite: true, notes: 'City pop crossover.' },
  { id: 'rc10', title: 'Echoes at Dusk', artistId: 'ar1', labelId: 'lb2', year: 1975, genre: 'rock', format: 'LP', condition: 'VG+', durationMin: 40.1, trackCount: 8, rating: 4, priceUsd: 28, purchasedOn: '2024-03-12', favorite: false, notes: '' },
  { id: 'rc11', title: 'Blue Note Sketches', artistId: 'ar2', labelId: 'lb1', year: 1963, genre: 'jazz', format: 'LP', condition: 'VG', durationMin: 36.8, trackCount: 6, rating: 4, priceUsd: 33, purchasedOn: '2023-10-30', favorite: false, notes: '' },
  { id: 'rc12', title: 'Marvelle Live', artistId: 'ar3', labelId: 'lb1', year: 1970, genre: 'soul', format: 'LP', condition: 'G', durationMin: 48.0, trackCount: 11, rating: 3, priceUsd: 18, purchasedOn: '2024-01-20', favorite: false, notes: 'Well-played copy.' },
  { id: 'rc13', title: 'Neon Drift', artistId: 'ar4', labelId: 'lb3', year: 1983, genre: 'electronic', format: 'Single', condition: 'NM', durationMin: 7.5, trackCount: 2, rating: 3, priceUsd: 12, purchasedOn: '2024-05-07', favorite: false, notes: '' },
  { id: 'rc14', title: 'Crate Diggers Vol. 2', artistId: 'ar5', labelId: 'lb4', year: 1997, genre: 'hiphop', format: 'LP', condition: 'NM', durationMin: 49.5, trackCount: 13, rating: 4, priceUsd: 38, purchasedOn: '2024-03-01', favorite: false, notes: '' },
  { id: 'rc15', title: 'Concerto No. 3', artistId: 'ar6', labelId: 'lb3', year: 1958, genre: 'classical', format: 'LP', condition: 'VG+', durationMin: 52.2, trackCount: 3, rating: 5, priceUsd: 41, purchasedOn: '2023-09-15', favorite: true, notes: '' },
  { id: 'rc16', title: 'Velvet Static II', artistId: 'ar7', labelId: 'lb2', year: 1989, genre: 'rock', format: 'LP', condition: 'VG', durationMin: 43.0, trackCount: 10, rating: 3, priceUsd: 20, purchasedOn: '2024-04-22', favorite: false, notes: '' },
  { id: 'rc17', title: 'Cosmic Suite', artistId: 'ar8', labelId: 'lb1', year: 1978, genre: 'jazz', format: '12"', condition: 'NM', durationMin: 19.8, trackCount: 2, rating: 4, priceUsd: 26, purchasedOn: '2023-12-10', favorite: false, notes: '' },
  { id: 'rc18', title: 'Tokyo Pulse II', artistId: 'ar9', labelId: 'lb5', year: 1986, genre: 'electronic', format: 'LP', condition: 'M', durationMin: 41.2, trackCount: 9, rating: 5, priceUsd: 70, purchasedOn: '2024-06-02', favorite: true, notes: 'Obi strip intact.' },
  { id: 'rc19', title: 'Midnight Reprise', artistId: 'ar1', labelId: 'lb2', year: 1979, genre: 'rock', format: 'EP', condition: 'NM', durationMin: 24.5, trackCount: 5, rating: 4, priceUsd: 19, purchasedOn: '2024-03-13', favorite: false, notes: '' },
  { id: 'rc20', title: 'After Hours', artistId: 'ar2', labelId: 'lb1', year: 1965, genre: 'jazz', format: 'LP', condition: 'VG+', durationMin: 37.7, trackCount: 7, rating: 4, priceUsd: 35, purchasedOn: '2023-11-03', favorite: false, notes: '' },
  { id: 'rc21', title: 'Soul Revival', artistId: 'ar3', labelId: 'lb4', year: 1972, genre: 'soul', format: 'Single', condition: 'VG', durationMin: 6.8, trackCount: 2, rating: 3, priceUsd: 10, purchasedOn: '2024-01-21', favorite: false, notes: '' },
  { id: 'rc22', title: 'Kosmos Drift', artistId: 'ar4', labelId: 'lb3', year: 1985, genre: 'electronic', format: 'LP', condition: 'NM', durationMin: 45.0, trackCount: 8, rating: 4, priceUsd: 32, purchasedOn: '2024-05-08', favorite: false, notes: '' },
  { id: 'rc23', title: 'Diggin Deeper', artistId: 'ar5', labelId: 'lb4', year: 1999, genre: 'hiphop', format: '12"', condition: 'M', durationMin: 16.5, trackCount: 3, rating: 4, priceUsd: 24, purchasedOn: '2024-03-02', favorite: false, notes: '' },
  { id: 'rc24', title: 'String Theory', artistId: 'ar6', labelId: 'lb3', year: 1961, genre: 'classical', format: 'LP', condition: 'VG', durationMin: 50.0, trackCount: 5, rating: 4, priceUsd: 29, purchasedOn: '2023-09-16', favorite: false, notes: '' },
]
```

- [ ] **Step 6: Run the test**

Run: `pnpm test -- dataset`
Expected: PASS (all four assertions).

- [ ] **Step 7: Commit**

```bash
git add examples/showcase/src/data/types.ts examples/showcase/src/data/dicts.ts examples/showcase/src/data/dataset.ts examples/showcase/src/data/__tests__/dataset.test.ts
git commit --no-verify -m "feat(showcase): typed vinyl dataset + TH/EN dicts with integrity tests"
```

---

### Task 7: Seed script → committed `public/demo.noydb`

**Files:**
- Create: `examples/showcase/scripts/seed.ts`
- Create (generated, committed): `examples/showcase/public/demo.noydb`
- Test: `examples/showcase/src/data/__tests__/seed.test.ts`

**Interfaces:**
- Consumes: `buildVault` (Task 2), `makeCover` (Task 5), `artists/labels/records` (Task 6), `*_LABELS`/`FIELD_LABELS` (Task 6), the confirmed dict pattern (Task 4). Blobs are NOT written into the vault here (Task 3 proved they don't survive the bundle).
- Produces:
  - `seedVault(): Promise<Vault>` — builds the fully-populated `vinyl` vault in memory (3 collections w/ refs, fieldMeta, dictKeyFields; dictionaries populated). No blob writes.
  - `coverFiles(): { id: string; bytes: Uint8Array }[]` — the 24 cover PNGs.
  - `seed.ts` default execution: `toBytes(seedVault())` → `public/demo.noydb`, plus `public/covers/<id>.png` per record.

- [ ] **Step 1: Write the failing test** — `seed.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { toBytes } from '@noy-db/as-noydb'
import { seedVault, coverFiles } from '../../../scripts/seed'
import { openVaultFromBundle } from '../vault'

const PASS = 'spin-the-black-circle'

describe('seeded vault', () => {
  it('round-trips 24 records with joins, covers, and TH/EN labels', async () => {
    const vault = await seedVault()
    const bytes = await toBytes(vault)
    const v = await openVaultFromBundle(bytes, PASS)

    const records = v.collection('records', { blobFields: { cover: { retainDays: 36500 } } })
    const rows = records.query().join('artistId', { as: 'artist' }).join('labelId', { as: 'label' }).toArray()
    expect(rows).toHaveLength(24)
    expect((rows[0] as any).artist).toBeTruthy()      // join resolved
    expect((rows[0] as any).label).toBeTruthy()

    const covers = coverFiles()  // covers ship as static PNG assets, not in the bundle
    expect(covers).toHaveLength(24)
    expect(Array.from(covers[0]!.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])

    const en = await records.get('rc01', { locale: 'en' })  // label localized
    const th = await records.get('rc01', { locale: 'th' })
    expect((en as any).genreLabel ?? (en as any).genre_label).toBeTruthy()
    expect((th as any).genreLabel ?? (th as any).genre_label).not.toBe((en as any).genreLabel ?? (en as any).genre_label)
  }, 30_000)
})
```

> Note: align the label-field key (`genreLabel` vs `genre_label`) with whatever Task 4 proved; drop the `??` once known.

- [ ] **Step 2: Run it**

Run: `pnpm test -- seed`
Expected: FAIL (`seedVault` not found).

- [ ] **Step 3: Implement `scripts/seed.ts`**

```ts
import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { dictKey } from '@noy-db/hub/i18n'
import { ref, type Vault } from '@noy-db/hub'
import { toBytes } from '@noy-db/as-noydb'
import { buildVault } from '../src/data/vault'
import { makeCover } from '../src/data/cover'
import { artists, labels, records } from '../src/data/dataset'
import {
  GENRE_LABELS, FORMAT_LABELS, CONDITION_LABELS, FIELD_LABELS,
} from '../src/data/dicts'
import { ArtistSchema, LabelSchema, RecordSchema } from '../src/data/types'

const PASS = 'spin-the-black-circle'

// fieldMeta builder: English label + semanticType from FIELD_LABELS + a small overrides map.
function fieldMeta(collection: string, overrides: Record<string, Record<string, unknown>> = {}) {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [key, l] of Object.entries(FIELD_LABELS[collection]!)) {
    out[key] = { label: l.en, ...(overrides[key] ?? {}) }
  }
  return out
}

export async function seedVault(): Promise<Vault> {
  const { vault } = await buildVault(PASS)

  // --- dictionaries (TH/EN) ---
  const putDict = async (name: string, table: Record<string, { en: string; th: string }>) => {
    const dict = vault.dictionary(name)
    for (const [k, v] of Object.entries(table)) await dict.put(k, { en: v.en, th: v.th })
  }
  await putDict('genre', GENRE_LABELS)
  await putDict('format', FORMAT_LABELS)
  await putDict('condition', CONDITION_LABELS)

  // --- collections ---
  const artistsCol = vault.collection('artists', {
    schema: ArtistSchema,
    dictKeyFields: { genre: dictKey('genre') },
    fieldMeta: fieldMeta('artists', { country: { semanticType: 'country' } }),
    meta: { label: 'Artists' },
  })
  const labelsCol = vault.collection('labels', {
    schema: LabelSchema,
    fieldMeta: fieldMeta('labels', { country: { semanticType: 'country' } }),
    meta: { label: 'Labels' },
  })
  const recordsCol = vault.collection('records', {
    schema: RecordSchema,
    refs: { artistId: ref('artists', 'warn'), labelId: ref('labels', 'warn') },
    dictKeyFields: { genre: dictKey('genre'), format: dictKey('format'), condition: dictKey('condition') },
    blobFields: { cover: { retainDays: 36500 } },
    fieldMeta: fieldMeta('records', {
      artistId: { semanticType: 'entity', displayFor: 'artistId' },
      labelId: { semanticType: 'entity', displayFor: 'labelId' },
      priceUsd: { semanticType: 'money', unit: 'USD' },
      durationMin: { semanticType: 'number', unit: 'min' },
      purchasedOn: { semanticType: 'date' },
      notes: { widget: 'textarea' },
      favorite: { widget: 'checkbox' },
    }),
    meta: { label: 'Records' },
  })

  // --- seed rows (records only; blobs are NOT written here — they don't
  //     survive the bundle export, so covers ship as static assets and the
  //     browser writes them into the vault at runtime, see Plan B) ---
  for (const a of artists) await artistsCol.put(a.id, a)
  for (const l of labels) await labelsCol.put(l.id, l)
  for (const r of records) await recordsCol.put(r.id, r)

  return vault
}

/** Cover PNG bytes per record id — written as static assets by `main()`. */
export function coverFiles(): { id: string; bytes: Uint8Array }[] {
  return records.map((r) => ({ id: r.id, bytes: makeCover(r.title) }))
}

// Executed by `pnpm seed`.
async function main() {
  const vault = await seedVault()
  const bytes = await toBytes(vault)
  const here = dirname(fileURLToPath(import.meta.url))
  const publicDir = join(here, '..', 'public')
  await mkdir(publicDir, { recursive: true })
  const out = join(publicDir, 'demo.noydb')
  await writeFile(out, bytes)

  // Covers ship as static assets (blobs don't travel in the bundle).
  const coversDir = join(publicDir, 'covers')
  await mkdir(coversDir, { recursive: true })
  for (const { id, bytes: png } of coverFiles()) {
    await writeFile(join(coversDir, `${id}.png`), png)
  }
  console.log(`wrote ${out} (${bytes.length} bytes) + ${coverFiles().length} covers`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
```

> If Task 4 proved a different dict declaration (e.g. `staticDict` instead of `dictKey` + `vault.dictionary().put`), mirror that proven pattern here for all three enum fields.

- [ ] **Step 4: Run the round-trip test**

Run: `pnpm test -- seed`
Expected: PASS. Adjust `fieldMeta`/dict wiring until green if the runtime rejects a metadata key (the spikes in Tasks 3–4 define the valid shapes).

- [ ] **Step 5: Generate the committed bundle**

Run: `pnpm seed`
Expected: `wrote .../public/demo.noydb (NNNNN bytes) + 24 covers`.

- [ ] **Step 6: Sanity-check the artifacts and commit them**

Run: `node -e "const fs=require('fs');console.log('bundle',fs.readFileSync('public/demo.noydb').length,'covers',fs.readdirSync('public/covers').length)"`
Expected: a non-trivial bundle byte count and `covers 24`.

```bash
git add examples/showcase/scripts/seed.ts examples/showcase/src/data/__tests__/seed.test.ts examples/showcase/public/demo.noydb examples/showcase/public/covers
git commit --no-verify -m "feat(showcase): seed script + committed demo.noydb bundle and cover assets"
```

- [ ] **Step 7: Full suite green**

Run: `pnpm test`
Expected: all tests pass (imports, spikes, cover, dataset, seed).

---

## Self-Review

**Spec coverage:** vinyl 3-collection model w/ joins (Tasks 6–7) ✓; 24 records + counts (Task 6) ✓; cover blobs — proven NOT to survive the bundle (Task 3), pivoted to **live in-vault round-trip** (Task 3 capability) + **static cover PNG assets** shipped from the seed (Tasks 5, 7) ✓; TH/EN labels (Tasks 4, 6, 7) ✓; passphrase gate (Task 2) ✓; `.noydb` bundle artifact (Task 7) ✓; browser-safe runtime (confirmed via exploration; `toBytes`/hub are Web-Crypto-only, exercised in Node tests here, validated in-browser in Plan B) ✓; package isolation from root workspace (Task 1) ✓. **Plan B owns:** Nuxt app, unlock UI, pages, i18n switcher, TourBalloon, and the in-browser blob write-then-read that renders covers from the vault.

**Placeholder scan:** No TBD/TODO. The two "if the spike proves a different shape, mirror it" notes are deliberate TDD guidance tied to a green test, not placeholders — the provided code is the best-known-correct starting point and the test is the contract.

**Type consistency:** `buildVault`/`openVaultFromBundle` signatures match across Tasks 2/3/7; `makeCover(string): Uint8Array` consistent (Tasks 5/7); dataset exports `artists/labels/records` consistent (Tasks 6/7); blob slot name `art` and field `cover` consistent (Tasks 3/7); passphrase `spin-the-black-circle` consistent throughout.

**Open contract (resolved during execution, by design):** the exact localized-label field key (`genreLabel` vs `genre_label`) and the precise wrong-passphrase failure point (load vs first read) are pinned by the Task 2/4 spikes; downstream tasks consume whatever those tests prove.
