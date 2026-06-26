# Changelog

All notable changes to `@noy-db/ui-nuxt` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning will follow the noy-db line on release.

## [Unreleased]

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
