<script setup lang="ts">
// Item family — the attachments gallery (Item Release P5). A record's blob attachments (`att:`
// slots) as image thumbnails / file tiles, with an upload affordance that is BOTH a drop-zone
// (drag files onto the panel) and a click-to-browse. The item view models come from
// `attachmentList()` (@noy-db/ui); this component owns the objectURL lifecycle for image thumbs
// (revoked on unmount and when an item disappears). Vault I/O stays with the host via `upload`/
// `remove` (one `upload` per file, so a multi-file pick/drop emits several).
import { ref, watch, onUnmounted } from 'vue'
import type { AttachmentItem } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  items: AttachmentItem[]
  /** Host vault read used to build image thumbnails (e.g. `slot => blob(id).get(slot)`). */
  loadBytes: (slot: string) => Promise<Uint8Array | null>
  /** An upload is in flight — disables the add affordance. */
  busy?: boolean
}>(), { items: () => [], busy: false })

const emit = defineEmits<{ upload: [File]; remove: [slot: string] }>()

const urls = ref<Record<string, string>>({})
const confirming = ref<string | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)
// Slots with a loadBytes in flight — the watch can re-fire mid-load, so this guards against a
// second syncThumbs re-issuing the load and double-creating (then leaking) the objectURL.
const inFlight = new Set<string>()

async function syncThumbs(): Promise<void> {
  if (import.meta.server) return
  const wanted = new Set(props.items.filter((i) => i.kind === 'image').map((i) => i.slot))
  for (const slot of Object.keys(urls.value)) {
    if (!wanted.has(slot)) { URL.revokeObjectURL(urls.value[slot]!); const next = { ...urls.value }; delete next[slot]; urls.value = next }
  }
  for (const item of props.items) {
    if (item.kind !== 'image' || urls.value[item.slot] || inFlight.has(item.slot)) continue
    inFlight.add(item.slot)
    let bytes: Uint8Array | null = null
    try { bytes = await props.loadBytes(item.slot) } catch { bytes = null }
    inFlight.delete(item.slot)
    // Post-await: the slot may have been removed, or a URL may already exist — never overwrite
    // (which would strand the previous URL) and never create for a slot that is gone.
    const stillWanted = props.items.some((i) => i.slot === item.slot && i.kind === 'image')
    if (!bytes || !stillWanted || urls.value[item.slot]) continue
    urls.value = { ...urls.value, [item.slot]: URL.createObjectURL(new Blob([bytes as BlobPart], { type: item.mime })) }
  }
}
watch(() => props.items.map((i) => i.slot).join('|'), syncThumbs, { immediate: true })
onUnmounted(() => { for (const u of Object.values(urls.value)) URL.revokeObjectURL(u) })

function pick(): void { fileEl.value?.click() }
function sendFiles(list: FileList | null | undefined): void {
  if (!list) return
  for (const f of Array.from(list)) emit('upload', f)
}
function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  sendFiles(input.files)
  input.value = '' // allow re-selecting the same file
}

// Drag-and-drop: the whole panel is a drop target. A depth counter keeps the highlight steady while
// the cursor crosses child elements (each fires its own dragenter/dragleave).
const dragging = ref(false)
let dragDepth = 0
function onDragEnter(): void { dragDepth += 1; dragging.value = true }
function onDragLeave(): void { dragDepth = Math.max(0, dragDepth - 1); if (dragDepth === 0) dragging.value = false }
function onDrop(e: DragEvent): void {
  dragDepth = 0; dragging.value = false
  if (!props.busy) sendFiles(e.dataTransfer?.files)
}
</script>

