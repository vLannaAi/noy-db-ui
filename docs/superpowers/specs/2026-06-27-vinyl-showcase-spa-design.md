# Vinyl Showcase SPA — Design

**Date:** 2026-06-27
**Status:** Approved (design); pending implementation plan
**Repo:** `noy-db-ui`

## Goal

A static, browser-only Nuxt SPA that demonstrates the `@noy-db/ui` + `@noy-db/ui-nuxt`
packages against a **real** noy-db vault: unlock a `.noydb` bundle with a simple
passphrase, then browse one page per collection. The vault models a **vinyl record
collection** with joins, varied field types, **encrypted cover-art blobs**, and
**Thai/English** localization. A custom guided "balloon" tour explains each UI element.

The showcase exists to prove three things end to end:
1. The UI library renders list / detail / search / forms from `collection.describe()`
   metadata with **no per-collection code**.
2. A noy-db vault runs **fully in the browser** (Web Crypto), gated by a passphrase,
   round-tripping both structured fields **and binary blobs** through the bundle.
3. noy-db's **i18n** surfaces localized labels through `describe()`.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Demo domain | Vinyl / music collection |
| Vault runtime | **Local sibling** `noy-db@0.2.0-pre.30` via `file:` links (seed + browser identical) |
| Tour mechanism | **Custom** `<TourBalloon>` component (zero deps, `--nui-*` styled) |
| Languages | Thai 🇹🇭 + English 🇬🇧, switchable at runtime |
| Binary proof | Album **cover art stored as encrypted blobs** in the vault |
| Render mode | `ssr: false` + `nuxi generate` → pure static SPA |

## Architecture

### Location & isolation

- New app at **`examples/showcase/`** in this repo.
- **Deliberately excluded from the root pnpm workspace** (`pnpm-workspace.yaml` is not
  extended to include it), so it never affects the `@noy-db/ui` / `@noy-db/ui-nuxt`
  verify gate or CI. It has its own `package.json` and is installed/built on its own.

### Dependencies (all `file:` links to built output)

- `@noy-db/ui-nuxt` → `file:../../packages/ui-nuxt` (this repo, built `dist/`)
- `@noy-db/hub`, `@noy-db/to-memory`, `@noy-db/as-noydb` → `file:` links to built
  `../../../noy-db/packages/*` (sibling, `0.2.0-pre.30`)

### Build / run flow (documented in the app README)

1. `cd ../../../noy-db && pnpm install && pnpm build` (build the sibling runtime)
2. `cd noy-db-ui && pnpm install && pnpm build` (build `@noy-db/ui-nuxt`)
3. `cd examples/showcase && pnpm install`
4. `pnpm seed` — runs `scripts/seed.ts`, regenerates `public/demo.noydb` (committed)
5. `pnpm dev` (Nuxt dev) or `pnpm generate` (static SPA into `.output/public`)

**Trade-off (accepted):** because the runtime is the local sibling, the showcase is a
local/demo artifact. It does **not** build in this repo's CI and does **not** install
from a fresh clone without the sibling present. This is the explicit cost of the
"local sibling / freshest API" choice.

## Data model — vinyl vault

Passphrase: **`spin-the-black-circle`** (shown as a visible hint on the unlock screen;
it is a public demo). Store: `to-memory` in the browser; the bundle is the source of truth.

Three collections, ~38 rows total:

### `artists` (~9 rows)
| field | type / widget | notes |
|---|---|---|
| `id` | string | key |
| `name` | text | proper noun (not localized) |
| `country` | country (semanticType) | e.g. US, GB, JP |
| `formedYear` | number | |
| `genre` | enum | localized dict labels (TH/EN) |

### `labels` (~5 rows)
| field | type / widget | notes |
|---|---|---|
| `id` | string | key |
| `name` | text | proper noun |
| `country` | country | |
| `founded` | number | year |

### `records` (24 rows) — the main collection
| field | type / widget | notes |
|---|---|---|
| `id` | string | key |
| `title` | text | proper noun |
| `artistId` | ref → `artists` | join; detail links to `/artists/[id]` |
| `labelId` | ref → `labels` | join |
| `year` | number | |
| `genre` | enum | localized dict labels |
| `format` | enum | LP / EP / Single / 12″ — localized labels |
| `condition` | enum | M / NM / VG+ / VG / G — localized labels |
| `durationMin` | number + unit (`min`) | |
| `trackCount` | number | |
| `rating` | number | 1–5 |
| `priceUsd` | money (USD) | |
| `purchasedOn` | date | |
| `favorite` | checkbox (boolean) | |
| `notes` | textarea | |
| `cover` | **blob** | encrypted PNG (procedurally generated at seed) |

This exercises every widget the UI resolves (enum, money, unit, date, number, boolean,
textarea, country) **plus two ref-joins** (record→artist name, record→label name)
**plus a binary blob**.

### Joins

`records` list/detail uses `joinedSchema` / `joinedRows` (from `@noy-db/ui`) to flatten
`artist.name` and `label.name` onto each record row, backed by
`vault.collection('records').query().join('artistId', { as: 'artist' })…` at load time.

## Seed script (`scripts/seed.ts`)

Run once; output (`public/demo.noydb`) is committed so the static site needs no
build-time secrets. Steps:

1. `createNoydb({ store: memory(), user: 'viewer', secret: 'spin-the-black-circle' })`
2. `openVault('vinyl')`
3. Define the 3 collections with `refs`, `fieldMeta`, localized dict descriptors for
   the enum fields, and `blobFields` for `cover`.
