<script setup lang="ts">
import { useRecordItem, useFoundSet, captureFoundSet, setReturnAnchor, useTraverse, pathSegments, rememberDirection, recallDirection, useCollectionList, narrate, foundSetItems as buildFoundSetItems, historyRows, type HistoryRow, type HistorySnapshot, attachmentList, attachmentSlot, type AttachmentItem } from '@noy-db/ui'
import { diff } from '@noy-db/hub/history'
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'
import { useLists } from '../../composables/useLists'
import { buildRecordsView } from '../../lib/collectionView'
import { GENRES, FORMATS, CONDITIONS } from '../../../src/data/types'

interface RawHistoryEntry { version: number; timestamp: string; userId: string; record: Record<string, unknown> }

const route = useRoute()
const router = useRouter()
const { vault } = useVault()
const { t, fieldLabel, enumLabel, locale } = useShowcaseI18n()

const id = route.params.id as string
const records = vault.value!.collection('records')

const item = useRecordItem({ collection: records, id })
await item.load()

// Found-set traversal (spec §4): the list's captured snapshot drives the skim/step cluster;
// a missing record (deleted between capture and visit) auto-advances past it.
const { snapshot } = useFoundSet('records')

// P-C multi-tab: a forked/cold tab (own empty per-tab store) has no captured snapshot. If the URL
// carries ?q= it is fully derivable (spec §6 invariant 1) — re-evaluate the query through a headless
// list and rebuild the frozen snapshot, so the traverse bar renders in the new tab too (spec D5).
const routeQ = typeof route.query.q === 'string' ? route.query.q : ''
if (!snapshot.value && routeQ && vault.value) {
  const rv = buildRecordsView(vault.value)
  const labelForValue = (field: string, value: string): string | undefined =>
    field === 'priceUsd' ? `$${value}` : rv.entityName(field, value) ?? (enumLabel(field, value) || undefined)
  const rebuilt = useCollectionList({
    baseRows: computed(() => rv.rows as Record<string, any>[]),
    query: ref(routeQ),
    entity: 'records',
    columns: rv.columns,
    defaultSort: [{ field: 'title', dir: 'asc' }],
    schema: () => rv.schema,
    formatGroupLabel: labelForValue,
  })
  captureFoundSet({
    kind: 'query', entity: 'records',
    query: routeQ,
    title: narrate(rebuilt.ast.value, rv.schema, { t, formatValue: labelForValue }).title,
    items: buildFoundSetItems({ lines: rebuilt.groupLines.value as any[], rows: rebuilt.visibleRows.value as any[] }),
    total: rv.rows.length,
    capturedAt: new Date().toISOString(),
  })
}

// `traverse` is referenced inside its own onSettle closure — safe: the closure only runs on a
// later go()/goTo() call, by which point `const traverse` has been initialized. router.replace keeps
// ?q= so the found set survives a further fork/refresh from this tab (P-C).
const withQ = (nid: string): string => `/records/${nid}${routeQ ? `?q=${encodeURIComponent(routeQ)}` : ''}`
const traverse = useTraverse({
  snapshot: () => snapshot.value,
  currentId: () => (route.params.id as string),
  onSettle: (nid) => { rememberDirection('records', traverse.lastDirection.value); router.replace(withQ(nid)) },
})
if (!item.record.value && snapshot.value) traverse.go(recallDirection('records'))

function goBack(): void {
  if (snapshot.value) setReturnAnchor('records', { query: snapshot.value.query, id: String(route.params.id) })
  navigateTo('/records')
}

// async describe({}) → validator-derived optional + constraints drive the hints
const described = await records.describe({})
const fields = computed(() => described.fields.map((f) => {
  const l = fieldLabel('records', f.key)
  return l === f.key ? f : { ...f, label: l }
}))

// ref-select options: entity pickers fed by the target collections (localized names)
const artistRows = await vault.value!.collection('artists').list({ locale: locale.value, fallback: 'any' }) as { id: string; name: string }[]
const labelRows = await vault.value!.collection('labels').list({ locale: locale.value, fallback: 'any' }) as { id: string; name: string }[]
const options = computed(() => ({
  artistId: artistRows.map((a) => ({ value: a.id, label: a.name })),
  labelId: labelRows.map((l) => ({ value: l.id, label: l.name })),
  genre: GENRES.map((v) => ({ value: v, label: enumLabel('genre', v) })),
  format: FORMATS.map((v) => ({ value: v, label: enumLabel('format', v) })),
  condition: CONDITIONS.map((v) => ({ value: v, label: enumLabel('condition', v) })),
}))

// Change-history panel (P4): lazy — fetch versions only when the panel first expands, and refresh
// after a successful edit. history() returns prior versions (raw records); the live record is
// prepended as the current snapshot (no archived actor/timestamp — it renders as "Current").
const historyData = ref<HistoryRow[]>([])
const historyLoading = ref(false)
const historyRequested = ref(false)

async function loadHistory(): Promise<void> {
  historyRequested.value = true
  historyLoading.value = true
  try {
    const entries = (await (records as { history(id: string): Promise<RawHistoryEntry[]> }).history(id))
    const snapshots: HistorySnapshot[] = []
    const current = item.record.value as Record<string, unknown> | null
    if (current) snapshots.push({ version: (entries[0]?.version ?? 0) + 1, record: current })
    for (const e of entries) snapshots.push({ version: e.version, timestamp: e.timestamp, actor: e.userId, record: e.record })
    historyData.value = historyRows(snapshots, (a, b) => diff(a, b), fields.value, { now: Date.now() })
  } finally {
    historyLoading.value = false
  }
}

