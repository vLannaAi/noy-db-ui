<script setup lang="ts">
// The record-detail path (Label › Artist › Title) reimagined as a jukebox selection console: three
// drums you dial. Turning a drum navigates the collection's own hierarchy — pick a Label and the
// Artist + Title drums spin and lock left-to-right with a spring kickback (a slot machine settling).
// Chevrons step; clicking a drum opens a jump menu. Domain nav, not a breadcrumb.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

interface Rec { id: string; title: string; labelId: string; artistId: string }
interface Named { id: string; name: string }

const props = defineProps<{
  records: Rec[]
  labels: Named[]
  artists: Named[]
  currentId: string
}>()
const emit = defineEmits<{ navigate: [id: string] }>()

const ROW = 26          // row height (px)
const SETTLE = 640      // total cascade settle before navigating (ms)
const SPIN = 4          // rows a cascaded drum rolls through before locking

// The record the drums currently show. Diverges from props.currentId only during a spin — we animate
// to the target locally, then emit navigate; the fresh page mounts at the settled position (no jump).
const displayId = ref(props.currentId)
watch(() => props.currentId, (id) => { displayId.value = id })

const byName = (a: Named, b: Named) => a.name.localeCompare(b.name)
const cur = computed(() => props.records.find((r) => r.id === displayId.value) ?? props.records[0])

// Drum value lists — cascading: artists that press on the current label, records by that pairing.
const labelVals = computed<Named[]>(() => [...props.labels].sort(byName))
const artistVals = computed<Named[]>(() => {
  const L = cur.value?.labelId
  const ids = new Set(props.records.filter((r) => r.labelId === L).map((r) => r.artistId))
  return props.artists.filter((a) => ids.has(a.id)).sort(byName)
})
const titleVals = computed<Named[]>(() => {
  const c = cur.value
  return props.records
    .filter((r) => r.labelId === c?.labelId && r.artistId === c?.artistId)
    .map((r) => ({ id: r.id, name: r.title }))
    .sort(byName)
})

type ReelKey = 'label' | 'artist' | 'title'
const reels = computed(() => [
  { key: 'label' as ReelKey, eyebrow: 'Label', values: labelVals.value, index: labelVals.value.findIndex((v) => v.id === cur.value?.labelId) },
  { key: 'artist' as ReelKey, eyebrow: 'Artist', values: artistVals.value, index: artistVals.value.findIndex((v) => v.id === cur.value?.artistId) },
  { key: 'title' as ReelKey, eyebrow: 'Title', values: titleVals.value, index: titleVals.value.findIndex((v) => v.id === displayId.value) },
])

// Per-drum stagger: the actuated drum locks first, drums to its right follow (left-to-right lock).
const delays = ref<Record<ReelKey, number>>({ label: 0, artist: 0, title: 0 })
// Extra rows a drum starts offset by, so it rolls IN (spins) instead of just sliding; cleared a
// frame later with the transition on, so the target scrolls up into the payline.
const spinRows = ref<Record<ReelKey, number>>({ label: 0, artist: 0, title: 0 })
const noAnim = ref(false)
const spinning = ref(false)
let navTimer: ReturnType<typeof setTimeout> | null = null

/** The record to land on when a drum turns to `targetIndex` — cascades to the first child. */
function resolveTarget(key: ReelKey, targetIndex: number): string | null {
  const c = cur.value
  if (!c) return null
  if (key === 'title') return titleVals.value[targetIndex]?.id ?? null
  if (key === 'artist') {
    const A = artistVals.value[targetIndex]?.id
    if (!A) return null
    const first = [...props.records].filter((r) => r.labelId === c.labelId && r.artistId === A).sort((a, b) => a.title.localeCompare(b.title))[0]
    return first?.id ?? null
  }
  // label
  const L = labelVals.value[targetIndex]?.id
  if (!L) return null
  const artistIds = new Set(props.records.filter((r) => r.labelId === L).map((r) => r.artistId))
  const firstArtist = props.artists.filter((a) => artistIds.has(a.id)).sort(byName)[0]?.id
  const first = [...props.records].filter((r) => r.labelId === L && r.artistId === firstArtist).sort((a, b) => a.title.localeCompare(b.title))[0]
  return first?.id ?? null
}

