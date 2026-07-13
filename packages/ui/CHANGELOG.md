# Changelog

All notable changes to `@noy-db/ui` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning will follow the noy-db line on release.

## [Unreleased]

In-place editing: hints, i18n/unit inputs, and the edit-state composable. Also: found-set
traversal — frozen query-derivable snapshots, path-shaped titles, and the skim controller.
And: the hub's native via-lookup surface (≥0.3.0-pre.9) flows into the schema and read paths.

### Added
- **`parseExif(bytes)`** (`exif.ts`) — a dependency-free EXIF reader for **JPEG, PNG, and HEIC/HEIF**
  attachments: pulls orientation, camera make/model, lens, capture time, exposure / f-number / ISO /
  focal length, and GPS (as signed decimal degrees) from the file's TIFF block, wherever the container
  keeps it — JPEG APP1, PNG `eXIf` chunk, or a HEIC ISOBMFF `Exif` item (located via `meta`→`iinf`/
  `iloc`). Offline by design — the metadata lives inside the decrypted bytes (a zero-knowledge vault
  has no server-side metadata bag), and any malformed read yields `null` rather than throwing.
- **`fileCategory(mime, filename)`** (`attachments.ts`) — classify an attachment by MIME (preferred)
  then extension into a display `{ category, label, icon }` across ~20 common kinds (image, pdf,
  document, spreadsheet, presentation, archive, audio, video, code, json, markup, text, font, ebook,
  calendar, contact, disk, database, certificate, application, + a generic fallback), so a non-image
  reads as what it is with a friendly label and a distinct lucide icon rather than a generic blob.
  Exports the `FileCategoryKind` union.
- **`crop.ts` — square-crop geometry** for a pan/zoom image cropper (cover upload): `coverScale`
  (base scale where an image just covers a frame), `clampOffset` (keep the frame covered while
  panning), `cropRect(view)` → `{ sx, sy, sw, sh }` (the source rectangle to feed
  `ctx.drawImage`, so the crop renders at any output size), and `displaySize`. Pure — the component
  owns pointer/canvas, this owns the math (11 tests).
- **`lists.ts` — the hide/patch list algebra** (traverse P-D). One `ListDef { name, entity, query,
  hide[], patch[] }` unifies a smart list (bookmarked query), a smart list with overrides, and a
  fixed playlist. `resolveListIds(def, evaluatedIds)` computes `(eval(query) − hide) ∪ patch` with
  stable order (query members keep their sorted position, patch-only ids append); `addToList`/
  `removeFromList` are **total** (`remove = id ∈ patch ? unpatch : hide`, `add = id ∈ hide ? unhide
  : patch`) and idempotent; `toggleInList`/`isInList` (need the live `inQuery`), `listKind`
  (fixed/smart/smart-overridden), plus `makeList`/`sortLists`/`listsForEntity`. Pure — the host owns
  persistence (localStorage today; vault-encrypted/syncable is the endgame).
- **Bulk set algebra** (traverse P-E) — `addAllToList` (∪), `removeAllFromList` (∖), and
  `intersectListWith` (∩, keeps only members also selected) fold a whole selection into a list
  through the same total single-id ops. Create-a-list-from-a-selection is `makeList({ patch: ids })`.
- **`attachmentList(slots)` + `humanSize`/`attachmentSlot`/`ATTACHMENT_PREFIX`** (`attachments.ts`,
  Item Release P5) — filter a `blob(id).list()` result to the `att:`-prefixed attachment slots (the
  cover + named slots stay out) and shape each into an `AttachmentItem` (`{ slot, filename, mime,
  size, humanSize, kind: 'image'|'file', uploadedAt? }`), sorted by upload time. `attachmentSlot(uuid)`
  mints a new slot name; `humanSize` renders binary units.
- **`relatedColumns(columns, keys)` + `summaryCards(agg, spec)`** (`related.ts`, Item Release P6) —
  the reverse-lookup surface: `relatedColumns` picks/orders a column subset for a compact embedded
  list (unknown keys skipped); `summaryCards` turns an `aggregate().run()` result into StatCard-ready
  `{ label, value, icon?, color? }[]`, rendering an empty-set `null` (e.g. `avg` over zero rows) as
  `—` unless the spec's `format` says otherwise.
- **`historyRows(snapshots, diffFn, fields, opts?)`** (`history-view.ts`) — the change-history
  "what / who / when" view model (Item Release P4). Turns newest-first version snapshots + a diff
  function into display rows `{ version, actor?, iso?, relative?, isCurrent, genesis, changes[] }`;
  each change resolves its field label (nested i18n paths → `Notes (TH)`), formats values through
  `describe()` metadata (enum labels, currency units) and keeps sensitive fields masked. The live
  version (no archived timestamp) is `isCurrent`; the oldest is `genesis` (renders as "created").
  Pure — the host injects the hub's per-record `diff`, so it unit-tests without a vault.
- **`describe().lookup` consumption** — `schemaFromDescribe` treats a native
  `lookup()`/`enum()`/`dict()` field as an enum even without a `dict` block, sourcing `enumOrder`
  from the lookup's declared key set; `fieldInput` derives fallback select options from
  `lookup.keys` when neither host options nor `dict.values` exist.
