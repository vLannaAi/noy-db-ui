# Changelog

All notable changes to `@noy-db/ui-nuxt` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning will follow the noy-db line on release.

## [Unreleased]

`RecordDetail` gains in-place editing, sharing its widget renderer with `RecordForm`. Also: found-set
traversal — a sticky stepper bar and a path-shaped detail title.

### Added
- **`RecordHistory` shows the exact timestamp** — each row now renders the full `YYYY-MM-DD HH:MM`
  next to the relative time ("2 days ago · 2026-07-11 14:32") instead of hiding it in a tooltip; the
  author (`row.actor`) sits alongside.

### Changed
- **`AttachmentGallery` redesigned as a metadata row list + drop-zone** — attachments render as tidy
  rows (thumbnail / type-icon · name · `TYPE · dimensions · size` · upload time · delete-on-hover with
  an inline confirm) divided by hairlines, instead of nested cards with their own borders/shadows that
  didn't align. Each non-image gets a category icon + friendly label via `fileCategory` (@noy-db/ui);
  images show a thumbnail and their pixel dimensions (read client-side off the decoded image, since the
  blob metadata doesn't carry them); the upload time comes from the blob's `uploadedAt`. A just-added
  row briefly flashes to confirm the upload landed (attachments save immediately, no separate Save).
  Each row expands to a metadata detail (type · exact size · dimensions · uploaded-when/by), and for
  photos a full **EXIF** block via `parseExif` (@noy-db/ui) — camera, lens, capture time, exposure /
  f-number / ISO / focal length, orientation, and GPS with an OpenStreetMap link.
  The whole panel accepts dragged files (drop overlay); a slim dashed "Add files" bar sits below the
  list, and the empty state is a "drop files here, or click to browse" target. The file input is now
  visually-hidden rather than `display:none` (a `display:none` input's programmatic `.click()` is
  blocked in some browsers, so "Add" opened nothing), and it takes `multiple` (one `upload` per file).
- **`RecordDetail` cards scale to the container width** — the card grid now grows to 3 and then 4
  columns on wider surfaces (≥1160 / ≥1700px) instead of capping at 2, so a wide detail view fills
  the width with more cards per row rather than stretching each one; each card's inner field grid
  drops to one column when the card itself gets narrow.
- **`RecordDetail` gains a `controls` prop** (default `true`) — set `false` to suppress the built-in
  edit/save/cancel action row so the host can own those controls (e.g. an edit icon in a masthead plus
  a sticky save/cancel bar). The cells still morph into inputs on `editing`; only the action row is
  withheld.
- **`FieldControl`** (internal) — the single widget renderer for a `FieldInput`
  (text/textarea/number+unit/date/select/checkbox/i18n-text), with error and constraint-hint lines
  underneath. Shared by `RecordForm` and `RecordDetail`'s edit mode so both surfaces stay
  pixel-consistent.
- **`RecordDetail` in-place edit mode** — new `editing`/`draft`/`errors`/`options`/`submitting`/
  `errorBanner` props and `save`/`cancel` emits (pair with `useRecordItem` from `@noy-db/ui`).
  Editable cells morph into their `FieldControl` widget in the same grid cell; required fields get a
  `*` mark, constraints render as a hint line, and non-editable fields show a lock affordance
  (`i-lucide-lock`, `nui.detail.readonly` string).
- **`TraverseBar`** — sticky found-set stepper above a detail view: the narrated-search breadcrumb
  doubles as "back to list"; a fixed vertical cluster (⤒ first, ▲ prev, N/M, ▼ next, ⤓ last) with
  destination-named tooltips/labels and a tabular-nums reserved width so it never reflows; `j`/`k`
  and `⌥↑`/`⌥↓` step; a popover scrubber (internal `TraverseScrubber`) offers a typed jump and a
  grouped mini-list; goes inert while `editing`.
- **`ItemPath`** — a detail's path-shaped title: the group-by trail when the found set was grouped,
  else the entity's natural ref-axis, terminating in the record's title; collapses to
  first › … › terminal below 448px; group segments emit `back`, entity segments emit `navigate`.
- **`CollectionList` gains `anchorKey`** — scrolls a row into view and flash-highlights it once,
  e.g. when a detail's `back()` restores the list to where you left it.
- **`CollectionList` gains bulk selection** (traverse P-E) — an opt-in `selectable` prop adds a
  leading checkbox column with a header select-all (indeterminate on a partial selection); the host
  owns the set via `selectedKeys` and the `toggleSelect`/`toggleSelectAll` events. Default off, so
  every existing usage is byte-identical. Pairs with `@noy-db/ui`'s set-algebra (`addAllToList` /
  `removeAllFromList` / create-from-selection) to fold a selection into a named list.
- **`RecordHistory`** — the change-history timeline (Item Release P4): a collapsed panel at the
  detail's foot, newest version first, each row an actor + relative time with an expandable
  field-change list (`from → to`, masking-aware, nested i18n paths labelled `Notes (TH)`). Rows come
  from `@noy-db/ui`'s `historyRows()`; the panel is **lazy** — it emits `expand` once on first open
  so the host fetches `collection.history(id)` only then, and re-fetches after an edit. Current
  version renders as "Current", the oldest as "Created".
- **`AttachmentGallery`** — the attachments gallery (Item Release P5): a grid of image thumbnails +
  file tiles for a record's `att:` blob slots, an upload button and per-item delete with inline
  confirm. Items come from `attachmentList()`; the component owns the image objectURL lifecycle
  (built from host-supplied bytes via `loadBytes`, revoked on unmount and when an item disappears).
  Emits `upload`/`remove` — vault I/O (`blob.put`/`blob.delete`) stays host-side.
