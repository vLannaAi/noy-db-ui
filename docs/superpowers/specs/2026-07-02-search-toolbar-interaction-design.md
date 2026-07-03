# Search Toolbar Interaction — Design Spec & Contract (v2)

Scope: the list-page toolbar in the showcase and the `@noy-db/ui-nuxt` pieces behind it: the
search field ("editable title"), the three-voice mode group, result modifiers, memory, reset,
notes/key sheet. **v2 is the regression contract**: every numbered invariant below is testable and
MUST keep holding when anything else changes. When a fix would violate one, the spec gets amended
first, deliberately — never silently.

## 0. The model

The search field is the **only input surface**. The toolbar reads left→right as a sentence:

> **express** the search (exact / ask / speak) → **shape** (group) → **recall** (saved, recent) →
> **reset**.

One query string is the single source of truth; `parse → resolve → {evaluate, pills, narrate,
serialize}` are its four renderings. The signature: the machinery disappears into the title.

## 1. Global invariants (the "never break" list)

- **I1 · One language.** Every text surface renders a stored query through `narrate` with the
  host's `formatValue`: window/tab title, the rest-title in the box, its tooltip (the sentence),
  recent rows, saved rows, the save-name draft, "Opens on". No surface shows raw canonical values
  (`jazz`), raw ids (`artist_name`), or chip-join strings. **This includes the ACTIVE LOCALE**:
  noy-db's `describe()` labels are single-language by design, so the host injects a locale
  dictionary via `schemaFromDescribe`'s `labelFor` (the original label survives as an alias — a
  query typed in the data language still resolves), passes a schema GETTER to `useCollectionList`
  (labels are locale-reactive), and supplies `t` — which `narrate`, `astToPills` and
  `buildSuggestions` all accept for their structural words (not/and/or, Sort:/Group:, Search …).
  The host's `t` bridge forwards the FULL `nui.*` key verbatim — never re-prefix it.
  Catalog ownership: the LIBRARY ships translations for its own keys (`LOCALE_TH` in `@noy-db/ui`
  for the engine words; `NUI_LOCALE_TH` in `@noy-db/ui-nuxt/core` = engine + component chrome,
  the one hosts spread); the HOST owns only its domain words (entity nouns `nui.q.noun.<entity>`,
  per-entity titles `nui.q.all.<entity>`, field labels, enum values) plus any flavor overrides.
- **I2 · Nothing is silent.** Every gesture produces a visible reaction ON TOP of everything else:
  missing key → the key card appears above all layers AND receives the caret; AI/voice failure →
  a note; silence after mic release → a note; empty result → the table's empty state. "Pressed
  and nothing happened" is always a bug.
- **I3 · Typed work is never lost.** The draft survives: blur commits it (exact) or keeps it
  visible (ask); AI failure/abort keeps it; the pill being edited is restored by Esc. The only
  destroyers are the user's explicit Esc-discard, ✕, 🗑, or Remove.
- **I4 · No layout shift.** The box is a constant 46px min-height in rest and edit; status notes
  and the key sheet float in zero-height strips (inline `z-index` — utility classes for z are not
  trusted); popovers overlay. The table below never moves when transient UI appears.
- **I5 · Honest icons.** A control's icon names exactly what a press will do right now: reset is
  ✕ (discard draft / abort flight) or 🗑 (erase search) or inert; the thumb sits under the armed
  voice; the mic is red only while capturing.
- **I6 · Deterministic vs AI never bleed.** Exact input, pill edits (any mode), and Alt+Enter's
  surrounding state make ZERO AI calls; ask/speak commits make exactly one. A pill-edit session
  forces deterministic commit even while ✨ is armed.
- **I7 · Aborted work never lands.** ✕ or Esc during an AI flight discards the in-flight result
  even if the response arrives later (sequence guard); busy state fully clears.
- **I8 · Canonical state is deduped.** `resolve` collapses duplicate sort/group/show/hide keys
  (first occurrence keeps the slot) and merges same-field eq/in predicates (OR semantics).
- **I9 · Focus stays coherent.** Focus never falls to `<body>` from any search interaction. Rules:
  pill unmount parks focus on the input first; pill-focus after a query change defers a tick;
  every focusable shows the themed accent ring.

## 2. The mode group (radio; arming focuses the field)

| Voice | Icon | Commit | Suggestions |
|---|---|---|---|
| **Exact** (default) | ⌕ | Enter/Tab → deterministic parse | full panel |
| **Ask** (sticky) | ✨ | Enter → AI (refine automatic when a query exists) | hidden; ONE actionable hint row "↵ interpret with AI" (a real button = same as Enter) |
| **Speak** (momentary) | 🎤 | hold = capture (continuous), release = finalize → Ask pipeline | n/a |

- Arming ✨/🎤 without a key → the key card (see §6). Ask stays armed after results.
- Alt+Enter in Exact = one-shot ask; the thumb never moves.
- Mic: quick tap (<250 ms) shows the "Hold to speak" teaching hint; pointer capture makes release
  reliable off-button; unsupported browser hides the segment.
- Busy (AI in flight): draft shimmers, input readonly, ✨ pulses, reset face = ✕, Esc aborts.

## 3. The field: rest vs edit

- **Rest** = the fluent title (24px/700), tooltip = full sentence; pending ask-draft (muted, ✨
  ghost) replaces the title while it exists; placeholder when empty.
