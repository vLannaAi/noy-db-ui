<script setup lang="ts">
import { useRecordItem, useFoundSet, setReturnAnchor, useTraverse, pathSegments, rememberDirection, recallDirection, historyRows, type HistoryRow, type HistorySnapshot } from '@noy-db/ui'
import { diff } from '@noy-db/hub/history'
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'
import { GENRES, FORMATS, CONDITIONS } from '../../../src/data/types'

interface RawHistoryEntry { version: number; timestamp: string; userId: string; record: Record<string, unknown> }

const route = useRoute()
const router = useRouter()
const { vault } = useVault()
const { fieldLabel, enumLabel, locale } = useShowcaseI18n()

const id = route.params.id as string
const records = vault.value!.collection('records')

const item = useRecordItem({ collection: records, id })
await item.load()

// Found-set traversal (spec §4): the list's captured snapshot drives the skim/step cluster;
// a missing record (deleted between capture and visit) auto-advances past it.
const { snapshot } = useFoundSet('records')
// `traverse` is referenced inside its own onSettle closure — safe: the closure only runs on a
// later go()/goTo() call, by which point `const traverse` has been initialized.
const traverse = useTraverse({
  snapshot: () => snapshot.value,
  currentId: () => (route.params.id as string),
  onSettle: (nid) => { rememberDirection('records', traverse.lastDirection.value); router.replace(`/records/${nid}`) },
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
