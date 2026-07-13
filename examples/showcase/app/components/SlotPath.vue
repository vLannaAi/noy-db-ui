<script setup lang="ts">
// The record's identity as a jukebox selector — Title stands as the headline drum; Artist and Label
// roll beneath it as the byline. All three are ONE linked sequence over a single global order
// (records sorted by label, then artist, then title). Roll the Title drum past a segment's edge and
// it carries on into the next artist (or label), pulling those drums along — a double-chevron marks
// the crossing. So the Title drum alone scrubs the whole collection; the byline drums jump by segment.
// Flat + accent-tinted (theme-uniform); the linked roll settles with a spring kickback.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

interface Rec { id: string; title: string; labelId: string; artistId: string }
interface Named { id: string; name: string }

const props = defineProps<{
  records: Rec[]
  labels: Named[]
  artists: Named[]
  currentId: string
  /** Localized drum captions, e.g. { label: 'Label' | 'ค่ายเพลง', … }. */
  captions: { label: string; artist: string; title: string }
}>()
const emit = defineEmits<{ navigate: [id: string] }>()

// Per-drum row height: the headline Title rolls in taller rows than the byline drums.
const ROWH: Record<ReelKey, number> = { title: 34, artist: 24, label: 24 }
const SETTLE = 640
const SPIN = 4
type ReelKey = 'title' | 'artist' | 'label'
// Visual + ripple order: the headline leads, the byline follows.
const REEL_ORDER: ReelKey[] = ['title', 'artist', 'label']

const displayId = ref(props.currentId)
watch(() => props.currentId, (id) => { displayId.value = id })

const labelName = (id: string): string => props.labels.find((l) => l.id === id)?.name ?? id
const artistName = (id: string): string => props.artists.find((a) => a.id === id)?.name ?? id
const recOf = (id: string): Rec | undefined => props.records.find((r) => r.id === id)
const cur = computed(() => recOf(displayId.value) ?? props.records[0])

// THE global order — every drum navigates this one sequence.
const sorted = computed<Rec[]>(() => [...props.records].sort((a, b) =>
  labelName(a.labelId).localeCompare(labelName(b.labelId))
  || artistName(a.artistId).localeCompare(artistName(b.artistId))
  || a.title.localeCompare(b.title)))
const giOf = (id: string): number => sorted.value.findIndex((r) => r.id === id)

const byName = (a: Named, b: Named): number => a.name.localeCompare(b.name)
const labelVals = computed<Named[]>(() => [...props.labels].sort(byName))
const artistVals = computed<Named[]>(() => {
  const L = cur.value?.labelId
  const ids = new Set(props.records.filter((r) => r.labelId === L).map((r) => r.artistId))
  return props.artists.filter((a) => ids.has(a.id)).sort(byName)
})
const titleVals = computed<Named[]>(() => {
  const c = cur.value
  return props.records.filter((r) => r.labelId === c?.labelId && r.artistId === c?.artistId)
    .map((r) => ({ id: r.id, name: r.title })).sort(byName)
})

// Ordered title → artist → label so the DOM/tab order leads with the headline.
const reels = computed(() => [
  { key: 'title' as ReelKey, eyebrow: props.captions.title, values: titleVals.value, index: titleVals.value.findIndex((v) => v.id === displayId.value) },
  { key: 'artist' as ReelKey, eyebrow: props.captions.artist, values: artistVals.value, index: artistVals.value.findIndex((v) => v.id === cur.value?.artistId) },
  { key: 'label' as ReelKey, eyebrow: props.captions.label, values: labelVals.value, index: labelVals.value.findIndex((v) => v.id === cur.value?.labelId) },
])