const REEL_ORDER: ReelKey[] = ['label', 'artist', 'title']
async function turn(key: ReelKey, targetIndex: number): Promise<void> {
  const from = REEL_ORDER.indexOf(key)
  const target = resolveTarget(key, targetIndex)
  if (!target || target === displayId.value) return
  menuFor.value = null
  // The actuated drum steps; drums to its right spin in, locking left-to-right (staggered delay).
  delays.value = {
    label: Math.max(0, (0 - from)) * 90,
    artist: Math.max(0, (1 - from)) * 90,
    title: Math.max(0, (2 - from)) * 90,
  }
  const kick = (i: number): number => (i > from ? SPIN : 0)
  spinRows.value = { label: kick(0), artist: kick(1), title: kick(2) }
  noAnim.value = true
  spinning.value = true
  displayId.value = target // recompute drums; strips jump to target+spin with no transition…
  await nextTick()
  requestAnimationFrame(() => { noAnim.value = false; spinRows.value = { label: 0, artist: 0, title: 0 } }) // …then roll to target
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(() => { spinning.value = false; emit('navigate', target) }, SETTLE)
}

function step(key: ReelKey, dir: 1 | -1): void {
  const reel = reels.value.find((r) => r.key === key)!
  turn(key, Math.min(reel.values.length - 1, Math.max(0, reel.index + dir)))
}

// Jump menu (click a drum to pick any value).
const menuFor = ref<ReelKey | null>(null)
function toggleMenu(key: ReelKey): void { menuFor.value = menuFor.value === key ? null : key }

onBeforeUnmount(() => { if (navTimer) clearTimeout(navTimer) })

const stripStyle = (reel: { key: ReelKey; index: number }) => ({
  // centre the index row on the payline; +spinRows offsets the start so the drum rolls in
  transform: `translateY(${ROW - (reel.index + spinRows.value[reel.key]) * ROW}px)`,
  transitionDelay: `${delays.value[reel.key]}ms`,
})
</script>

<template>
  <nav class="slot-console" :class="{ 'no-anim': noAnim }" aria-label="Record selector">
    <template v-for="(reel, ri) in reels" :key="reel.key">
      <span v-if="ri > 0" class="slot-sep" aria-hidden="true" />
      <div class="slot-reel" :class="{ wide: reel.key === 'title' }">
        <span class="slot-eyebrow">{{ reel.eyebrow }}</span>
        <div class="slot-window">
          <button
            type="button" class="slot-chev slot-chev-up"
            :disabled="reel.index <= 0 || spinning"
            aria-label="Previous" @click="step(reel.key, -1)"
          ><span class="i-lucide-chevron-up" aria-hidden="true" /></button>

          <button type="button" class="slot-drum-hit" :aria-label="`Jump ${reel.eyebrow}`" @click="toggleMenu(reel.key)">
            <div class="slot-strip" :style="stripStyle(reel)">
              <div
                v-for="(v, vi) in reel.values" :key="v.id"
                class="slot-cell"
                :class="{ current: vi === reel.index, near: Math.abs(vi - reel.index) === 1 }"
              >{{ v.name }}</div>
            </div>
            <span class="slot-payline" aria-hidden="true" />
          </button>

          <button
            type="button" class="slot-chev slot-chev-down"
            :disabled="reel.index >= reel.values.length - 1 || spinning"
            aria-label="Next" @click="step(reel.key, 1)"
          ><span class="i-lucide-chevron-down" aria-hidden="true" /></button>
        </div>

        <!-- Jump menu (outside the masked window so it isn't clipped/faded) -->
        <ul v-if="menuFor === reel.key" class="slot-menu">
          <li v-for="(v, vi) in reel.values" :key="v.id">
            <button type="button" class="slot-menu-item" :class="{ on: vi === reel.index }" @click="turn(reel.key, vi)">{{ v.name }}</button>
          </li>
        </ul>
      </div>
    </template>
  </nav>
</template>

<style scoped>
/* A recessed machined face — the drums sit in it like a jukebox selection console. */
.slot-console {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  background:
    linear-gradient(180deg, color-mix(in oklab, var(--nui-bg) 92%, black 8%), var(--nui-bg));
  box-shadow: inset 0 1px 0 color-mix(in oklab, var(--nui-fg) 8%, transparent),
              inset 0 -1px 2px color-mix(in oklab, black 18%, transparent),
              0 1px 0 color-mix(in oklab, var(--nui-fg) 6%, transparent);
  border: 1px solid var(--nui-border);
  /* no overflow:hidden — the jump menu must escape; the drum windows clip themselves. */
}
.slot-sep {
  width: 1px;
  align-self: center;
  height: 2.6rem;
  margin: 0 0.6rem;
  background: linear-gradient(180deg, transparent, var(--nui-border) 20%, var(--nui-border) 80%, transparent);
}
.slot-reel { position: relative; display: flex; flex-direction: column; min-width: 6.5rem; flex: 1 1 0; }
.slot-reel.wide { flex: 1.6 1 0; min-width: 9rem; }
.slot-eyebrow {
  font-family: 'Space Mono', ui-monospace, monospace;
  font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--nui-subtle); margin: 0 0 2px 2px;
}

