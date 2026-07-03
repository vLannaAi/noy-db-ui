<script setup lang="ts" generic="T extends Record<string, any>">
// Item family — a record's read view. Fields (from collection.describe()) render into responsive
// cards: labels/units/enum-labels derive from the metadata, PII is masked via `sensitivity`, and
// entity fields become links (transversal navigation) via `routeFor` + the `navigate` event.
// Cards derive from describe()'s group/order metadata (groupFields); the grid is container-measured
// (useContainerSize), not viewport-measured, like the list. i18n fields read with { locale: 'raw' }
// render one row per language. Schema-driven, Nuxt-UI-free; the edit form (RecordForm) is a sibling.
import { ref, computed } from 'vue'
import type { DescribedField } from '@noy-db/hub'
import { detailFields, formatDetailCell, groupFields, type DetailCell } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'
import { useContainerSize } from '../../core/container'
import NuiText from '../NuiText.vue'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  record: T
  /** `collection.describe().fields` for this record's collection. */
  fields: readonly DescribedField[]
  /** Card grouping override. Omit → derived from describe()'s field.group/order. */
  groups?: { title: string; keys: string[] }[]
  /** Build a route to a referenced record, e.g. (col, id) => `/${col}/~${id}`. */
  routeFor?: (collection: string, id: string) => string
  /** Reveal PII instead of masking. */
  reveal?: boolean
  /** Show an Edit affordance (emits `edit`). */
  editable?: boolean
}>(), { reveal: false, editable: false })

const emit = defineEmits<{ edit: []; navigate: [{ collection: string; id: string }] }>()

const host = ref<HTMLElement | null>(null)
const { width, size } = useContainerSize(host)

const shown = computed(() => detailFields(props.fields))
const byKey = computed(() => new Map(shown.value.map((f) => [f.key, f])))

const cards = computed(() => {
  const groups = props.groups?.length
    ? props.groups.map((g) => ({ title: g.title, fields: g.keys.map((k) => byKey.value.get(k)).filter(Boolean) as DescribedField[] }))
    : groupFields(shown.value, t)
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
  <div ref="host" class="nui-detail space-y-4" :data-nui-size="size">
    <div v-if="editable" class="flex justify-end">
      <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" @click="emit('edit')">
        <span class="i-lucide-pencil size-3.5" aria-hidden="true" /> {{ t('nui.detail.edit', 'Edit') }}
      </button>
    </div>

    <div class="grid gap-4" :class="width >= 992 ? 'grid-cols-2' : 'grid-cols-1'">
      <section v-for="card in cards" :key="card.title" class="nui-panel nui-card">
        <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted mb-3">{{ card.title }}</h3>
        <dl class="grid gap-x-6 gap-y-3" :class="width < 448 ? 'grid-cols-1' : 'grid-cols-2'">
          <div v-for="c in card.cells" :key="c.key" class="min-w-0">
            <dt class="text-xs text-nui-muted">{{ c.label }}</dt>
            <dd class="text-sm mt-0.5" :class="c.empty ? 'text-nui-subtle' : 'text-nui-fg'">
              <a
                v-if="linkHref(c)"
                :href="linkHref(c)"
                class="text-nui-accent hover:underline"
                @click="onLink(c, $event)"
              >{{ c.display }}</a>
              <template v-else-if="c.i18n">
                <span v-for="e in c.i18n" :key="e.locale" class="flex items-baseline gap-1.5 min-w-0">
                  <span
                    class="shrink-0 text-[10px] uppercase leading-4 px-1 rounded border border-nui-border"
                    :class="e.missing ? 'text-nui-subtle opacity-60' : 'text-nui-muted'"
                  >{{ e.locale }}</span>
                  <NuiText :reps="[e.display]" :class="e.missing ? 'text-nui-subtle' : ''" />
                </span>
              </template>
              <NuiText v-else :reps="[c.display]" />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>

<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
[data-nui-size='md'] .nui-card { --nui-card-px: 0.75rem; }
[data-nui-size='sm'] .nui-card { --nui-card-px: 0.625rem; }
</style>