// Same-segment predicate for a drum's grain.
function sameSeg(key: ReelKey, a: Rec, b: Rec): boolean {
  if (key === 'title') return a.id === b.id
  if (key === 'artist') return a.artistId === b.artistId && a.labelId === b.labelId
  return a.labelId === b.labelId
}
/** The record a step lands on — the adjacent record at the drum's grain, in the GLOBAL order. */
function neighbor(key: ReelKey, dir: 1 | -1): string | null {
  const s = sorted.value
  const gi = giOf(displayId.value)
  const c = s[gi]
  if (!c) return null
  if (key === 'title') return s[gi + dir]?.id ?? null
  if (dir === 1) {
    for (let j = gi + 1; j < s.length; j++) if (!sameSeg(key, s[j], c)) return s[j].id
    return null
  }
  let st = gi
  while (st > 0 && sameSeg(key, s[st - 1], c)) st--
  if (st === 0) return null
  const prev = s[st - 1]
  let ps = st - 1
  while (ps > 0 && sameSeg(key, s[ps - 1], prev)) ps--
  return s[ps].id
}
/** Does a step at `key` cross a COARSER boundary (so it pulls the byline drums)? */
function crosses(key: ReelKey, dir: 1 | -1): boolean {
  const t = neighbor(key, dir)
  const c = cur.value
  const tr = t ? recOf(t) : undefined
  if (!t || !tr || !c) return false
  if (key === 'title') return tr.artistId !== c.artistId || tr.labelId !== c.labelId
  if (key === 'artist') return tr.labelId !== c.labelId
  return false
}

// animation state
const delays = ref<Record<ReelKey, number>>({ title: 0, artist: 0, label: 0 })
const spinRows = ref<Record<ReelKey, number>>({ title: 0, artist: 0, label: 0 })
const noAnim = ref(false)
const spinning = ref(false)
let navTimer: ReturnType<typeof setTimeout> | null = null

/** The first record of a label/artist/title value the jump menu picks. */
function resolveJump(key: ReelKey, valueId: string): string | null {
  if (key === 'title') return valueId
  const c = cur.value
  if (!c) return null
  const pick = (rs: Rec[]) => [...rs].sort((a, b) => a.title.localeCompare(b.title))[0]?.id ?? null
  if (key === 'artist') return pick(props.records.filter((r) => r.labelId === c.labelId && r.artistId === valueId))
  const artistIds = new Set(props.records.filter((r) => r.labelId === valueId).map((r) => r.artistId))
  const firstArtist = props.artists.filter((a) => artistIds.has(a.id)).sort(byName)[0]?.id
  return pick(props.records.filter((r) => r.labelId === valueId && r.artistId === firstArtist))
}

async function go(key: ReelKey, target: string | null, actuatedCross: boolean): Promise<void> {
  if (!target || target === displayId.value) return
  menuFor.value = null
  const from = REEL_ORDER.indexOf(key)
  const o = cur.value!
  const n = recOf(target)!
  const changed: Record<ReelKey, boolean> = {
    title: true,
    artist: o.labelId !== n.labelId || o.artistId !== n.artistId,
    label: o.labelId !== n.labelId,
  }
  // Distance-based stagger: the actuated drum leads; linked drums ripple after, in that direction.
  delays.value = {
    title: Math.abs(REEL_ORDER.indexOf('title') - from) * 90,
    artist: Math.abs(REEL_ORDER.indexOf('artist') - from) * 90,
    label: Math.abs(REEL_ORDER.indexOf('label') - from) * 90,
  }
  const spin = (k: ReelKey): number => {
    if (!changed[k]) return 0
    if (k === key && !actuatedCross) return 0 // a plain in-segment step just rolls ±1
    return SPIN
  }
  spinRows.value = { title: spin('title'), artist: spin('artist'), label: spin('label') }
  noAnim.value = true
  spinning.value = true
  displayId.value = target
  await nextTick()
  requestAnimationFrame(() => { noAnim.value = false; spinRows.value = { title: 0, artist: 0, label: 0 } })
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(() => { spinning.value = false; emit('navigate', target) }, SETTLE)
}
function step(key: ReelKey, dir: 1 | -1): void { go(key, neighbor(key, dir), crosses(key, dir)) }
function jump(key: ReelKey, valueId: string): void { go(key, resolveJump(key, valueId), true) }

const menuFor = ref<ReelKey | null>(null)
function toggleMenu(key: ReelKey): void { menuFor.value = menuFor.value === key ? null : key }

onBeforeUnmount(() => { if (navTimer) clearTimeout(navTimer) })