/* The drum window: 5 rows tall, the middle on the payline, edges fading like a spinning cylinder. */
.slot-window {
  position: relative;
  height: 78px; /* 3 * 26 */
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 34%, #000 66%, transparent);
  mask-image: linear-gradient(180deg, transparent, #000 34%, #000 66%, transparent);
}
.slot-drum-hit {
  position: relative; display: block; width: 100%; height: 100%;
  overflow: hidden; cursor: pointer; background: none; border: 0; padding: 0; text-align: left;
}
.slot-strip {
  position: absolute; top: 0; left: 0; right: 0; /* pin to the top so translateY is exact (no auto-centring of a short strip) */
  will-change: transform;
  /* the spring kickback — overshoots the lock then settles */
  transition: transform 460ms cubic-bezier(0.2, 1.5, 0.35, 1);
}
.no-anim .slot-strip { transition: none; }
.slot-cell {
  height: 26px; line-height: 26px;
  font-family: 'Saira', system-ui, sans-serif;
  font-size: 15px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--nui-subtle);
  transform: scale(0.86); transform-origin: left center;
  transition: color 200ms, opacity 200ms, transform 200ms;
  opacity: 0.4;
}
.slot-cell.near { opacity: 0.6; }
.slot-cell.current {
  color: var(--nui-fg); opacity: 1; transform: scale(1);
  font-weight: 600;
}
.slot-reel.wide .slot-cell.current { font-weight: 700; }

/* the payline — two accent ticks bracketing the locked row */
.slot-payline {
  position: absolute; left: 0; right: 0; top: 26px; height: 26px; pointer-events: none;
  border-top: 1px solid color-mix(in oklab, var(--nui-accent) 55%, transparent);
  border-bottom: 1px solid color-mix(in oklab, var(--nui-accent) 55%, transparent);
}

.slot-chev {
  position: absolute; left: 50%; transform: translateX(-50%); z-index: 3;
  width: 26px; height: 18px; display: flex; align-items: center; justify-content: center;
  color: var(--nui-muted); background: none; border: 0; cursor: pointer;
  opacity: 0.28; transition: opacity 150ms, color 150ms; /* faintly present so the drum reads as dial-able */
}
.slot-chev-up { top: -2px; }
.slot-chev-down { bottom: -2px; }
.slot-window:hover .slot-chev,
.slot-chev:focus-visible { opacity: 1; }
.slot-chev:hover { color: var(--nui-accent); }
.slot-chev:disabled { opacity: 0 !important; cursor: default; }
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

@media (prefers-reduced-motion: reduce) {
  .slot-strip { transition-duration: 1ms; }
}
</style>
