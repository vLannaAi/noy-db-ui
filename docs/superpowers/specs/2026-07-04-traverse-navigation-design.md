# Traverse Navigation — the Found-Set Navigator (Design Spec)

**Date:** 2026-07-04
**Status:** approved design
**Scope (build now):** P-A core traverse + P-B path-title & skim — `@noy-db/ui`, `@noy-db/ui-nuxt`, `examples/showcase`
**Scope (designed, deferred):** P-C multi-tab forking · P-D lists algebra · P-E bulk selection

## 0. Goal

From a refined + sorted list (the **found set**), the user opens a record and traverses the
set from inside the detail: next/prev/first/last, position `N of M`, a scrubber that recalls
the search and jumps to any item, a path-shaped title that carries the grouping or entity
hierarchy, and rapid-fire "skim" clicking that outruns data loading. FileMaker's found-set
contract, translated to a modern schema-driven web UI.

## 1. Research grounding (survey of FileMaker, Lightroom, Gmail/Outlook/Superhuman, Linear/Jira/GitHub, photo viewers, NN/g/Baymard/HIG)

Five rules drive the design:

1. **The affordance inherits the origin view's axis.** Every list-origin product traverses
   vertically (Outlook ▲▼, Linear/Gmail j/k, FileMaker's own Ctrl+↑/↓ despite its horizontal
   book glyph). Horizontal ‹ › belongs to grids/filmstrips. Our origin is a vertical table →
   **vertical glyphs, no book metaphor**.
2. **Disambiguate direction by meaning, not geometry** — Gmail's "Newer/Older", Docusaurus's
   "Next: *Title*". We name each arrow's destination.
