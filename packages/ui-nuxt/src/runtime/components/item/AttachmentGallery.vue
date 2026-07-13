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

// Short type tag from the extension (e.g. "PNG"), shown before the size.
function ext(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 && i < filename.length - 1 ? filename.slice(i + 1).toUpperCase() : ''
}
</script>

<template>
  <section
    class="nui-panel nui-card att-panel"
    :class="{ 'att-dragging': dragging }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="att-head">
      <span class="i-lucide-paperclip size-4 text-nui-muted" aria-hidden="true" />
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.attachments.title', 'Attachments') }}</h3>
      <span v-if="items.length" class="text-[10px] text-nui-subtle tabular-nums">{{ items.length }}</span>
    </div>

    <!-- A tidy row per file: thumbnail, name + type/size, delete on hover. -->
    <ul v-if="items.length" class="att-list">
      <li v-for="item in items" :key="item.slot" class="att-row">
        <span class="att-thumb">
          <img v-if="item.kind === 'image' && urls[item.slot]" :src="urls[item.slot]" :alt="item.filename" >
          <span v-else-if="item.kind === 'image'" class="i-lucide-image size-4 animate-pulse" aria-hidden="true" />
          <span v-else class="i-lucide-file size-4" aria-hidden="true" />
        </span>
        <span class="att-meta">
          <span class="att-name" :title="item.filename">{{ item.filename }}</span>
          <span class="att-sub">{{ ext(item.filename) ? ext(item.filename) + ' · ' : '' }}{{ item.humanSize }}</span>
        </span>

        <span v-if="confirming === item.slot" class="att-confirm">
          <button type="button" class="del" @click="confirming = null; emit('remove', item.slot)">{{ t('nui.delete', 'Delete') }}</button>
          <button type="button" class="cancel" @click="confirming = null">{{ t('nui.cancel', 'Cancel') }}</button>
        </span>
        <button
          v-else type="button" class="att-del"
          :aria-label="t('nui.delete', 'Delete')" @click="confirming = item.slot"
        >
          <span class="i-lucide-trash-2 size-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <!-- Add / drop affordance — a slim bar below the list, or the whole empty state. -->
    <button type="button" class="att-add" :class="{ 'is-empty': !items.length }" :disabled="busy" @click="pick">
      <span class="i-lucide-upload size-4" aria-hidden="true" />
      <span>{{ busy
        ? t('nui.attachments.uploading', 'Uploading…')
        : items.length ? t('nui.attachments.add', 'Add files') : t('nui.attachments.drop', 'Drop files here, or click to browse') }}</span>
    </button>

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

.att-head { display: flex; align-items: center; gap: 0.5rem; }

/* One clean row per attachment — hairline dividers, no nested card/shadow. */
.att-list { list-style: none; margin: 0.6rem 0 0; padding: 0; }
.att-list > li + li { border-top: 1px solid var(--nui-border); }
.att-row { display: flex; align-items: center; gap: 0.7rem; padding: 0.5rem 0; }
.att-thumb {
  flex: 0 0 auto; width: 38px; height: 38px; border-radius: var(--radius-control, 6px);
  overflow: hidden; background: var(--nui-bg-accent); color: var(--nui-subtle);
  display: flex; align-items: center; justify-content: center;
}
.att-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.att-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.att-name { font-size: 0.82rem; color: var(--nui-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.att-sub { font-size: 0.7rem; color: var(--nui-subtle); font-variant-numeric: tabular-nums; margin-top: 1px; }

.att-del {
  flex: 0 0 auto; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-control, 6px); color: var(--nui-subtle); background: none; border: 0; cursor: pointer;
  opacity: 0; transition: opacity 120ms, color 120ms, background 120ms;
}
.att-row:hover .att-del, .att-del:focus-visible { opacity: 1; }
.att-del:hover { color: var(--nui-danger); background: color-mix(in oklab, var(--nui-danger) 10%, transparent); }

.att-confirm { flex: 0 0 auto; display: flex; align-items: center; gap: 0.35rem; }
.att-confirm button { font-size: 0.72rem; padding: 0.22rem 0.55rem; border-radius: var(--radius-control, 5px); cursor: pointer; border: 0; }
.att-confirm .del { background: var(--nui-danger); color: #fff; }
.att-confirm .cancel { background: var(--nui-bg-accent); color: var(--nui-muted); }

/* Add / drop affordance: a slim dashed bar; taller centered box when it's the empty state. */
.att-add {
  width: 100%; margin-top: 0.7rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.55rem 0.75rem; border: 1.5px dashed var(--nui-border); border-radius: var(--radius, 8px);
  background: transparent; color: var(--nui-muted); cursor: pointer; font-size: 0.8rem;
  transition: border-color 150ms, color 150ms, background 150ms;
}
.att-add.is-empty { flex-direction: column; gap: 0.4rem; padding: 1.5rem 1rem; margin-top: 0.6rem; }
.att-add:hover:not(:disabled) { border-color: var(--nui-accent); color: var(--nui-fg); background: color-mix(in oklab, var(--nui-accent) 5%, transparent); }
.att-add:disabled { opacity: 0.5; cursor: default; }

.att-overlay {
  position: absolute; inset: 0; z-index: 5; border-radius: inherit; pointer-events: none;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  background: color-mix(in oklab, var(--nui-accent) 12%, var(--nui-bg));
  color: var(--nui-accent); font-size: 0.85rem; font-weight: 600;
}
</style>
