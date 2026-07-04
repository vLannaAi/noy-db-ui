<script setup lang="ts">
import { useFoundSet, setReturnAnchor, useTraverse, pathSegments, rememberDirection, recallDirection } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'

const route = useRoute()
const router = useRouter()
const { vault } = useVault()

const id = route.params.id as string
const record = await vault.value!.collection('labels').get(id, { locale: 'raw' })
const { fieldLabel } = useShowcaseI18n()
// re-label per active locale (fieldLabel reads the locale ref -> computed re-tracks)
const fields = computed(() => vault.value!.collection('labels').describe().fields.map((f) => {
  const l = fieldLabel('labels', f.key)
  return l === f.key ? f : { ...f, label: l }
}))

// Found-set traversal (spec §4): the list's captured snapshot drives the skim/step cluster;
// a missing record (deleted between capture and visit) auto-advances past it.
const { snapshot } = useFoundSet('labels')
// `traverse` is referenced inside its own onSettle closure — safe: the closure only runs on a
// later go()/goTo() call, by which point `const traverse` has been initialized.
const traverse = useTraverse({
  snapshot: () => snapshot.value,
  currentId: () => (route.params.id as string),
  onSettle: (nid) => { rememberDirection('labels', traverse.lastDirection.value); router.replace(`/labels/${nid}`) },
})
if (!record && snapshot.value) traverse.go(recallDirection('labels'))

function goBack(): void {
  if (snapshot.value) setReturnAnchor('labels', { query: snapshot.value.query, id: String(route.params.id) })
  navigateTo('/labels')
}

// `name` is read raw (a locale map, spec: no re-localizing a frozen found-set label) — use its
// first non-empty translation, falling back to the frozen cursor label, then the bare id.
function firstLocaleValue(map: unknown): string | undefined {
  if (!map || typeof map !== 'object') return undefined
  return Object.values(map as Record<string, string>).find((v) => v)
}
const segments = computed(() => pathSegments({
  item: traverse.cursorItem.value,
  record: null,
  fields: fields.value,
  titleLabel: traverse.cursorItem.value?.label
    ?? firstLocaleValue((record as any)?.name)
    ?? String(route.params.id),
}))
</script>

<template>
  <article v-if="record" class="p-4 space-y-6">
    <TraverseBar
      v-if="snapshot"
      :snapshot="snapshot" :position="traverse.position.value"
      :skimming="traverse.skimming.value"
      @go="traverse.go" @go-to="traverse.goTo" @first="traverse.first" @last="traverse.last" @back="goBack"
    />
    <NuxtLink v-else to="/labels" class="text-sm text-nui-accent hover:underline">← labels</NuxtLink>
    <ItemPath
      :segments="segments"
      @back="goBack"
      @navigate="(r) => navigateTo(`/${r.collection}/${r.id}`)"
    />
    <div :class="traverse.skimming.value ? 'opacity-60 pointer-events-none' : ''">
      <RecordDetail
        :record="record"
        :fields="fields"
        :route-for="(c: string, i: string) => `/${c}/${i}`"
        @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
      />
    </div>
  </article>
  <p v-else class="p-4">Not found.</p>
</template>
