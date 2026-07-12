# Report — how the native via-lookup interface improves and enhances the UI family

**Date:** 2026-07-12 · **Hub:** `@noy-db/hub` 0.3.0-pre.9 (`@next`) · **Scope:** `@noy-db/ui`,
`@noy-db/ui-nuxt`, `examples/showcase`

The showcase and the UI packages now speak the hub's **native via-lookup surface**
(`lookup()` / `enum()` / `dict()` + the `lookupFields` collection option) — the
`staticDict`/`dictKey` aliases are gone from this repo (they remain supported upstream, byte-parity
pinned). This report records what the new interface gives the UI, what we adopted now, and what it
unlocks next. Every claim below was verified live in the showcase or in `packages/ui` tests.

## 1. What changed in the data contract

The old pattern (`dictKeyFields` + `staticDict`) was a *label-resolution convenience*: the UI could
learn a field was enum-ish (`dict` block) but membership, ordering, and display were app problems.
The native binding turns each of those into a **declared, enforced, describe()-visible contract**:

| Capability | Alias era | Native `lookup()` era |
|---|---|---|
| Membership | app-side hope (or `staticDict`'s own validateCodes) | `vocabulary: 'closed'` — the vault refuses an unknown key at `put()` (`UnknownLookupKeyError`) |
| Display labels | app dictionary only; `dict.values` label-less for staticDict | `{ locale }` reads dress `<field>Label` per call; `displayLocale` labels `dict.values` for locale-less consumers |
| Sort by label | client-side only | `orderBy(field, dir, { by: 'label' })` at the query's own locale, or declared `sortBy` + `displayLocale` |
| Referential integrity | none (a dimension row could vanish under its references) | `onDelete: 'restrict' | 'cascade' | 'nullify'`, enforced, surfaced in describe() |
| Key normalization | none | `altKeys` — ISO3/call-prefix style candidates normalize to the canonical key on write |
| Machine-readable contract | `dict { name, static, values }` | + normalized `lookup { dimension, backing, vocabulary, key, altKeys, present, sortBy, onDelete, keys }` |

## 2. How each capability lands in the UI

### 2.1 The UI can finally *trust* enum data (closed vocabulary)
Every enum pipeline in the UI — facet counts, subtotal breakdowns, badge rendering, saved-search
pills — silently assumed enum values were well-formed. With `vocabulary: 'closed'` that assumption
is now a write-time guarantee made *inside the trust boundary*: no facet bucket for a typo'd key,
no pill that can never match, no "unknown code" branch needed in a cell renderer. The showcase's
three enum dimensions (genre/format/condition) are all closed now.

### 2.2 One label source, four consumers (describe-driven labels)
`GENRE_LABELS` in `dicts.ts` is now declared ONCE as the lookup `table` and consumed by:
1. **The vault** — `{ locale }` reads dress `genreLabel` on the record (EN 'Jazz', TH 'แจ๊ส');
   joins dress the referenced side the same way.
2. **describe()** — with `displayLocale`, `dict.values` carries `{ value: 'jazz', label: 'Jazz' }`,
   so schema-only consumers (print/export headers, label-less hosts) get a human string for free.
3. **The engine** — `schemaFromDescribe` reads the lookup block for enum typing + `enumOrder`
   (declared key order drives facet/pill ordering even when no dict block exists, e.g. `enum()`).
4. **The components** — `formatDetailCell` resolves read-mode display with a single precedence:
   hub-dressed `<field>Label` sibling › host `options` (active app locale) › declared-locale dict
   label › raw code.

Before, layers 1–2 didn't exist for static dictionaries and 3–4 fell through to the raw code — the
showcase detail literally rendered `jazz`, `ar2`, `lb1`. After: **Jazz / Blue Quartet (linked) /
Groove Hill (linked)**, and in Thai: **แจ๊ส / แผ่นใหญ่ (LP) / ดีมาก** — same cells, same describe()
metadata, zero extra page code.

### 2.3 Bare refs become navigation (options-named links)
A `ref` without a `displayFor` pairing (the normal shape when the referenced entity's name lives
in its own collection, like `records.artistId → artists`) used to render dead raw-id text.
`formatDetailCell` now always emits the navigable `ref` and names it from the host's `options` —
the same array the edit-mode select already required, so the host supplies the data **once** and
read, edit, and navigation all consume it. This is the transversal-navigation story the list's
joined columns already had, extended to the detail card.

### 2.4 Hints stop leaking implementation noise
Independent polish shipped in the same pass: `fieldHint` suppresses zod `.int()`'s implicit
±`MAX_SAFE_INTEGER` bounds — `Tracks` hints `≥ 1`, not `1–9007199254740991`.

### 2.5 Label-ordered sorting (available, not yet wired)
`orderBy(field, 'asc', { by: 'label' })` sorts by what the user *sees*, per call-locale — Thai and
English users get genuinely different, each-correct orders. The UI engine currently sorts
client-side over the full found set so nothing was wired, but this is the correct hub-side
primitive when a list moves to server/hub-side pagination — worth remembering for the smart-list
(P-D) work, where a bookmarked search must serialize its sort in a locale-stable way
(`{ by: 'label' }` semantics belong in the query DSL string, not the snapshot).

## 3. What this unlocks next (designed, not built)

- **Matrix tier for real reference collections.** `records.labelId → labels` is semantically a
  matrix-tier lookup (`lookup('labels', { key: 'id', present: { label: 'name', by: 'locale' } })`).
  Declaring it would give hub-side label dressing + `onDelete: 'restrict'` protection for the Item
  Release's pillar-6 "label detail join". Caveats before doing it: the matrix tier's cold-session
  hydration requirement (backing collection must be open/eager) and #651 (direct-read `present()`
  resolves by PUT-id, not `descriptor.key` — fine for `key: 'id'`, which is our shape).