const stripStyle = (reel: { key: ReelKey; index: number }) => {
  const rh = ROWH[reel.key]
  return {
    transform: `translateY(${rh - (reel.index + spinRows.value[reel.key]) * rh}px)`,
    transitionDelay: `${delays.value[reel.key]}ms`,
  }
}
</script>

<template>
  <nav class="slot-console" :class="{ 'no-anim': noAnim }" aria-label="Record selector">
    <div
      v-for="reel in reels" :key="reel.key"
      class="slot-reel" :class="`reel-${reel.key}`"
      :style="{ '--rh': `${ROWH[reel.key]}px` }"
    >
      <span class="slot-eyebrow">{{ reel.eyebrow }}</span>
      <div class="slot-body">
        <div class="slot-spinner">
          <button
            type="button" class="slot-chev" :class="{ cross: crosses(reel.key, -1) }"
            :disabled="!neighbor(reel.key, -1) || spinning"
            :aria-label="crosses(reel.key, -1) ? 'Previous segment' : 'Previous'" @click="step(reel.key, -1)"
          ><span :class="crosses(reel.key, -1) ? 'i-lucide-chevrons-up' : 'i-lucide-chevron-up'" aria-hidden="true" /></button>
          <button
            type="button" class="slot-chev" :class="{ cross: crosses(reel.key, 1) }"
            :disabled="!neighbor(reel.key, 1) || spinning"
            :aria-label="crosses(reel.key, 1) ? 'Next segment' : 'Next'" @click="step(reel.key, 1)"
          ><span :class="crosses(reel.key, 1) ? 'i-lucide-chevrons-down' : 'i-lucide-chevron-down'" aria-hidden="true" /></button>
        </div>
        <div class="slot-window">
          <button type="button" class="slot-drum-hit" :aria-label="`Choose ${reel.eyebrow}`" @click="toggleMenu(reel.key)">
            <span class="slot-payline" aria-hidden="true" />
            <div class="slot-strip" :style="stripStyle(reel)">
              <div
                v-for="(v, vi) in reel.values" :key="v.id"
                class="slot-cell"
                :class="{ current: vi === reel.index, near: Math.abs(vi - reel.index) === 1 }"
              >{{ v.name }}</div>
            </div>
          </button>
        </div>
      </div>

      <ul v-if="menuFor === reel.key" class="slot-menu">
        <li v-for="v in reel.values" :key="v.id">
          <button type="button" class="slot-menu-item" :class="{ on: v.id === reel.values[reel.index]?.id }" @click="jump(reel.key, v.id)">{{ v.name }}</button>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
/* Headline + byline: the Title drum spans the top; Artist and Label share the row beneath. Flat,
   accent-tinted, translucent — no skeuomorphic inset (theme-uniform; Speed reads as flat glass). */
.slot-console {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-areas:
    'title title'
    'artist label';
  gap: 0.35rem 1.25rem;
  padding: 0.65rem 0.85rem;
  border-radius: 14px;
  background:
    linear-gradient(135deg,
      color-mix(in oklab, var(--nui-accent) 9%, var(--nui-bg)),
      color-mix(in oklab, var(--nui-accent) 3%, var(--nui-bg)));
  border: 1px solid color-mix(in oklab, var(--nui-accent) 22%, var(--nui-border));
}
.reel-title { grid-area: title; }
.reel-artist { grid-area: artist; }
.reel-label { grid-area: label; }
/* A hairline between the headline and its byline. */
.reel-artist, .reel-label { padding-top: 0.4rem; border-top: 1px solid color-mix(in oklab, var(--nui-accent) 14%, var(--nui-border)); }

.slot-reel { position: relative; display: flex; flex-direction: column; min-width: 0; }
.slot-eyebrow {
  font-family: 'Space Mono', ui-monospace, monospace;
  font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
  color: color-mix(in oklab, var(--nui-accent) 60%, var(--nui-muted)); margin: 0 0 2px 1px;
}

.slot-body { display: flex; align-items: stretch; gap: 6px; }

