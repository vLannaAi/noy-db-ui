# The Item Release — Design Spec (@noy-db/ui 0.4.0 line)

**Date:** 2026-07-03
**Status:** approved design, pre-implementation
**Scope:** `@noy-db/ui`, `@noy-db/ui-nuxt`, `examples/showcase`, plus two small upstream
`@noy-db/hub` asks (coordinated release)

## 0. Goal

From a schema-driven **list** engine to a schema-driven **item** family — read, edit,
history, attachments, and relations, all driven by `collection.describe()`, on the same
responsive/token foundation as the list. The showcase exercises every pillar bilingually
(EN/TH), in both themes.

Architecture approach (chosen over a monolithic detail engine and over showcase-first
extraction): mirror the list's proven three-tier shape symmetrically —

- **Engine** (pure, tested, framework-free, in `packages/ui/src`): `groups.ts`,
  `history-view.ts`, `attachments.ts`, `related.ts` joining the existing `detail.ts` /
  `form.ts`.
- **Composable** (one stateful orchestrator, mirroring `useCollectionList`):
  `useRecordItem`.
- **Top-shelf components** (`packages/ui-nuxt/runtime/components/item/`): `RecordDetail`
  (upgraded), `RecordForm` (kept for create), new `RecordHistory`, `AttachmentGallery`,
  `RelatedList`.

Every unit independently testable; hosts adopt features piecemeal (tree-shakeable-seam
philosophy).

## 1. Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | Card groups + field order come from **upstream** `describe()` (`FieldMeta.group`, `FieldMeta.order`) | Schema-driven end-to-end; single source of truth; zero host config. User-confirmed. |
| D2 | Edit mode = **in-place morph**: same cards, value cells swap to input widgets | The "form matches/overlaps the detail" reading; best validation UX (error under the exact cell). Default taken; overridable at review. |
| D3 | Showcase writes are **session-only** (in-memory vault; reload → re-unlock → seed bundle) | Demo semantics; persistence across reload is backlog. |
| D4 | Attachments gallery lives on **Records** detail; the join pillar + new i18n `notes` field live on **Labels** | Distributes pillars across collections; records already have blob precedent (covers). |
| D5 | `RecordForm` survives as the standalone **create** form | A new record has nothing to morph; detail+form share the group engine so layouts match. |
| D6 | Revert-to-version is **out of scope** | Destructive; needs its own confirmation/permission design. Backlog. |
| D7 | P6 uses the **hub-side** join (`query().where()` + `aggregate()`), while lists keep the engine-side `joinedRows` | The release then demonstrates both join mechanisms of the family. |
| D8 | UI 0.4.0-pre.x tracks hub 0.4.0-pre.x | Honors the "versioning follows the noy-db line" changelog promise. |

## 2. Upstream noy-db asks (hub 0.4.0-pre.0)

1. **`FieldMeta.group?: string` + `FieldMeta.order?: number`**, flowing through
   `describe()` on each `DescribedField`. Merge rule unchanged (channel `fieldMeta` >
   zod `.meta()` > inferred). Fields remain alphabetically sorted in the emitted array;
   grouping/ordering are *metadata*, applied by consumers.
2. **`_history` joins the bundle internals** in `with-pod/backup.ts` (today `_ledger`,
   `_ledger_deltas`, `_blob_*` travel but full-snapshot history does not), so
   `collection.history()` / `getVersion()` / `diff()` work across the `.noydb` bundle
   boundary. Fallback if declined: UI reconstructs pre-bundle versions from ledger
   reverse-deltas (`LedgerStore.reconstruct`); the panel then labels pre-bundle entries
   "reconstructed".

Both are small; adoption follows the established pattern (publish hub pre-release →
bump peer floor here).

## 3. Pillars

### P1 — List parity on all collections

Artists and Labels list pages get the full Records toolbar: `SavedSearchMenu`,
`RecentSearchMenu`, `ColumnChooser`, print header (§8b), serial column. Library work:
none (the engine is already generic). Showcase work: wire the missing pieces in
`artists/index.vue`, `labels/index.vue`. Acceptance: one interaction checklist passes
identically on all three list pages.

### P2 — Detail page: card groups + dual-language fields

- **Engine `groups.ts`:** `groupFields(fields: DescribedField[], t?): FieldGroup[]` —
  `FieldGroup { id, title, fields }`. Fields with no `group` land in a default bucket
  (localizable title, `nui.detail.details`). Groups ordered by the minimum `order` of
  their members; fields within a group by `order`, ties alphabetical. `RecordDetail`'s
  existing `groups` prop remains as a host override but is no longer required.