- **`RelatedList`** — a reverse-lookup list with a derived summary (Item Release P6): a StatCard
  summary strip (from `summaryCards()`) over a compact `CollectionList` (column subset via
  `relatedColumns()`) of another collection's rows that reference this record. Cell slots forward
  through to the inner list so enum/entity cells localize as on the full list; emits `rowClick`. The
  host supplies the rows and summary from `query().where(...).toArray()` + the same query's
  `aggregate().run()`.

### Changed
- **`RecordForm`** delegates its per-field controls to the internal `FieldControl` renderer instead of
  inlining them.
- `@noy-db/hub` peer floor → `^0.3.0-pre.9` (additive describe() surface; no component changes
  needed).
- **`RecordDetail` read mode resolves display labels through `options`** — the prop that already
  fed edit-mode selects now also names read-mode cells: enum codes render their localized label and
  bare entity refs (no `displayFor` pairing) render as links named by their option entry, following
  `formatDetailCell`'s new precedence (`<field>Label` sibling › options › declared-locale dict
  label › raw code).

## [0.3.0-pre.2] — 2026-07-04

The item-family foundation: RecordDetail joins the list's responsive system.

### Added
- **`useContainerSize(host)`** (auto-imported from `core/`) — container-measured
  (ResizeObserver) width + `'sm' | 'md' | 'lg'` density tier on the list's 448/640
  thresholds; widest-first before measurement.

### Changed
- **`RecordDetail`** — cards now derive from `describe()`'s `group`/`order` metadata via
  `groupFields` (the `groups` prop remains as a host override); the grid is
  container-measured instead of viewport-`sm:` (1-column cells `<448px`, two card columns
  `≥992px`); values render through `NuiText`; i18n fields read with `{ locale: 'raw' }`
  render one badged row per language (missing locale dimmed); card padding follows the
  density tier via `--nui-card-px` (host-overridable).
- `@noy-db/hub` peer floor → `^0.3.0-pre.2`.

### Fixed
- `possibly undefined` type errors in `CollectionList` (`bannerLeadCols`) and `SearchBox`
  (`smartQuote`) that surfaced when a consuming app type-checks the shipped `.vue` runtime
  under a strict tsconfig (`noUncheckedIndexedAccess`). Both accesses are guaranteed by
  surrounding logic; asserted non-null. No behavior change.

## [0.3.0-pre.1] — 2026-07-03

Version alignment with `@noy-db/hub` 0.3.0-pre.1 — the package now tracks the noy-db version
line. No functional changes over 0.2.0-pre.1.

## [0.2.0-pre.1] — 2026-07-03

The fluent-search release: the search box becomes the view's editable title, with three input
voices and full localizability.

### Added
- **Search-as-title** — at rest the `SearchBox` renders the fluent narrate title (with the full
  sentence as tooltip); focusing swaps to the two-tone pill editor continuing the title.
- **Pill editing** — click edits a pill as a labelled token with the value pre-selected; every
  pill has a × and a popup Remove row; Esc restores the original (cancel is never a delete);
  drag ≥6px reorders within its own segment with an insertion marker.
- **Keyboard roving** — arrows/Home/End roam the pill row, Enter/Space edits, Delete removes
  (focus stays in the row), Alt+arrows reorder, `/` focuses the field from anywhere.
- **Three-voice mode group** — exact ⌕ / ask ✨ (sticky AI, refine automatic) / speak 🎤
  (push-to-record via pointer capture; release finalizes into the ask pipeline). Morphing reset
  (✕ discard draft / abort flight → 🗑 erase search), Esc ladder, floating key card + status notes.
- **`GroupByControl`**, saved/recent search menus with narrate-based fluent rows, and a print
  contract (report header = narrate title + sentence).
- **`NUI_LOCALE_TH`** (`@noy-db/ui-nuxt/core`) — Thai catalog for the whole family: the engine's
  `LOCALE_TH` merged with this binding's component chrome. Hosts spread it into their translator
  and override freely; domain words (entity nouns, field labels, enum values) stay host-side.
- Suggestion hint chips render through `t('nui.hint.<hint>')`.

### Changed
- Components pass the host `t` into `astToPills`/`buildSuggestions`, so pill heads and suggestion
  labels follow the active locale. The host's `t` bridge receives the FULL `nui.*` key — never
  re-prefix it.

## [0.2.0-pre.0] — 2026-06-26

Initial extraction from an internal pilot app — the Nuxt binding for `@noy-db/ui`.

### Added
- **Nuxt module** (`@noy-db/ui-nuxt/module`) — auto-registers components, auto-imports the `core/`
  composables, injects the pre-compiled CSS, and wires theme + locale (`noydbUi` config key).
- **List family** — `CollectionList`, `SearchBox`, `SavedSearchMenu`, `RecentSearchMenu`,
  `NlSearchButton`, `ColumnChooser`, `GroupByControl`.
- **Item family** — `RecordDetail` (schema-driven read) + `RecordForm` (schema-driven edit, per-field
  errors).
- **Insight family** — `EmptyState`, `LoadingSkeleton`, `StatCard`.
- **`core/` config layer** — `provideNoydbUi` + `useTheme`/`useNuiI18n`/`useLlm`/`useVoiceInput`/
  `useViewport`. AI (BYO LLM) and voice (Web Speech, swappable) are pluggable.
- **i18n** — every built-in string routes through `useNuiI18n()` under the `nui.*` key namespace,
  with English fallbacks.
- Pre-compiled CSS shipped at `@noy-db/ui-nuxt/style.css` (namespaced `nui-*`, no host-engine conflict).