- **`formatDetailCell` read-mode label resolution** — new `opts.options` (`{ value, label }[]`,
  the same shape the form widgets take) resolves enum codes and entity ids to display labels;
  label precedence for dict/lookup fields is the hub-dressed `<key>Label` sibling (a `{ locale }`
  read resolved it at the call's locale) › host options › the dictionary's declared-locale label ›
  the raw code. A bare `ref` field **without** `displayFor` now emits a navigable `ref` (linked,
  named via options) instead of rendering its raw id as dead text.
- **`fieldHint(field)`** — derives a client-side *hint* (never validation) from `describe()`'s async
  constraints: a required mark plus a compact range/length/format text (`minimum`/`maximum`/`gt`/`lt`
  → `1900–2100` / `≥ 0`; `minLength`/`maxLength` → `≤ 300 chars`; `format` → `uri`). New `FieldHint`
  type.
- **`fieldInput` gains an `i18n-text` kind** — one text box per locale for `field.i18n` fields;
  `FieldInput` carries `locales` for it, and `unit` passes through for number inputs (display suffix
  like `USD`/`min`). Integer-typed fields (`field.type === 'integer'`) now map to the `number` kind.
- **`useRecordItem({ collection, id, readOptions? })`** — the edit-state machine behind an in-place
  editable record: `load`/`enterEdit`/`draft`/`dirty`/`errors`/`errorBanner`/`submitting`/`cancel`/
  `submit`. `submit()` calls `collection.put()`, decomposes a failure through `fieldErrors`, and
  reloads on success. Clones via a JSON round-trip (both Vue reactive proxies and the hub's sealed-view
  proxies aren't structured-cloneable).
- **`--nui-danger`** design token (light `#dc2626` / dark `#f87171`) — the 9th `--nui-*` variable, for
  error text/marks.
- **`FoundSetItem`/`FoundSetSnapshot`** (`traverse.ts`) — the found set as a frozen, query-derivable
  snapshot (spec D1/D2): serialized DSL + `narrate()` title + the captured row order/labels
  (`kind: 'query' | 'fixed'`); `positionOf`/`itemAt` locate a record within it for
  destination-labelled steppers.
- **`pathSegments`** (`path.ts`) — the detail title as a path (spec D7): the group-by trail when the
  found set was grouped, else the entity's natural ref-axis, terminating in the record's own title.
- **`captureFoundSet`/`useFoundSet`/`setReturnAnchor`/`consumeReturnAnchor`/`rememberDirection`/
  `recallDirection`** (`use-found-set.ts`) — a per-entity, per-tab found-set session store: a row
  click captures the current display order; the detail's "back" hands the list a return anchor
  (query + row) to restore to; direction memory survives the page remount a returning navigation
  causes.
- **`foundSetItems({ lines, rows }, opts?)`** (`found-set-items.ts`, traverse P-C) — the pure
  "display → frozen `FoundSetItem[]`" step: the grouped line list (carrying each row's group-by
  trail, outermost first) when present, else the flat rows. Shared by the list's capture-on-click
  AND a forked/cold tab's rebuild-from-`?q=`, so both tabs derive an identical order from the same
  query (spec §6 invariant 1 — a snapshot is fully derivable from its query string).
- **`useTraverse`** (`use-traverse.ts`) — the skim controller (spec D8): an instant cursor over the
  frozen snapshot, with a ~250ms generation-guarded settle before triggering the real record load
  (fast clicks skim titles; a paused click loads the record) — `go`/`goTo`/`first`/`last`,
  `skimming`, `lastDirection`.

### Changed
- **`fieldErrors(err)`** also maps noy-db's `MissingTranslationError` (duck-typed on `field` +
  `missing`) to its offending field, alongside `SchemaValidationError` issues — same
  `Record<fieldKey, message>` shape either way.
- `@noy-db/hub` peer floor → `^0.3.0-pre.9` (the via-port line: lookup/computed/classified
  describe() blocks are additive; the `dict` block consumed here is byte-stable). `@noy-db/to-memory`
  dev floor follows (it peer-pins hub per release).

### Fixed
- **`fieldHint` suppresses zod `.int()`'s implicit ±`MAX_SAFE_INTEGER` bounds** — a
  `z.number().int().min(1)` field now hints `≥ 1` instead of `1–9007199254740991`.

## [0.3.0-pre.2] — 2026-07-04

The item-family foundation: schema-driven card grouping + dual-language detail cells.

### Added
- **`groupFields(fields, t?)`** — turns `describe()`'s new `group`/`order` metadata into
  ordered card sections (`FieldGroup { id, title, fields }`): groups rank by their minimum
  member `order`, fields sort stably within a group, ungrouped fields land in a localizable
  default bucket (`nui.detail.details`); group titles localize via `nui.detail.group.<id>`.
- **`DetailCell.i18n`** — `formatDetailCell` explodes a raw i18n locale map (record read with
  `{ locale: 'raw' }`) into per-locale entries `{ locale, display, missing }`; `display` stays
  the first non-missing locale. Resolved-string reads are untouched; sensitivity masking wins.

### Changed
- `@noy-db/hub` peer floor → `^0.3.0-pre.2` (the release that ships `DescribedField.group/order`).

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
