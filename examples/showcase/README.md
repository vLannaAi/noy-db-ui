# noy-db · Vinyl Showcase

A static, browser-only Nuxt SPA that demonstrates `@noy-db/ui` and `@noy-db/ui-nuxt` against a
real noy-db vault — a vinyl record collection with album, artist, and label collections, joins,
Thai/English localization, encrypted cover-art blobs, and a guided balloon tour.

`ssr: false` — no server. Everything runs in the browser: vault decryption, schema-driven list/
search/detail, cover blob round-trips, i18n switch, theme toggle.

## Demo passphrase

```
spin-the-black-circle
```

## Prerequisites

This app depends on the **local sibling `noy-db`** being built and on this repo's **UI packages**
being built. It is a local/demo artifact — it is not installable from a clean clone and is not
built in this repo's CI.

### 1. Build the sibling `noy-db`

```bash
cd ../../../noy-db
pnpm install
pnpm build
```

### 2. Build this repo's UI packages

From the repo root (`noy-db-ui/`):

```bash
cd ../../
pnpm install
pnpm build
```

This produces `@noy-db/ui` and `@noy-db/ui-nuxt` dist artifacts that the showcase links to via
`file:` paths.

### 3. Install and seed

```bash
cd examples/showcase
pnpm install
pnpm seed
```

`pnpm seed` runs `scripts/seed.ts`, which regenerates `public/demo.noydb` and `public/covers/`
(24 PNG cover images). These are gitignored — you must seed locally before running.

## Running

### Dev server

```bash
pnpm dev
```

Opens at `http://localhost:3000`.

### Static build

```bash
pnpm generate
```

Produces `.output/public/` — a fully self-contained static SPA. Serve it with any static file
server:

```bash
npx serve .output/public
```

## Notes

- **`demo.noydb` is non-deterministic** across re-seeds (the vault re-encrypts with a fresh key
  each time). After re-seeding, `git status` will show `public/demo.noydb` as modified — that
  is expected and those changes should not be committed (the file is gitignored).

- **A cosmetic console warning is expected** on first load:
  `[noy-db] Loaded a legacy backup with no ledgerHead` — this is benign and does not affect
  functionality.

- The app depends on the local sibling `noy-db` being built (via the `file:` links in
  `package.json`). It cannot be installed from npm or built in this repo's CI.

## What it demonstrates

| Feature | Where |
|---|---|
| Passphrase unlock + wrong-pass error | `/` (unlock screen) |
| Schema-driven list + search | `/records`, `/artists`, `/labels` |
| Joins surfaced in list columns | `/records` (artist + label join) |
| Record detail with ref links | `/records/[id]` |
| Cover art — live blob decrypt in-browser | `/records/[id]` (cover panel + caption) |
| Thai/English across chrome + enum values + field headers | lang switcher in header |
| Light/dark/system theme toggle | theme toggle in header |
| Guided balloon tour (per-page, localized, Prev/Next/Skip) | `?` button in header |