<template>
  <section
    class="nui-panel nui-card space-y-3 att-panel"
    :class="{ 'att-dragging': dragging }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="flex items-center gap-2">
      <span class="i-lucide-paperclip size-4 text-nui-muted" aria-hidden="true" />
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.attachments.title', 'Attachments') }}</h3>
      <span v-if="items.length" class="text-[10px] text-nui-subtle tabular-nums">{{ items.length }}</span>
    </div>

    <!-- Empty state IS the drop-zone: drop files, or click to browse. -->
    <button v-if="!items.length" type="button" class="att-zone" :disabled="busy" @click="pick">
      <span class="i-lucide-upload size-5 text-nui-subtle" aria-hidden="true" />
      <span class="att-zone-title">{{ busy ? t('nui.attachments.uploading', 'Uploading…') : t('nui.attachments.drop', 'Drop files here, or click to browse') }}</span>
    </button>

    <!-- Populated: the tiles, with a dashed add-tile that keeps click-to-browse (and drop) available. -->
    <ul v-else class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]">
      <li v-for="item in items" :key="item.slot" class="group nui-panel overflow-hidden flex flex-col">
        <div class="relative aspect-square bg-nui-bg-accent flex items-center justify-center">
          <img v-if="item.kind === 'image' && urls[item.slot]" :src="urls[item.slot]" :alt="item.filename" class="size-full object-cover" >
          <span v-else-if="item.kind === 'image'" class="i-lucide-image size-8 text-nui-subtle animate-pulse" aria-hidden="true" />
          <span v-else class="i-lucide-file size-8 text-nui-subtle" aria-hidden="true" />

          <div v-if="confirming === item.slot" class="absolute inset-0 bg-nui-bg/90 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
            <span class="text-xs text-nui-fg">{{ t('nui.attachments.confirmDelete', 'Delete?') }}</span>
            <div class="flex gap-1.5">
              <button type="button" class="nui-btn text-xs bg-nui-danger text-white px-2 py-0.5" @click="confirming = null; emit('remove', item.slot)">{{ t('nui.delete', 'Delete') }}</button>
              <button type="button" class="nui-btn-ghost text-xs px-2 py-0.5" @click="confirming = null">{{ t('nui.cancel', 'Cancel') }}</button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="absolute top-1 right-1 size-6 rounded-full bg-nui-bg/80 flex items-center justify-center text-nui-muted hover:text-nui-danger opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            :aria-label="t('nui.delete', 'Delete')"
            @click="confirming = item.slot"
          >
            <span class="i-lucide-trash-2 size-3.5" aria-hidden="true" />
          </button>
        </div>
        <div class="p-1.5 min-w-0">
          <p class="text-[11px] text-nui-fg truncate" :title="item.filename">{{ item.filename }}</p>
          <p class="text-[10px] text-nui-subtle tabular-nums">{{ item.humanSize }}</p>
        </div>
      </li>
      <li>
        <button type="button" class="att-add-tile" :disabled="busy" @click="pick">
          <span class="i-lucide-upload size-5" aria-hidden="true" />
          <span class="text-[11px]">{{ busy ? t('nui.attachments.uploading', 'Uploading…') : t('nui.attachments.add', 'Add') }}</span>
        </button>
      </li>
    </ul>

    <!-- Rendered but visually hidden (NOT display:none, so a programmatic click reliably opens the
         file dialog across browsers). `multiple` so a pick can add several at once. -->
    <input
      ref="fileEl" type="file" multiple @change="onFile"
      style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0"
    >

    <div v-if="dragging" class="att-overlay" aria-hidden="true">
      <span class="i-lucide-upload size-5" aria-hidden="true" />
      {{ t('nui.attachments.dropNow', 'Drop to upload') }}
    </div>
  </section>
</template>

<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
.att-panel { position: relative; }
.att-dragging { outline: 2px dashed var(--nui-accent); outline-offset: -3px; }

/* Empty-state drop-zone and the add-tile share the dashed, click-to-browse language. */
.att-zone {
  width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem;
  padding: 1.4rem 1rem; border: 1.5px dashed var(--nui-border); border-radius: var(--radius, 8px);
  background: transparent; color: var(--nui-muted); cursor: pointer;
  transition: border-color 150ms, background 150ms, color 150ms;
}
.att-zone-title { font-size: 0.8rem; }
.att-add-tile {
  width: 100%; aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem;
  border: 1.5px dashed var(--nui-border); border-radius: var(--radius, 8px);
  background: transparent; color: var(--nui-muted); cursor: pointer;
  transition: border-color 150ms, color 150ms;
}
.att-zone:hover:not(:disabled), .att-add-tile:hover:not(:disabled) {
  border-color: var(--nui-accent); color: var(--nui-fg);
  background: color-mix(in oklab, var(--nui-accent) 5%, transparent);
}
.att-zone:disabled, .att-add-tile:disabled { opacity: 0.5; cursor: default; }

.att-overlay {
  position: absolute; inset: 0; z-index: 5; border-radius: inherit; pointer-events: none;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  background: color-mix(in oklab, var(--nui-accent) 12%, var(--nui-bg));
  color: var(--nui-accent); font-size: 0.85rem; font-weight: 600;
}
</style>