3. **j/k is reserved vertical vocabulary** (ADM-3A → vi → Elm → Gmail → Linear/Superhuman).
4. **Position + typed jump + found-vs-total fraction is the database idiom** (FileMaker's
   four-part cluster; old Jira's mini-navigator). noy-db is a database product — adopt it.
5. **The list must hold the user's place** (Baymard: 87% of sites restore scroll; FileMaker
   2025's headline feature is serialized found-set restore). Return-to-list restoration is
   half the feature.

History lesson: FileMaker users' deepest complaint was found-set state with no browser-style
back. Answer: traversal steps use `router.replace` — Back always returns to the **list**.

## 2. Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | **Frozen snapshot** (FileMaker semantics): the found set (ordered ids) is captured on row click; edits never reorder/remove mid-walk; deleted records are skipped at navigation time. Drift badges = backlog. | Stable traversal while batch-editing; user-confirmed default. |
| D2 | Traversal order = the list's exact filter+sort+group **display order** (grouped rows flattened in visual order). | Universal across every product surveyed. |
| D3 | Vertical glyphs (⤒ ▲ ▼ ⤓) + destination-title labels/tooltips. No wrap; ends disable. | Rules 1–3. First/last explicitly requested. |
| D4 | `router.replace` between records; browser Back = the list. | Kills FileMaker's back-button pain. |
| D5 | The traverse UI renders only when a snapshot exists for the entity (or, post-P-C, when `?q=` can rebuild one). Cold detail = no bar. | Graceful degradation. |
| D6 | In-memory per-tab snapshot store for speed **+ multi-tab compatibility invariants** (§6); URL seeding implementation deferred to P-C. | User direction: defer forking implementation/tests, stay compatible. |
| D7 | **Path-title**: grouped snapshot → group-trail segments; ungrouped → natural entity axis (ref fields, host-configurable order; showcase = `Label › Artist › Title`), terminal record title bold/accent, list-consistent typography. | User requirement; unifies title + breadcrumb + grouping. |
| D8 | **Skim controller**: every step moves a cursor instantly (title/path/position update from snapshot labels, zero data access); a ~250 ms settle debounce triggers the real fetch, generation-guarded last-wins. Slow clicks screen records; fast clicks skim titles. | User requirement ("async controller"). |
| D9 | **Fixed cluster**: right-anchored, `position: sticky` top, `tabular-nums` position display with width reserved for the max count — controls never move under the pointer. | Fitts's law rapid-fire requirement. |
| D10 | Traversal disabled while `editing` (dirty draft): bar dims, keys inert, tooltip explains. | Edit safety (phase-3 interplay). |
| D11 | `FoundSetSnapshot.kind: 'query' \| 'fixed'` discriminant ships now; all traverse machinery reads the evaluated snapshot regardless of kind. | P-D lands without rework. |
| D12 | Group-segment click returns to the list with the query restored and the record anchored (which lands inside that group). Dedicated banner-anchor = backlog. | Simplification with equal visual result. |
| D13 | Keyboard: `j`/`k` = next/prev, `⌥↓`/`⌥↑` alternates. Bare arrows stay with page scroll; Ctrl+↑/↓ collides with Mission Control (FileMaker's documented regret). Keys inert in inputs/textareas/selects and while editing. | Rule 3 + conflict avoidance. |

## 3. Architecture (family-standard three tiers)

### 3.1 Engine — `packages/ui/src/traverse.ts` (pure, vitest)

```ts
export interface FoundSetItem {
  id: string
  label: string                       // primary display text at capture time
  group?: readonly string[]           // group-by trail values, outermost first
}
export interface FoundSetSnapshot {
  kind: 'query' | 'fixed'             // 'fixed' reserved for the lists phase
  entity: string
  query: string                       // serialized DSL (filter+sort+group) — the fork seed
  title: string                       // narrate(ast).title at capture
  items: readonly FoundSetItem[]
  total: number                       // unfiltered collection size (found-vs-total fraction)
  capturedAt: string
}
export interface TraversePosition {
  index: number; count: number
  atFirst: boolean; atLast: boolean
  current: FoundSetItem; prev?: FoundSetItem; next?: FoundSetItem
}
positionOf(snap: FoundSetSnapshot, id: string): TraversePosition | null
itemAt(snap: FoundSetSnapshot, index: number): FoundSetItem | null   // clamped
```

### 3.2 Engine — `packages/ui/src/path.ts` (pure, vitest)

```ts
export interface PathSegment {
  label: string
  kind: 'group' | 'entity' | 'title'
  ref?: { collection: string; id: string }   // entity segments navigate to their detail
}
pathSegments(opts: {
  item: FoundSetItem | null                  // grouped mode source (item.group)
  record: Record<string, unknown> | null     // natural-axis mode source
  fields: readonly DescribedField[]
  naturalOrder?: readonly string[]           // ref field keys, path order (host config)
  labelFor?: (field: string, id: string) => string | undefined  // entity display names
  titleLabel: string                         // the record's display title
}): PathSegment[]
```
Grouped (item.group present): one `group` segment per trail value + `title` terminal.
Ungrouped: one `entity` segment per `naturalOrder` ref field (label via `labelFor`,
falling back to the raw id; `ref` from the field's describe `ref.target` + record value) +
`title` terminal.

### 3.3 Composable — `packages/ui/src/use-found-set.ts` (vue reactivity, vitest)

Module-level per-entity store (saved-searches pattern), **per-tab by construction**:

```ts
captureFoundSet(snap: FoundSetSnapshot): void                  // list row click
useFoundSet(entity: string): { snapshot: Ref<FoundSetSnapshot | null>; clear(): void }
setReturnAnchor(entity: string, anchor: { query: string; id: string }): void
consumeReturnAnchor(entity: string): { query: string; id: string } | null  // one-shot, list mount
```

### 3.4 Composable — `packages/ui/src/use-traverse.ts` (the skim controller, vitest with fake timers)

```ts
useTraverse(opts: {
  snapshot: () => FoundSetSnapshot | null
  currentId: () => string
  settleMs?: number                          // default 250
  onSettle: (id: string) => void             // host: router.replace to the record
}): {
  cursor: Ref<number>                        // instant position (skim)
  cursorItem: ComputedRef<FoundSetItem | null>
  position: ComputedRef<TraversePosition | null>   // derived from cursor
  skimming: Ref<boolean>                     // cursor ≠ settled id
  go(delta: number): void; goTo(index: number): void
  first(): void; last(): void
}
```
Rules: `go/goTo` clamp, update `cursor` synchronously, restart the settle timer; on settle,
if `itemAt(cursor).id ≠ currentId()` → `onSettle(id)` once (generation-guarded: a stale
settle never fires after a newer interaction). External `currentId` change (route landed)
re-syncs `cursor` and clears `skimming`.

### 3.5 Components — `packages/ui-nuxt`

- **`TraverseBar.vue`** (top-shelf): sticky bar. Left: `← {snapshot.title}` breadcrumb
  (NuiText, full narrated sentence as tooltip) → emits `back()`. Right: the fixed cluster —
  `⤒ ▲ {n}/{m} ⌄ ▼ ⤓`; prev/next tooltips (and, container ≥640, inline muted labels) name
  their destination items; position button opens the scrubber. Props:
  `snapshot, currentId, editing?, labelWide?`; emits `navigate(id)` (settled), `back`.
  Owns the `useTraverse` instance and the j/k window listener (D13). Disabled state per D10.
- **Scrubber** (internal, reuses `Popover`): header = narrated title + `M of {total}
  records`; a `go to #` typed-jump input (Enter → goTo(n−1)); the found set as a vertical
  scrollable mini-list — **group trail rendered as banner rows** when items carry groups —
  current item highlighted, click to jump. Sets are in-memory; plain scroll (virtualization
  backlog >1k).
- **`ItemPath.vue`** (top-shelf): renders `pathSegments` — group segments emit
  `back()` (D12), entity segments emit `navigate({collection, id})`, terminal title in
  bold `text-nui-fg` (list-consistent typography); NuiText squeeze; middle-segment
  ellipsis on narrow containers (`A › … › Title`).
- **`CollectionList`** addition: optional `anchorKey?: string` prop — on change, scrolls
  that row into view and flash-highlights it once (token-based tint).

### 3.6 Showcase wiring

- Records/artists/labels list pages: on row click, build the snapshot
  (`visibleRows`/`groupLines` flattened in display order; labels from the primary text
  field; group trails from the row's group path; `query` = current serialized input;
  `title` = current narrate title; `total` = base row count) → `captureFoundSet` → navigate.
- Detail pages: render `TraverseBar` (when snapshot exists) + `ItemPath` above
  `RecordDetail`; `onSettle`/`navigate` → `router.replace`; `back` →
  `setReturnAnchor` + navigate to the list.
- List pages on mount: `consumeReturnAnchor` → restore the query string, then `anchorKey`
  the row (scroll + highlight). (Baymard rule 5.)
- Records natural axis config: `naturalOrder: ['labelId', 'artistId']`; `labelFor` from the
  already-fetched option rows. Skim body treatment: while `skimming`, the record cards get
  `opacity-60` + `pointer-events-none` (a `skimming` prop on the detail wrapper div —
  page-level class, no RecordDetail change).

## 4. Interaction contract

- Click ▼ (or `j`): cursor +1 instantly — position counter, path-title update from the
  snapshot; after 250 ms without further steps, the record loads (`router.replace`).
  Skim path fidelity: group segments come from the snapshot (`cursorItem.group`) and stay
  correct while skimming; natural-axis entity segments need the record, so during a skim the
  path degrades to the title segment only (from `cursorItem.label`) and the full entity path
  returns at settle.
- Held key / rapid clicks: titles flow; one fetch on release. Slow clicks: every record
  screens fully.
- Ends: ▲ disabled at 1, ▼ at M (no wrap); ⤒/⤓ jump + settle immediately.
- Scrubber click / typed jump: cursor jumps + settles immediately (explicit intent).
- Missing record at settle (deleted mid-walk): skip to the nearest existing neighbor in the
  step direction; scrubber marks the dead entry dimmed.
- Editing: all traversal inert (D10).
- Locale switch mid-traverse: snapshot labels are capture-time strings (frozen, D1) — they
  do not re-localize; the narrated title likewise. Accepted; re-capture on next list visit.

## 5. Testing

- Engine: pure vitest — `positionOf`/`itemAt` (ends, missing id, single item), `pathSegments`
  (grouped trail, natural axis with/without labelFor, no-ref schemas), snapshot flattening
  from grouped rows.
- `useTraverse`: fake-timer vitest — skim accumulation → single settle, generation guard
  (older settle never fires), external id sync, clamping, immediate settle for first/last/goTo.
- `useFoundSet`: capture/consume one-shot anchor, per-entity isolation.
- Showcase: Playwright pass — capture → traverse (slow + rapid) → scrubber jump → typed jump
  → back restores query + scroll + highlight → j/k → editing blocks traversal → grouped
  path-title + scrubber banners → natural-axis links navigate to label/artist. Both locales,
  three container widths, zero console errors.

## 6. Multi-tab compatibility invariants (P-C deferred; these hold NOW)

1. A snapshot is fully derivable from its `query` string (the DSL already encodes
   filter+sort+group) — nothing in the snapshot requires another tab's memory.
2. The store is per-tab by construction; no code may assume cross-tab sharing.
3. Every navigational element (rows, scrubber entries, steppers, path segments) is built so
   a real `href` can be layered on later without restructuring (P-C makes modifier-click
   fork natively; plain click keeps `router.replace` semantics).

P-C implementation (URL `?q=` seeding on settle, links-everywhere, fork tests): deferred.

## 7. Designed backlog

### P-D — Lists v1 (the hide/patch algebra)

```
list = (eval(query) − hide) ∪ patch      sorted by the query's sort key
```
`ListDef { name, query?: string, hide: string[], patch: string[] }` unifies:
pure smart list (bookmarked search: no overrides) · smart with overrides (hide masks a
matching item; patch adds a non-matching one) · fixed playlist (no query, all patch).
**Add/remove are total on every shape**: remove = item ∈ patch ? unpatch : hide;
add = item ∈ hide ? unhide : patch. Commands surface in list rows and the detail traverse
bar for named lists. Persistence: saved searches live in localStorage today; lists are
*data* — vault-persisted (encrypted, syncable) is the endgame; decide at P-D.
Apple Music mapping: Smart Playlist = saved search (shipped); Playlist = fixed list;
smart-with-overrides exceeds Apple's model.

### P-E — Bulk selection & set algebra
Checkbox selection column in `CollectionList`: select-visible → banner "select all N found"
(Gmail's two-step), then union / intersect / subtract into a named list, or
create-new-from-selection.

### Other backlog
Drift badges on no-longer-matching records (D1) · dedicated group-banner anchor (D12) ·
`TraverseRail` persistent filmstrip (≥992 side rail) · split-view mode · swipe gestures ·
scrubber virtualization >1k · `?q=` deep-link restore after unlock (P-C) · re-localizing
snapshots on locale switch.
