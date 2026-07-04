<script setup lang="ts">
// Item family — ONE widget renderer per FieldInput kind, shared by RecordForm (create) and
// RecordDetail (in-place edit) so both surfaces stay pixel-consistent. Emits update:modelValue;
// i18n-text edits emit the whole updated locale map. Error/hint lines render under the control.
import { computed } from 'vue'
import type { FieldInput, FieldHint } from '@noy-db/ui'

const props = withDefaults(defineProps<{
  input: FieldInput
  modelValue: any
  error?: string
  hint?: FieldHint
  idPrefix?: string
}>(), { idPrefix: 'f' })

const emit = defineEmits<{ 'update:modelValue': [value: any] }>()
const id = computed(() => `${props.idPrefix}-${props.input.key}`)

const i18nMap = computed<Record<string, string>>(() =>
  (typeof props.modelValue === 'object' && props.modelValue !== null) ? props.modelValue : {})
function setLocale(locale: string, v: string): void {
  emit('update:modelValue', { ...i18nMap.value, [locale]: v })
}
function num(v: string): void {
  emit('update:modelValue', v === '' ? undefined : Number(v))
}
</script>

<template>
  <div class="min-w-0">
    <template v-if="input.kind === 'i18n-text'">
      <div v-for="loc in input.locales" :key="loc" class="flex items-center gap-1.5 mb-1 last:mb-0">
        <span class="shrink-0 text-[10px] uppercase leading-4 px-1 rounded border border-nui-border text-nui-muted">{{ loc }}</span>
        <input
          :id="`${id}-${loc}`" type="text" class="nui-field flex-1"
          :value="i18nMap[loc] ?? ''" @input="setLocale(loc, ($event.target as HTMLInputElement).value)"
        >
      </div>
    </template>
    <textarea
      v-else-if="input.kind === 'textarea'" :id="id" rows="3" class="nui-field w-full"
      :value="modelValue ?? ''" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <select
      v-else-if="input.kind === 'select'" :id="id" class="nui-field w-full"
      :value="modelValue ?? ''" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">—</option>
      <option v-for="o in input.options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <label v-else-if="input.kind === 'checkbox'" class="flex items-center gap-2 h-9">
      <input
        :id="id" type="checkbox" class="accent-nui-accent"
        :checked="!!modelValue" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      > <span class="text-sm">{{ input.label }}</span>
    </label>
    <div v-else-if="input.kind === 'number'" class="flex items-center gap-1.5">
      <input
        :id="id" type="number" step="any" class="nui-field flex-1"
        :value="modelValue ?? ''" @input="num(($event.target as HTMLInputElement).value)"
      >
      <span v-if="input.unit" class="text-xs text-nui-muted shrink-0">{{ input.unit }}</span>
    </div>
    <input
      v-else :id="id" :type="input.kind === 'date' ? 'date' : 'text'" class="nui-field w-full"
      :value="modelValue ?? ''" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >

    <p v-if="error" class="text-[11px] text-red-500 mt-1">{{ error }}</p>
    <p v-else-if="hint?.text" class="text-[11px] text-nui-subtle mt-1">{{ hint.text }}</p>
  </div>
</template>
