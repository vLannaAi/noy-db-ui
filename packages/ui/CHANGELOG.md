# Changelog

All notable changes to `@noy-db/ui` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning will follow the noy-db line on release.

## [Unreleased]

Initial extraction from an internal pilot app — the framework-agnostic base of the noy-db UI family.

### Added
- **Search engine** — the query AST/DSL pipeline (tokenize → parse → resolve → evaluate →
  group/summary/pills), rolling-date tokens, suggestions, saved/recent/NL helpers.
- **Schema model** — `schemaFromDescribe` + cross-collection `joinedSchema`/`joinedRows` over a
  collection's `describe()` metadata.
- **Item resolvers** — `formatDetailCell`/`detailFields` (read) and `fieldInput`/`formFields` (edit),
  plus `fieldErrors()` to decompose a `SchemaValidationError` into per-field messages.
- **`useCollectionList`** — the reactive composable wiring the pipeline to query state.
- **Design tokens** — `@noy-db/ui/tokens.css` (`--nui-*` variables + dark mode).