- **Dual-language cells:** detail reads the record with `{ locale: 'raw' }`. A cell whose
  `DescribedField.i18n` is set renders stacked per-locale values with small language
  badges (`en` / `th`), ordered by `i18n.locales`. Missing locale renders the empty dash
  with the badge dimmed.
- **Showcase:** Labels gain `notes: i18nText({ languages: ['en','th'], required: 'any' })`
  seeded bilingually.

### P3 — In-place edit + validation

- **`RecordDetail` gains `editing: boolean`.** In edit mode each `editable` field renders
  its `fieldInput` widget in the same grid cell; non-editable (computed, id) stay as
  read cells with a muted lock affordance.
- **Composable `useRecordItem({ collection, id })`:** owns `mode: 'read' | 'edit'`,
  `draft` (deep-cloned on entering edit), `dirty` (per-field + aggregate), `errors`,
  `submitting`, `submit()` (→ `collection.put()` → catch → `fieldErrors`), `reset()`.
  Read path re-fetches after successful submit.
- **Validation:** noy-db is the validator of record — `put()` throws
  `SchemaValidationError` whose `issues` decompose via `fieldErrors` to per-field
  messages. Client-side *hints* only (required marks, min/max/pattern surfaced from the
  async `describe({})` constraints) — no duplicate client validation logic.
- **Gap to close in `form.ts`:** `fieldErrors` must also map `MissingTranslationError`
  (i18n `required` violations) to the offending field key.
