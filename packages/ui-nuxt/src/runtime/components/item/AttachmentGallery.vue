<script setup lang="ts">
// Item family — the attachments gallery (Item Release P5). A grid of a record's blob attachments
// (`att:` slots): image thumbnails and file tiles, an upload button, and per-item delete with an
// inline confirm. The item view models come from `attachmentList()` (@noy-db/ui); this component
// owns the objectURL lifecycle for image thumbs (built from host-supplied bytes, revoked on unmount
// and when an item disappears). Vault I/O stays with the host via the `upload`/`remove` events.
import { ref, watch, onUnmounted } from 'vue'
import type { AttachmentItem } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  items: AttachmentItem[]
  /** Host vault read used to build image thumbnails (e.g. `slot => blob(id).get(slot)`). */
  loadBytes: (slot: string) => Promise<Uint8Array | null>
  /** An upload is in flight — disables the add button. */
  busy?: boolean
}>(), { items: () => [], busy: false })

const emit = defineEmits<{ upload: [File]; remove: [slot: string] }>()

const urls = ref<Record<string, string>>({})
const confirming = ref<string | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)

async function syncThumbs(): Promise<void> {
  if (import.meta.server) return
  const wanted = new Set(props.items.filter((i) => i.kind === 'image').map((i) => i.slot))
  for (const slot of Object.keys(urls.value)) {
    if (!wanted.has(slot)) { URL.revokeObjectURL(urls.value[slot]!); const next = { ...urls.value }; delete next[slot]; urls.value = next }
  }
  for (const item of props.items) {
    if (item.kind !== 'image' || urls.value[item.slot]) continue
    const bytes = await props.loadBytes(item.slot)
    if (bytes) urls.value = { ...urls.value, [item.slot]: URL.createObjectURL(new Blob([bytes as BlobPart], { type: item.mime })) }
  }
}
watch(() => props.items.map((i) => i.slot).join('|'), syncThumbs, { immediate: true })
onUnmounted(() => { for (const u of Object.values(urls.value)) URL.revokeObjectURL(u) })

function pick(): void { fileEl.value?.click() }
function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (f) emit('upload', f)
  input.value = '' // allow re-selecting the same file
}
</script>

<template>
  <section class="nui-panel nui-card space-y-3">
    <div class="flex items-center gap-2">
      <span class="i-lucide-paperclip size-4 text-nui-muted" aria-hidden="true" />
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.attachments.title', 'Attachments') }}</h3>
      <span v-if="items.length" class="text-[10px] text-nui-subtle tabular-nums">{{ items.length }}</span>
      <button
        type="button"
        class="nui-btn-ghost text-xs ml-auto flex items-center gap-1 text-nui-muted hover:text-nui-fg"
        :disabled="busy"
        @click="pick"
      >
        <span class="i-lucide-upload size-3.5" aria-hidden="true" />
        {{ busy ? t('nui.attachments.uploading', 'Uploading…') : t('nui.attachments.add', 'Add') }}
      </button>
      <input ref="fileEl" type="file" class="hidden" @change="onFile" >
    </div>

    <p v-if="!items.length" class="text-sm text-nui-subtle">{{ t('nui.attachments.empty', 'No attachments yet.') }}</p>

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
    </ul>
  </section>
</template>

<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
</style>