- **Edit** (focus) = two-tone pills + the draft continuing the title (same 24px/700/baseline).
  Pills: accent fill = filters/text (what to match), neutral fill = sort/group/view (how it's
  shaped); head (field/kind) quiet — 75% on accent pills, 60% neutral — value bold.
- Blur: exact-mode draft commits (spaced values smart-quoted; a tail containing another `field:`
  is DSL, not one value); ask-mode draft is kept visible; an edit session commits.

## 4. Pills — the criterion object

Every pill supports, in ANY mode:

| Gesture | Result |
|---|---|
| click (mousedown never blurs the editor) | EDIT: token into the draft (labelled form, e.g. `Genre:jazz`), **value part pre-selected so typing replaces it**, popup opens with **Remove** as the first option, then value choices |
| its × (24px hit target) | remove that criterion |
| popup "Remove …" | remove (the explicit delete) |
| Esc during edit | RESTORE the original pill (rung ② — cancel is never a delete) |
| drag ≥6px (pointer capture; accent insertion bar) | reorder within its own segment (sort = priority, group = nesting; cross-segment clamps); a completed drag's click is swallowed once and only once |
| keyboard | see §7 |

Boolean criteria read as the bare label ("Favorite" / "not Favorite") — never `true`/`false`.

## 5. Reset & the Esc ladder

- **Reset button** (fixed position, far right): ✕ when a draft exists or a flight is up (discard/
  abort; query untouched) → 🗑 when only a query remains (erase all) → inert 🗑 otherwise. Mode is
  never reset.
- **Esc ladder** in the field, one rung per press: ① close the popup (in EVERY form — value
  suggestions, the editing Remove row, or the ask hint) → ② cancel: restore an edited pill, else
  discard the draft → ③ blur to the title. During a flight, Esc aborts (I7). On a focused pill,
  Esc returns to the input.

## 6. Key card & status notes (floating, I2 + I4)

- The key card appears above ALL layers (inline z-index 40 — see I4) whenever ✨/🎤/ask/speak is
  used without a key; the caret jumps into it **every time** (not only the first); Enter saves and
  returns focus to the search field; Later dismisses. The pending draft survives the detour.
- Error/info notes are floating one-liners under the toolbar: AI failures (auto-dismiss ~6s),
  ignored-fields notes, mic errors by cause (permission / no mic / network / no speech).

## 7. Keyboard map (complete)

| Key | Where | Action |
|---|---|---|
| `/` | anywhere | focus the field in the current voice |
| `Tab` / `Enter` | Exact draft | complete / commit |
| `Enter` | Ask draft (no edit session) | send to AI |
| `Alt+Enter` | Exact draft | one-shot ask |
| `Esc` | field / flight / pill | the ladder (§5); abort; back to input |
| `Backspace` on empty | field | remove last pill |
| `←` at input start | field | roving focus into the pill row (last pill) |
| `←`/`→` | pill | roam; `→` past last returns to the input |
| `Home` / `End` | pill | first / last pill |
| `Enter`/`Space` | pill | edit (deterministic in any mode) |
| `Delete`/`Backspace` | pill | remove; focus lands on the previous pill (input-park rule, I9) |
| `Alt+←`/`Alt+→` | pill | reorder within segment; focus follows |
| hold `Space`/`Enter` | mic focused | push-to-record |
| `Enter` | key card / save-name / rename | confirm |
| `←`/`→` | mode group | move the armed segment |

## 8. Menus (memory zone)

- **Recents**: fluent one-line titles + sentence tooltip + relative age; click applies; dedup by
  canonical string; recents are inherently static snapshots.
- **Saved**: rows = user name (+ fluent title as a muted second line when it differs) + sentence
  tooltip + rolling chip; save-name input autofocuses pre-selected with the fluent title; Enter
  saves; rename/delete/favorite/set-default per row; "Opens on" uses the same language.

## 8b. Print (the report layout)

- A printer icon (memory zone, after recents) calls `window.print()`; `@media print` swaps to the
  report layout. **I1 extends to paper**: the report header is the fluent narrate title (h1) +
  the full sentence + `N rows · printed-at`.
- Chrome disappears (`.nui-sidebar`, `.print-hide` on the toolbar and note strips); the table goes
  ink-friendly: no tinted surfaces, black text — including forcing `thead *` to ink (header labels
  carry their own accent-fg class), hairline row rules, group banners as bold rule-topped rows,
  interactive-only glyphs (funnels, sort hints) hidden. Never `display:none` a `td` (covers stay)
  — that would shift columns.
- Print reflects the CURRENT view state: filters, sort, group, collapse state, column set.

## 9. Layering (top to bottom)

key card (z:40, inline) → status notes (same strip) → suggestion/hint popup (z:20) → group/saved/
recent popovers → sticky thead (z:10) → content. Anything that must beat the thead uses an INLINE
z-index (see I4's utility-class caveat).

## 10. Decisions log

1. Voice always routes to AI. 2. Ask stays armed. 3. Ask hides suggestions (hint row instead);
pill edits override. 4. Reset = two-stage morphing icon. 5. Esc restores an edited pill; explicit
Remove/× deletes. 6. Delete-focus stays in the row. 7. Duplicates collapse in `resolve`.
8. Booleans read as bare labels. 9. Pill edit pre-selects the value.

## 11. Out of scope / backlog

Concept nodes (AI virtual fields), virtual scroll + sticky group headers, wrap-growth strategy for
very long queries, faceted-vs-full popup values, artists/labels memory zone, locale-aware
relative ages in recents ("2h") and date-value labels (`dateLabel` presets are English-only).
