# Search Toolbar Interaction — Design Spec

Scope: the records-list toolbar in the showcase (and the `@noy-db/ui-nuxt` pieces behind it):
the search field ("editable title"), the three-mode search command group, result modifiers,
memory, and reset. Defines states, transitions, focus, keyboard, motion, and accessibility.

## 0. The model

The search field is the **only input surface**. The toolbar reads left→right as a sentence:

> **express** the search (how: exact / ask / speak) → **shape** the result (group) →
> **recall** (saved, recent) → **reset**.

The three search commands are three *voices* for the same utterance — one segmented radio
control, exactly one armed. The signature of the design: the machinery disappears into the
title. You never "go somewhere" to search, ask, or speak — you choose a voice and the title
listens.

## 1. Anatomy & grid

```
┌─ TITLE / SEARCH FIELD (flex-1) ─────────┐  ┌ EXPRESS ┐ │ SHAPE │ MEMORY  │ RESET
│  Records: Jazz, by Label▎               │  │ ⌕  ✨ 🎤 │ │  ▦    │  ⧉  🕒  │ ✕/🗑
└─────────────────────────────────────────┘  └─▔▔──────┘ │       │         │
                                              sliding thumb   hairline dividers
```

- Buttons: 36×36 px hit target, 21 px (1.3125rem) icon, 8 px gap **within** a zone.
- Zones separated by 12 px + a 1 px hairline divider (`--hairline`).
- All button centers align to the search field's centerline (46 px field → center 23 px).
- **Mode group** is a capsule (`--radius-control`, `bg-nui-bg-accent`) with a 2 px-inset
  **sliding thumb** under the armed icon. Armed icon = accent; others = muted. The capsule is
  the only "surface" on the rail; every other control is a ghost icon button.
- Reset sits isolated at the far end (destructive-adjacent controls live alone) and **never
  moves**.

## 2. The mode group (radio; arming also focuses the field)

### ⌕ Exact — deterministic search (default)
- Placeholder: “Type to filter — Tab completes…”.
- Keystrokes → tokenizer → suggestion panel → pills. Tab/Enter commit; Backspace on empty
  removes the last pill; blur smart-quotes and commits the draft. (Current behavior, named.)

### ✨ Ask — AI search
- Arm: field focuses; placeholder “Describe it — cheap jazz from the 70s…”; a small ✨ ghost
  at the line start (the field wears its mode).
- Typing: **suggestion panel hidden** — natural-language register; one quiet hint row instead:
  “↵ interpret with AI”.
- Enter → in flight: draft text shimmers (opacity pulse), ✨ segment pulses, field read-only,
  Esc aborts. Existing query is always sent as refine context (no checkbox).
- Success: draft dissolves; pills materialize left→right (120 ms, 60 ms stagger); title
  crossfades. **Mode stays armed** — conversational iteration (“now only favorites” refines).
- Failure: draft kept untouched; one-line note under the toolbar (specific: key? network?),
  auto-dismisses ~6 s.
- Blur in Ask **keeps the draft in the field** (never committed as free-text pills, never
  discarded). The box shows the draft instead of the rest-title until sent or Escaped.
- No stored key → arming ✨ opens a compact key sheet anchored to the segment (key
  save/change/forget only; the old NL textarea and refine checkbox are removed — the field IS
  the NL input, refine is automatic).

### 🎤 Speak — voice, spring-loaded, routes to AI
- Rationale: speech is natural language by nature; dictating into the deterministic parser
  yields free-text noise. **Voice = hands-free Ask.**
- Tap: segment latches *pressed* with the red pulse; placeholder “Listening…”; interim
  transcript streams into the field as muted ghost text, solidifying as segments finalize.
- End (≈1.5 s silence, or tap again): transcript → the Ask pipeline (shimmer → pills).
- Esc while listening: stop + discard transcript.
- After completion or cancel, the thumb slides back to the previously armed mode
  (spring-loaded: mic is momentary, not sticky).
- Unsupported browser: segment hidden entirely, never permanently disabled.

## 3. Shape & memory zones

- **▦ Group-by**: existing popover (toggle fields, expand/collapse levels). Unchanged.
- **⧉ Saved / 🕒 Recent**: existing popovers; rows render the fluent `narrate` title with the
  sentence as tooltip. Unchanged.

## 4. Reset — morphing icon, honest meaning

One slot, three faces; the icon always names exactly what the press will do:

| State | Icon | Press does |
|---|---|---|
| Draft present (or AI in flight) | ✕ | Discard the draft (abort the AI request, restore draft on abort). Query untouched. Focus stays in the field. |
| No draft, query present | 🗑 (trash) | Erase the whole search (query + pills). |
| Nothing to clear | 🗑 at 40 %, inert | — |

Mode is never reset by this control — how you search is a preference, not content.

## 5. Keyboard map

| Key | Where | Action |
|---|---|---|
| `/` | anywhere | focus the field in the current mode |
| `Tab` / `Enter` | Exact | complete / commit token |
| `Enter` | Ask | send to AI |
| `Alt+Enter` | Exact | send this draft to AI once, without switching modes |
| `Esc` | field | ladder: ① close suggestions → ② discard draft → ③ blur to title. Also: abort AI flight; stop listening. |
| `Backspace` on empty | field | remove last pill |
| `←`/`→` | mode group focused | move the armed segment (radiogroup) |

## 6. Motion

- Thumb slide 150 ms ease-out. Mic pulse 1.2 s. Pill materialize 120 ms scale .95→1 + fade,
  60 ms stagger. Title crossfade 150 ms. Draft shimmer: 1 s opacity 1→.55 loop.
- `prefers-reduced-motion`: all become instant swaps; mic pulse becomes a static red dot.

## 7. Accessibility

- Mode group `role="radiogroup"`; segments `role="radio"` + `aria-checked`; arrow-key moves.
- Mic `aria-pressed` while listening; transcript region `aria-live="polite"`.
- Field `aria-busy` during AI flight. Reset `aria-label` matches its current face
  (“Discard draft” / “Clear search”).
- Every state change is expressed in two channels (icon + placeholder/ghost), never color
  alone.

## 8. Decisions log (owner-confirmed)

1. **Voice always routes to AI** (hands-free Ask).
2. **Ask stays armed** after a result (conversational refine).
3. **Suggestions hidden in Ask**; hint row only.
4. **Reset is two-stage with morphing icons**: ✕ discards the draft, 🗑 erases all.

## 9. Out of scope (this spec)

Concept nodes (AI-defined virtual fields), virtual scroll + sticky group headers, the
artists/labels pages' toolbars (should adopt this spec afterward), Thai `nui.q.*` catalog.