async function onSave(): Promise<void> {
  const ok = await item.submit()
  if (ok && historyRequested.value) await loadHistory()
}

// Attachments gallery (P5): the record's `att:` blob slots. Session-only (D3) — uploads live in the
// in-memory vault for the session; the cover slot is filtered out by attachmentList.
const blobHandle = records.blob(id)
const attachments = ref<AttachmentItem[]>([])
const uploadBusy = ref(false)
async function refreshAttachments(): Promise<void> {
  attachments.value = attachmentList(await blobHandle.list())
}
async function loadAttachmentBytes(slot: string): Promise<Uint8Array | null> {
  return (await blobHandle.get(slot)) ?? null
}
async function onUpload(file: File): Promise<void> {
  uploadBusy.value = true
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    await blobHandle.put(attachmentSlot(crypto.randomUUID()), bytes, { filename: file.name, ...(file.type ? { mimeType: file.type } : {}) })
    await refreshAttachments()
  } finally {
    uploadBusy.value = false
  }
}
async function onRemoveAttachment(slot: string): Promise<void> {
  await blobHandle.delete(slot)
  await refreshAttachments()
}
onMounted(refreshAttachments)

// Lists (P-D): pin this record into a list even when it doesn't match the list's query — the PATCH
// half of the algebra. Membership shown here is the explicit `patch` set (the detail's domain);
// removing a query-matched member happens in the list view's per-row ✕.
const { lists: recordLists, addItem: addToList, removeItem: removeFromList } = useLists('records')
const listMenuOpen = ref(false)
const isPinned = (l: { patch: string[] }): boolean => l.patch.includes(id)
function toggleList(l: { id: string; patch: string[] }): void {
  isPinned(l) ? removeFromList(l.id, id) : addToList(l.id, id)
}

// Path-shaped detail title (spec D7): the group-by trail when found grouped, else the natural
// artist/label ref axis, terminating in the record's own title.
const segments = computed(() => pathSegments({
  item: traverse.cursorItem.value,
  record: traverse.skimming.value ? null : (item.record.value as Record<string, unknown> | null),
  fields: described.fields,
  naturalOrder: ['labelId', 'artistId'],
  labelFor: (field, id) => options.value[field as 'artistId' | 'labelId']?.find((o) => o.value === id)?.label,
  titleLabel: traverse.cursorItem.value?.label
    ?? (item.record.value ? String((item.record.value as any).title ?? route.params.id) : String(route.params.id)),
}))
</script>

<template>
  <article v-if="item.record.value" class="p-4 space-y-6">
    <TraverseBar
      v-if="snapshot"
      :snapshot="snapshot" :position="traverse.position.value"
      :skimming="traverse.skimming.value" :editing="item.editing.value"
      @go="traverse.go" @go-to="traverse.goTo" @first="traverse.first" @last="traverse.last" @back="goBack"
    />
    <NuxtLink v-else to="/records" class="text-sm text-nui-accent hover:underline">← records</NuxtLink>
    <ItemPath
      :segments="segments"
      @back="goBack"
      @navigate="(r) => navigateTo(`/${r.collection}/${r.id}`)"
    />
    <div :class="traverse.skimming.value ? 'opacity-60 pointer-events-none' : ''">
      <!-- Lists (P-D): pin/unpin this record to a named list (the patch operation). -->
      <div v-if="recordLists.length" class="relative flex justify-end mb-2">
        <button
          type="button"
          class="nui-btn-ghost text-xs flex items-center gap-1 text-nui-muted hover:text-nui-fg"
          :aria-expanded="listMenuOpen"
          @click="listMenuOpen = !listMenuOpen"
        >
          <span class="i-lucide-list-plus size-3.5" aria-hidden="true" /> Lists
        </button>
        <div v-if="listMenuOpen" class="absolute right-0 top-full mt-1 z-50 nui-panel p-1.5 w-56 space-y-0.5 shadow-lg">
          <button
            v-for="l in recordLists"
            :key="l.id"
            type="button"
            class="w-full text-left text-sm px-2 py-1 rounded hover:bg-nui-bg-accent flex items-center gap-2"
            @click="toggleList(l)"
          >
            <span class="size-4 shrink-0 flex items-center justify-center" :class="isPinned(l) ? 'text-nui-accent' : 'text-nui-subtle'">
              <span :class="isPinned(l) ? 'i-lucide-check' : 'i-lucide-plus'" class="size-3.5" aria-hidden="true" />
            </span>
            <span class="truncate text-nui-fg">{{ l.name }}</span>
          </button>
        </div>
      </div>
      <CoverImage :id="id" />
      <RecordDetail
        :record="item.record.value"
        :fields="fields"
        editable
        :editing="item.editing.value"
        :draft="item.draft.value"
        :errors="item.errors.value"
        :error-banner="item.errorBanner.value"
        :options="options"
        :submitting="item.submitting.value"
        :route-for="(c: string, i: string) => `/${c}/${i}`"
        @edit="item.enterEdit"
        @save="onSave"
        @cancel="item.cancel"
        @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
      />
      <AttachmentGallery
        class="mt-4"
        :items="attachments"
        :load-bytes="loadAttachmentBytes"
        :busy="uploadBusy"
        @upload="onUpload"
        @remove="onRemoveAttachment"
      />
      <RecordHistory
        class="mt-4"
        :rows="historyData"
        :loading="historyLoading"
        @expand="loadHistory"
      />
    </div>
  </article>
  <p v-else class="p-4">Not found.</p>
</template>