.slot-window {
  position: relative; flex: 1 1 auto; min-width: 0; height: calc(var(--rh) * 3);
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 32%, #000 68%, transparent);
  mask-image: linear-gradient(180deg, transparent, #000 32%, #000 68%, transparent);
}
.slot-drum-hit {
  position: relative; display: block; width: 100%; height: 100%;
  overflow: hidden; cursor: pointer; background: none; border: 0; padding: 0; text-align: left;
}
.slot-strip {
  position: absolute; top: 0; left: 0; right: 0; will-change: transform;
  transition: transform 460ms cubic-bezier(0.2, 1.5, 0.35, 1);
}
.no-anim .slot-strip { transition: none; }
.slot-cell {
  position: relative; z-index: 1; height: var(--rh); line-height: var(--rh);
  font-family: 'Saira', system-ui, sans-serif; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 4px;
  color: var(--nui-subtle); opacity: 0.42;
  transform: scale(0.86); transform-origin: left center;
  transition: color 200ms, opacity 200ms, transform 200ms;
}
.slot-cell.near { opacity: 0.6; }
.slot-cell.current { color: var(--nui-fg); opacity: 1; transform: scale(1); }
/* headline type scale */
.reel-title .slot-cell { font-size: 21px; font-weight: 600; }
.reel-title .slot-cell.current { font-weight: 700; letter-spacing: -0.01em; }
.reel-artist .slot-cell, .reel-label .slot-cell { font-size: 14px; }
.reel-artist .slot-cell.current, .reel-label .slot-cell.current { font-weight: 600; }

/* the payline — a flat translucent accent band behind the locked row (no bracket rules) */
.slot-payline {
  position: absolute; z-index: 0; left: 0; right: 0; top: var(--rh); height: var(--rh); border-radius: 7px;
  background: color-mix(in oklab, var(--nui-accent) 15%, transparent); pointer-events: none;
}

.slot-spinner { flex: 0 0 22px; display: flex; flex-direction: column; justify-content: space-between; padding: 1px 0; }
.slot-chev {
  flex: 1 1 0; display: flex; align-items: center; justify-content: center; width: 22px; min-height: 0;
  color: var(--nui-muted); background: none; border: 0; cursor: pointer; border-radius: 5px;
  opacity: 0.55; transition: opacity 150ms, color 150ms, background 150ms;
}
.slot-chev:hover:not(:disabled) { color: var(--nui-accent); opacity: 1; background: color-mix(in oklab, var(--nui-accent) 12%, transparent); }
.slot-chev:focus-visible { opacity: 1; outline: 2px solid var(--nui-accent); outline-offset: -1px; }
.slot-chev:disabled { opacity: 0.16; cursor: default; }
/* a cross-segment step pulls other drums — mark it in the accent */
.slot-chev.cross { color: var(--nui-accent); opacity: 0.9; }
.slot-chev.cross:hover:not(:disabled) { opacity: 1; }
.slot-chev [class^='i-lucide'] { width: 15px; height: 15px; }

.slot-menu {
  position: absolute; left: 0; top: 100%; z-index: 40; margin-top: 4px;
  min-width: 100%; max-height: 220px; overflow: auto;
  background: var(--nui-bg); border: 1px solid var(--nui-border); border-radius: 8px;
  box-shadow: 0 8px 24px color-mix(in oklab, black 24%, transparent); padding: 4px; list-style: none;
}
.slot-menu-item {
  display: block; width: 100%; text-align: left; white-space: nowrap;
  font-family: 'Saira', system-ui, sans-serif; font-size: 14px;
  padding: 4px 8px; border-radius: 5px; background: none; border: 0; cursor: pointer; color: var(--nui-fg);
}
.slot-menu-item:hover { background: var(--nui-bg-accent); }
.slot-menu-item.on { color: var(--nui-accent); font-weight: 600; }

/* Very narrow: stack the byline drums so names don't crush. */
@media (max-width: 460px) {
  .slot-console { grid-template-columns: 1fr; grid-template-areas: 'title' 'artist' 'label'; }
}

@media (prefers-reduced-motion: reduce) { .slot-strip { transition-duration: 1ms; } }
</style>
