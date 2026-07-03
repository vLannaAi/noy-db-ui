# Changelog

All notable changes to `@noy-db/ui` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning will follow the noy-db line on release.

## [Unreleased]

## [0.3.0-pre.1] — 2026-07-03

Version alignment with `@noy-db/hub` 0.3.0-pre.1 — the package now tracks the noy-db version
line. No functional changes over 0.2.0-pre.1.

## [0.2.0-pre.1] — 2026-07-03

The fluent-search release: the query pipeline gains narration, presentation pills, and full
localizability.

### Added
- **`narrate(ast, schema, opts)`** — renders a resolved search as a compact title + full sentence
  (window/tab titles, report headers, saved/recent rows). Host-localizable via `t` (`nui.q.*`
  structural words, `nui.q.noun.<entity>`, per-entity empty titles `nui.q.all.<entity>`).
- **Two-tone pills** — `astToPills` splits each pill into a muted `head` and strong `value`;
  `movePill` reorders within its own segment (sort priority / group nesting). Accepts `t` for the
  structural words (not/and/or) and the Sort:/Group:/Show:/Hide: heads.
- **`boolean` FieldType** — checkbox-widget fields narrate/pill/suggest as the bare label
  ("Favorite" / "not Favorite"), never `true`/`false`.
- **Localized field labels** — `schemaFromDescribe` takes `labelFor(key, label)`; noy-db's
  `describe()` labels are single-language by design, so the host injects its locale dictionary
  here. The original label survives as an alias, so data-language queries still resolve.
- **`buildSuggestions` accepts `t`** — suggestion labels (Sort/Group by/Show/Hide/Search "…") and
  hint chips localize; boolean value suggestions; "as typed" pattern fallback for text fields.
- **`LOCALE_TH`** — shipped Thai catalog for every string the engine emits.
- `resolve` dedupes duplicate sort/group/show/hide keys and merges same-field eq/in predicates
  (OR semantics).

### Changed
- **`useCollectionList` accepts a schema getter** (`schema: () => EntitySchema`) so locale-reactive
  field labels flow into grouping, facets, and the group-by field list.

## [0.2.0-pre.0] — 2026-06-26

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
