# Changelog

All notable changes to `@noy-db/ui-nuxt` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning will follow the noy-db line on release.

## [0.3.0-pre.4] — 2026-08-09

### Changed
- Dev pin moved to `@noy-db/hub` `0.6.0-pre.4`; the peer range `^0.6.0-pre.0` is unchanged.

### Note
- The `autocomplete` control added to `@noy-db/ui` in this release is rendered by `ui-suai`'s
  `FieldControl`. This fork carries no form layer yet — `RecordForm`/`FieldControl` were not part
  of the v1 slice (#9) — so nothing here consumes it until that layer is ported.

## [0.3.0-pre.3] — 2026-08-02

**BREAKING** — the package is rebuilt as the **plain fork on Nuxt UI**, the regressed tier of the
three-fork model (shared `@noy-db/ui` engine; forks differ only in visual tier). Components now
compose `@nuxt/ui` v4 primitives (UTable/UInput/UCard-level) with standard Nuxt UI theming and no
CSS of their own — the pre-compiled UnoCSS pipeline, `--nui` token injection, and the `style.css`
export are gone.

### Removed (BREAKING)
- The previous flagship component set (~20 components: `RecordForm`, `RecordDetail` (flagship),
  `RecordHistory`, `AttachmentGallery`, `RelatedList`, `TraverseBar`, `ItemPath`, `ColumnChooser`,
  `GroupByControl`, `SavedSearchMenu`, `RecentSearchMenu`, `NlSearchButton`, `SearchModeGroup`,
  `NuiText`, …) and the `style.css` / `--nui` theming surface. That entire surface — including the
  improvements that had accumulated unreleased here since 0.3.0-pre.2 (the `AttachmentGallery`
  metadata-row redesign with EXIF, `RecordDetail` in-place edit mode + `FieldControl`,
  `TraverseBar`/`ItemPath` found-set traversal, `CollectionList` bulk selection and `anchorKey`,
  `RecordHistory` timestamps) — now lives in **`@noy-db/ui-suai`**, the flagship fork debuting at
  this version with an identical module surface and the same `noydbUi` configKey. Switching forks
  means swapping the package name only; see `@noy-db/ui-suai`'s 0.3.0-pre.3 entry for the detailed
  notes on those improvements.

### Added
- The plain component set on Nuxt UI semantics: `CollectionList` (UTable + the engine's AppColumns,
  local sort), `SearchBox` (UInput bound to the DSL query string), `EmptyState` / `LoadingSkeleton` /
  `StatCard`, plus the full `core/` layer (unchanged engine re-export).
- **`RecordDetail` (plain)** — a label/value grid on the engine's `detailFields`/`formatDetailCell`;
  entity refs emit for host routing, i18n fields show every locale.
- The module now installs `@nuxt/ui` (deduped when the host lists it first); `useTheme` keeps the
  same API but drives Nuxt UI's `.dark` class convention.
- `playground/` — a standalone dev harness (own pnpm workspace, module loaded from source).
- `docs/ui-nuxt/7.suai-bridge.md` — the SUAI bridge map: Nuxt UI v4 theme vars → `--su-*` token
  derivations; dark mode flows through the `.dark` class with no dark block in the bridge.

### Fixed
- `CollectionList` `@select` argument order — UTable emits `(Event, TableRow)` (event first), so row
  ids now reach row-click handlers.

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
