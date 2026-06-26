<script setup lang="ts">
// Column chooser (R9) — a persistent, personal column-visibility control. Each column cycles
// auto → show → hide. 'show' pins it visible at any width; 'hide' always hides; 'auto' defers to
// the responsive rules. Nuxt-UI-free: reuses the hand-rolled Popover.
import { computed } from 'vue'
import Popover from '../internal/Popover.vue'
import { useNuiI18n } from '../core/i18n'

const props = defineProps<{
  columns: { key: string; label: string }[]
  show: string[]
  hide: string[]
}>()
const emit = defineEmits<{ cycle: [key: string]; reset: [] }>()
const { t } = useNuiI18n()

const hasPrefs = computed(() => props.show.length > 0 || props.hide.length > 0)
const stateOf = (k: string): 'auto' | 'show' | 'hide' =>
  props.show.includes(k) ? 'show' : props.hide.includes(k) ? 'hide' : 'auto'
const iconFor = (s: string) => (s === 'show' ? 'i-lucide-eye' : s === 'hide' ? 'i-lucide-eye-off' : 'i-lucide-minus')
</script>

<template>
  <Popover
    align="end"
    :label="hasPrefs ? t('nui.columns.titleCustom', 'Columns (custom)') : t('nui.columns.title', 'Columns')"
    :trigger-class="`nui-btn ${hasPrefs ? 'bg-nui-bg-accent text-nui-accent' : 'text-nui-muted hover:bg-nui-bg-accent'}`"
  >
    <span class="i-lucide-columns-3 size-3.5" aria-hidden="true" />

    <template #content>
      <div class="w-60 py-1">
        <div class="flex items-center justify-between px-3 py-1.5 border-b border-nui-border">
          <span class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.columns.title', 'Columns') }}</span>
          <button v-if="hasPrefs" type="button" class="nui-btn-ghost" @click="emit('reset')">{{ t('nui.reset', 'Reset') }}</button>
        </div>
        <ul class="py-1" role="listbox">
          <li
            v-for="c in columns"
            :key="c.key"
            class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-nui-bg-accent"
            role="option"
            @click="emit('cycle', c.key)"
          >
            <span
              :class="[iconFor(stateOf(c.key)), 'size-3.5 shrink-0', stateOf(c.key) === 'show' ? 'text-nui-accent' : stateOf(c.key) === 'hide' ? 'text-nui-muted' : 'opacity-30']"
              aria-hidden="true"
            />
            <span class="flex-1" :class="stateOf(c.key) === 'hide' ? 'text-nui-muted line-through' : ''">{{ c.label }}</span>
            <span class="text-[10px] uppercase tracking-wide text-nui-muted">{{ t(`nui.columns.${stateOf(c.key)}`, stateOf(c.key)) }}</span>
          </li>
        </ul>
        <p class="px-3 pt-1 text-[11px] text-nui-muted border-t border-nui-border">{{ t('nui.columns.hint', 'Click to cycle auto → show → hide') }}</p>
      </div>
    </template>
  </Popover>
</template>