- **Widget coverage:** text, textarea, number, date, select (dict), checkbox, money
  (amount + unit), ref-select (entity picker fed by the target collection's rows),
  i18n-text (one input per locale, stacked like the read cell).
- **Showcase:** records get a real zod schema with constraints (required title, year
  min/max, rating 0–5, price ≥ 0, url pattern for one field) so failure paths are
  demonstrable.

### P4 — Change history panel

- **Engine `history-view.ts`:** `historyRows(entries, diffFn, schema, t?)` → display rows
  `{ version, when (ISO + relative), actor, changes: [{ fieldLabel, path, type:
  'added'|'removed'|'changed', from, to }] }`. Built from `collection.history(id)`
  (newest-first) + `diff(id, vN-1, vN)` per adjacent pair; genesis version renders as
  "created". Field paths resolve to labels via the schema; nested i18n paths
  (`notes.th`) render as "Notes (TH)". Values format through `formatDetailCell` rules
  (masking respected — a `secret` field's from/to stay masked).
- **Component `RecordHistory.vue`:** collapsed timeline at the bottom of the detail page,
  newest first, per-entry expandable change list, relative time via existing
  `relativeTime`. Lazy: history is fetched when the panel first expands.
- Revert: out of scope (D6).

### P5 — Attachments gallery (Records detail)

- **Engine `attachments.ts`:** `attachmentList(slots: SlotInfo[]): AttachmentItem[]` —
  filters to the `att:` slot-name prefix (convention: `att:<uuid>`; keeps the cover slot
  and future named slots out of the gallery), derives `{ name, filename, humanSize, mime,
  kind: 'image'|'file' }`.
- **Component `AttachmentGallery.vue`:** grid of image thumbs (via `blob(id).objectURL`,
  revoked on unmount) and icon tiles for non-images; upload button (file input →
  `blob(id).put('att:'+uuid, bytes, { filename, mimeType })` — mime may be omitted, the
  hub autodetects); per-item delete with inline confirm; caption filename · size ·
  uploadedAt.
- Persistence: session-only (D3). If the bundle round-trip test (T5 below) proves
  `_blob_*` now travel, migrating showcase covers from static assets to real blobs
  becomes a stretch goal of this release, not a commitment.

### P6 — Related list with derived summary (Label detail)

- **Showcase declares real refs:** `records` collection options gain
  `refs: { artistId: ref('artists'), labelId: ref('labels') }` → `describe()` reports
  `ref` + `widget: 'ref-select'` (which P3's entity picker consumes).
- **Engine `related.ts`:** small helpers shaping the reverse-lookup result and summary
  spec (`relatedColumns(schema, subset)`, `summarySpec` → aggregate spec).
- **Component `RelatedList.vue`:** on `/labels/[id]`, a card titled by the target
  collection's plural label listing that label's records via
  `records.query().where('labelId','==',id).toArray({ locale })`, rendered as a compact
  `CollectionList` (column subset, row links to `/records/[id]`), headed by a summary
  strip (existing `StatCard`) fed by
  `query().where(...).aggregate({ count, moneySum(price), avg(rating) })`.

## 4. Layout foundation (inherited from the list)

- **Container-measured breakpoints, same constants.** Detail adopts the list's
  ResizeObserver philosophy (replacing the current viewport-`sm:` classes in
  `RecordDetail`). Reuse the exported ladder: `<448px` one column, cards stack,
  label-over-value; `448–992` two-column `<dl>` grid inside cards; `≥992` two card
  columns + side rail (summary / attachments / history anchors). Measurement extracted
  into a shared `useContainerSize` in ui-nuxt `core/` (also adoptable by
  `CollectionList` later — not refactored in this release).
- **Density.** The list's `densityFor` tiers (sm <448 / md <640 / lg) set
  `data-nui-size`, which now also drives `--nui-card-px/py` padding vars for cards.
- **Type.** Values render through `NuiText` so long money/date/text get the
  adaptive-text ladder instead of overflow.
- **Interactive states (list conventions carried over):** hover = subtle `color-mix`
  tint; focus-visible ring in `--nui-accent`; editing card = accent ring, per-field dirty
  dot; computed/readonly = muted + lock; sensitivity-masked cells keep the reveal
  toggle; submit = spinner + disabled form; error = red ring + message under the exact
  cell.
- **Style.** `nui-panel` cards, the 8-token `--nui-*` palette only, dark parity
  mandatory, popovers via internal `Popover`.
- **Print.** Spec v2 §8b extends to detail: a "record report" — narrated title, cards
  flow as ink-friendly sections, history table appended, gallery as a filename list.
  (Documented as §8c in the v2 spec when implemented.)

## 5. noy-db test surface (what this release must prove)

| # | Pillar | Hub API exercised | Tests |
|---|---|---|---|
| T1 | P2 groups | `describe()` + `fieldMeta` channel merge | noy-db: `group`/`order` survive channel > zod-meta > inferred merge. ui: `groupFields` ordering, default bucket, localized titles. |
| T2 | P2 i18n | `get(id, { locale: 'raw' })`, `i18n.locales` | showcase: raw map renders both locales; fallback chain; `MissingTranslationError` on partial write with `required:'all'`. |
| T3 | P3 validation | `put()` → `SchemaValidationError.issues`; async `describe({})` constraints | ui: `fieldErrors` maps issues **and** `MissingTranslationError`; showcase: constraint schema on records; ref-select rejects dangling id (`strict`). |
| T4 | P4 history | `history(id)`, `diff(id,a,b)`, ledger actor/ts | **Bundle round-trip: does `history()` see pre-bundle versions?** (drives upstream ask 2). Edit → v(n+1) with actor+ts; diff of i18n map shows nested paths; tombstone skip. |
| T5 | P5 blobs | `blob(id)` put/list/delete/objectURL, mime autodetect | **Bundle round-trip of `_blob_*`** (the seed's "blobs don't survive the bundle" comment predates per-blob CEK — verify). Upload→list→render→delete cycle; size/mime metadata; objectURL revocation. |
| T6 | P6 joins | `ref()`, `query().where().toArray()`, `aggregate()` reducers | Refs declared → `describe().ref` present; reverse-lookup correctness vs seed data; aggregate numbers match the list engine's `columnAggregate` for the same rows (cross-engine consistency). |

## 6. Testing strategy

- **Engine modules:** pure vitest (as `detail.test.ts` today) — one test file per new
  module.
- **Composable:** vitest against an in-memory vault (`createNoydb` + `memory()` +
  the three strategies), covering the edit state machine and error mapping.
- **Components / integration:** showcase-level. Definition-of-done is a Playwright pass
  over the showcase covering each pillar's happy path plus one failure path (validation
  error, wrong-locale read, dangling ref) — in EN and TH, both themes, at the three
  density widths (<448, 448–640, >640).

## 7. Phasing (each phase independently shippable)

1. Upstream hub pre-release (`group`/`order` + `_history` in bundle) → adopt here (peer
   floor bump).
2. Layout foundation (`useContainerSize`, density vars, NuiText in detail) + P2
   groups/i18n.
3. P3 in-place edit + validation.
4. P4 history panel.
5. P5 attachments + P6 related list.
6. P1 list parity + print-for-detail (§8c) + release 0.4.0-pre.0.

## 8. Out of scope / backlog

- Revert-to-version from the history panel (D6).
- Write persistence across reload (bundle re-export or `to-browser-idb`) (D3).
- Covers-as-blobs migration (stretch goal contingent on T5).
- Blob published-versions UI (`publish`/`listVersions`).
- Cross-vault refs; materialized-view surfaces.
- Refactoring `CollectionList` onto `useContainerSize` (foundation is built for it, not
  applied to it).
