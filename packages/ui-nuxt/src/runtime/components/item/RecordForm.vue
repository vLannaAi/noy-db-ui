<script setup lang="ts" generic="T extends Record<string, any>">
// Item family — schema-driven create/edit. One input per editable field, the control chosen from
// the field's widget/semanticType (text/textarea/number/date/select/checkbox). Validation belongs
// to the collection: emit `submit` with the edited record, the host calls put() (noy-db zod-validates)
// and passes any per-field `errors` back. Nuxt-UI-free; pairs with RecordDetail (card-matching).
import { ref, watch, computed } from 'vue'
import type { DescribedField } from '@noy-db/hub'
import { fieldInput, formFields, type FieldInput } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  record: T
  /** `collection.describe().fields` for the record's collection. */
  fields: readonly DescribedField[]
  /** Card grouping by field key (view choice). Omit → one card. */
  groups?: { title: string; keys: string[] }[]
  /** Select options for fields the dictionary doesn't cover (e.g. entity refs), keyed by field key. */
  options?: Record<string, { value: string; label: string }[]>
  /** Per-field error text (from a failed put()). */
  errors?: Record<string, string>
  submitting?: boolean
  submitLabel?: string
}>(), { submitting: false })

const emit = defineEmits<{ submit: [value: T]; cancel: [] }>()
// host-supplied label wins; else the translated default
const effSubmitLabel = computed(() => props.submitLabel ?? t('nui.save', 'Save'))

// editable working copy; re-clone when the source record changes
const draft = ref<Record<string, any>>({ ...props.record })
watch(() => props.record, (r) => { draft.value = { ...r } })

const editable = computed(() => formFields(props.fields))
const byKey = computed(() => new Map(editable.value.map((f) => [f.key, f])))
const cards = computed(() => {
  const groups = props.groups?.length
    ? props.groups.map((g) => ({ title: g.title, fields: g.keys.map((k) => byKey.value.get(k)).filter(Boolean) as DescribedField[] }))
    : [{ title: t('nui.detail.details', 'Details'), fields: editable.value }]
  return groups.map((g) => ({ title: g.title, inputs: g.fields.map((f): FieldInput => fieldInput(f, props.options?.[f.key])) }))
})

function submit(): void { if (!props.submitting) emit('submit', { ...draft.value } as T) }
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <section v-for="card in cards" :key="card.title" class="nui-panel p-4">
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted mb-3">{{ card.title }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div v-for="inp in card.inputs" :key="inp.key" class="min-w-0" :class="inp.kind === 'textarea' ? 'sm:col-span-2' : ''">
          <label class="block text-xs text-nui-muted mb-1" :for="`f-${inp.key}`">{{ inp.label }}</label>

          <textarea v-if="inp.kind === 'textarea'" :id="`f-${inp.key}`" v-model="draft[inp.key]" rows="3" class="nui-field" />
          <select v-else-if="inp.kind === 'select'" :id="`f-${inp.key}`" v-model="draft[inp.key]" class="nui-field">
            <option value="">—</option>
            <option v-for="o in inp.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <label v-else-if="inp.kind === 'checkbox'" class="flex items-center gap-2 h-9">
            <input :id="`f-${inp.key}`" v-model="draft[inp.key]" type="checkbox" class="accent-nui-accent"> <span class="text-sm">{{ inp.label }}</span>
          </label>
          <input v-else-if="inp.kind === 'number'" :id="`f-${inp.key}`" v-model.number="draft[inp.key]" type="number" step="any" class="nui-field">
          <input v-else-if="inp.kind === 'date'" :id="`f-${inp.key}`" v-model="draft[inp.key]" type="date" class="nui-field">
          <input v-else :id="`f-${inp.key}`" v-model="draft[inp.key]" type="text" class="nui-field">

          <p v-if="errors?.[inp.key]" class="text-[11px] text-red-500 mt-1">{{ errors[inp.key] }}</p>
        </div>
      </div>
    </section>

    <div class="flex items-center justify-end gap-2">
      <button type="button" class="nui-btn-ghost px-3 py-1.5" :disabled="submitting" @click="emit('cancel')">{{ t('nui.cancel', 'Cancel') }}</button>
      <button type="submit" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" :disabled="submitting">
        {{ submitting ? '…' : effSubmitLabel }}
      </button>
    </div>
  </form>
</template>