- **Delete affordances that know the contract.** `describe().lookup.onDelete` tells the UI whether
  a dimension row is delete-protected (`restrict`), destructive (`cascade`), or nulling
  (`nullify`) — a future dimension-management surface can render the right warning *before* the
  user clicks, instead of catching `DictKeyInUseError` after.
- **altKeys as search synonyms.** A lookup field's `altKeys` are data-layer synonyms
  (`USA → US`); `schemaFromDescribe` could feed them into the engine's synonym table so a typed
  `country:USA` resolves without host configuration.
- **Fallback options everywhere.** `fieldInput` now derives select options from `lookup.keys`;
  a host with a closed enum gets a working (if unlocalized) select with zero configuration —
  the localized `options` prop remains the override, not the requirement.

## 4. Migration record (this repo)

- `examples/showcase/src/data/collections.ts` — `dictKeyFields`+`staticDict` →
  `lookupFields`+`lookup(backing:'static', table, vocabulary:'closed', displayLocale:'en',
  sortBy:'label')` (one `staticLookup()` helper for the three dimensions).
- `examples/showcase/src/data/__tests__/spike-i18n.test.ts` — `dictKey` → native `dict(name, { keys })`.
- `packages/ui/src/core.test.ts` — `dictKey` → native `dict()` + new `enumOf()` coverage.
- Stored envelopes are **byte-identical** across the migration (upstream alias-parity guarantee):
  the pre-migration `demo.noydb` pod loads unchanged under the native declaration; all 17 showcase
  tests and the full gate passed before reseeding.
- Pre-existing display gaps fixed in the same pass: labels-list `notes` rendered its raw i18n JSON
  map (`simpleView` now resolves every declared i18n field, with language fallback for partial
  translations like lb5's EN-only notes).

## 5. Verification

- `packages/ui`: 139 tests (5 new: label precedence, bare-ref links, lookup-keys options,
  enumOf-driven enumOrder, MAX_SAFE_INTEGER hint suppression).
- Showcase: 17 tests green; browser-verified on hub 0.3.0-pre.9 — EN + TH read-mode labels, linked
  artist/label cells, resolved notes column (incl. fallback), `≥ 1` tracks hint, traverse/edit
  flows unaffected; zero console errors.