4. Generate 24 cover PNGs procedurally (gradient + album title text → PNG bytes) and
   write them as blobs alongside each record.
5. Seed all records (artists, labels, records).
6. Export the bundle via `as-noydb` → write bytes to `public/demo.noydb`.

## Unlock flow (`/`)

1. Passphrase input (hint visible) + "Unlock" button; language switcher present.
2. On submit: `createNoydb({ store: memory(), secret })` →
   `fetch('/demo.noydb')` as `ArrayBuffer` → `readNoydbBundle` → `vault.load(dumpJson)`.
3. **Wrong passphrase fails to decrypt** → inline "that didn't unlock it" error
   (the vault stays locked, no records readable).
4. On success: keep the open vault in a Nuxt plugin / shared state and route to
   `/records`.

## Pages & navigation

After unlock, a sidebar lists collections (from `vault` introspection):

- `/records` — `SearchBox` + `CollectionList` (joined artist/label columns, cover
  thumbnail via a `#cell-cover` slot), sort / filter / group via `useCollectionList`.
- `/artists` — `SearchBox` + `CollectionList`.
- `/labels` — `SearchBox` + `CollectionList`.
- `/records/[id]` — `RecordDetail` with a cover **hero image** and ref fields linking
  to `/artists/[id]` / `/labels/[id]`.
- Header: theme toggle (`useTheme`) + TH/EN language switcher + "?" tour button.

## i18n architecture (TH + EN)

Three layers, all driven by one active `locale` ref with a header switcher:

1. **App chrome** (unlock, nav, page titles, tour copy): showcase-owned `messages.ts`
   with `th` + `en` dictionaries; a local `t(key, fallback)` reads the active locale.
2. **UI library strings** (`nui.*`): same `t` + `locale` passed to
   `provideNoydbUi({ locale, t })`; switching re-provides them.
3. **Vault data labels** (collection labels, field labels, enum values for
   genre/format/condition): localized **inside the vault** via the hub's `i18nText()`
   / dictionary descriptors, so `describe()` returns the active-locale label. Switching
   locale re-derives schema from `describe()` for that locale.

Record *values* that are proper nouns (titles, artist/label names) are not localized.

## Cover blob handling ("prove the blob")

- Stored: `cover` blob field, encrypted in the vault, included in the `.noydb` bundle.
- Rendered: read blob bytes from the vault → `URL.createObjectURL(new Blob([bytes]))`
  → `<img>`; object URLs revoked on unmount. Thumbnail in the list, hero in detail.
- Proof surface: a caption **"decrypted from a vault blob · N KB"** under each cover,
  and a dedicated tour balloon: *"This cover was stored as encrypted binary inside the
  vault and decrypted in your browser — no external URL."*

## TourBalloon component

A small custom Vue overlay (zero deps, `--nui-*` styled):

- Input: an ordered list of steps `{ target: '[data-tour="search"]', titleKey, bodyKey }`
  (copy resolved through `t()` in the active language).
- Behavior: dims the page, highlights the current target, floats a balloon beside it
  with **title + help body + Prev / Next / Skip** and an "n / N" counter.
- Targets carry `data-tour="…"` attributes on the relevant UI elements.
- Per-page tour walks, e.g. on `/records`: search box → sortable column header →
  filter chip → group-by control → cover thumbnail (blob proof) → a row (→ detail) →
  theme toggle → language switcher.
- Auto-starts once per page (remembered in `localStorage`); re-launchable via the "?"
  button.

## Verification plan (front-loaded — verify before building UI)

Each risk gets a tiny standalone check first; if reality differs from assumptions, the
design is adjusted before UI work.

1. **Passphrase gates** — seed → export → reopen with the **wrong** passphrase must
   deny/throw on read; right passphrase reads records. Confirms the unlock UX premise.
2. **hub bundles for the browser** — `@noy-db/hub` + `as-noydb` contain no Node-only
   APIs; verify a real `nuxi generate` build runs the vault client-side.
3. **`.noydb` static asset** — served as a binary file, fetched as `ArrayBuffer`.
4. **Blob round-trip** — pin the `collection({ blobFields })` write/read API; confirm
   `as-noydb` includes blobs in the bundle and they decrypt in the browser.
5. **i18n labels** — confirm `i18nText()` / dict labels surface through `describe()`
   per locale. **Fallback:** if the API is heavier than it's worth, ship bilingual
   *chrome* + English data labels (flag before building).

## Non-goals / out of scope

- Editing/writing back to the vault. `RecordDetail` is read-only; `RecordForm` is out
  of scope for v1 (no persistence). Browse/search/detail only.
- Publishing the showcase to npm or building it in this repo's CI.
- Authentication beyond the single demo passphrase; no tier-2 (`on-password`).
- More than the three collections; more than ~24 records.

## File layout (anticipated)

```
examples/showcase/
  package.json            # file: links; scripts: seed, dev, generate
  nuxt.config.ts          # modules: ['@noy-db/ui-nuxt/module'], ssr: false
  README.md               # build/run prerequisites
  scripts/seed.ts         # builds public/demo.noydb
  public/demo.noydb       # committed, generated bundle
  app/
    plugins/vault.client.ts   # holds the opened vault, provideNoydbUi
    i18n/messages.ts          # th + en chrome/nui strings
    components/TourBalloon.vue
    composables/useTour.ts
    pages/index.vue           # unlock
    pages/records/index.vue
    pages/records/[id].vue
    pages/artists/index.vue
    pages/labels/index.vue
    layouts/default.vue       # sidebar nav, header (theme + lang + ?)
```
