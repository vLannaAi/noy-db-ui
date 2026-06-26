<script setup lang="ts" generic="T extends Record<string, any>">
// Item family — a record's read view. Fields (from collection.describe()) render into responsive
// cards: labels/units/enum-labels derive from the metadata, PII is masked via `sensitivity`, and
// entity fields become links (transversal navigation) via `routeFor` + the `navigate` event.
// Schema-driven, Nuxt-UI-free; the edit form (RecordForm) is a sibling.
import { computed } from 'vue'
import type { DescribedField } from '@noy-db/hub'
import { detailFields, formatDetailCell, type DetailCell } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  record: T
  /** `collection.describe().fields` for this record's collection. */
  fields: readonly DescribedField[]
  /** Card grouping by field key (a view choice — describe() carries no group hint yet). Omit → one card. */
  groups?: { title: string; keys: string[] }[]
  /** Build a route to a referenced record, e.g. (col, id) => `/${col}/~${id}`. */
  routeFor?: (collection: string, id: string) => string
  /** Reveal PII instead of masking. */
  reveal?: boolean
  /** Show an Edit affordance (emits `edit`). */
  editable?: boolean
}>(), { reveal: false, editable: false })

const emit = defineEmits<{ edit: []; navigate: [{ collection: string; id: string }] }>()

const shown = computed(() => detailFields(props.fields))
const byKey = computed(() => new Map(shown.value.map((f) => [f.key, f])))

const cards = computed(() => {
  const groups = props.groups?.length
    ? props.groups.map((g) => ({ title: g.title, fields: g.keys.map((k) => byKey.value.get(k)).filter(Boolean) as DescribedField[] }))
    : [{ title: t('nui.detail.details', 'Details'), fields: shown.value }]
  return groups.map((g) => ({ title: g.title, cells: g.fields.map((f) => formatDetailCell(f, props.record, { reveal: props.reveal })) }))
})

function linkHref(c: DetailCell): string | undefined {
  if (c.href) return c.href
  if (c.ref && props.routeFor) return props.routeFor(c.ref.collection, c.ref.id)
  return undefined
}
function onLink(c: DetailCell, e: MouseEvent): void {
  if (c.ref) { emit('navigate', c.ref); e.preventDefault() }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="editable" class="flex justify-end">
      <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" @click="emit('edit')">
        <span class="i-lucide-pencil size-3.5" aria-hidden="true" /> {{ t('nui.detail.edit', 'Edit') }}
      </button>
    </div>

    <section v-for="card in cards" :key="card.title" class="nui-panel p-4">
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted mb-3">{{ card.title }}</h3>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div v-for="c in card.cells" :key="c.key" class="min-w-0">
          <dt class="text-xs text-nui-muted">{{ c.label }}</dt>
          <dd class="text-sm mt-0.5 truncate" :class="c.empty ? 'text-nui-subtle' : 'text-nui-fg'">
            <a
              v-if="linkHref(c)"
              :href="linkHref(c)"
              class="text-nui-accent hover:underline"
              @click="onLink(c, $event)"
            >{{ c.display }}</a>
            <template v-else>{{ c.display }}</template>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
