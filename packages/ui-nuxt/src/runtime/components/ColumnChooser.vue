<script setup lang="ts">
import { ref, computed } from 'vue'
import Popover from '../internal/Popover.vue'
import { useNuiI18n } from '../core/i18n'

export type ColViz = 'essential' | 'show-sm' | 'show-lg' | 'hidden'

export interface ColDef {
  key: string
  label: string
  /** UnoCSS icon class representing the field type, e.g. 'i-lucide-dollar-sign' */
  icon?: string
  /** Table-defined default visibility; shown as a soft highlight when no user pref is set */
  default?: ColViz
}

const VIZ: { id: ColViz; icon: string; label: string }[] = [
  { id: 'essential', icon: 'i-lucide-shield',     label: 'Essential' },
  { id: 'show-sm',  icon: 'i-lucide-smartphone',  label: 'All screens' },
  { id: 'show-lg',  icon: 'i-lucide-monitor',     label: 'Large screens' },
  { id: 'hidden',   icon: 'i-lucide-eye-off',     label: 'Hidden' },
]

const props = withDefaults(defineProps<{
  columns: ColDef[]
  /** User overrides only — absent key means "use the column default". */
  states?: Record<string, ColViz>
  /** Custom column order (array of keys). Defaults to columns prop order. */
  order?: string[]
}>(), { states: () => ({}), order: () => [] })

const emit = defineEmits<{
  'set-state': [key: string, state: ColViz | null]  // null = reset to default
  reorder: [keys: string[]]
  reset: []
}>()

const { t } = useNuiI18n()

const hasUserPrefs = computed(() => Object.keys(props.states).length > 0)

const orderedColumns = computed(() => {
  if (!props.order.length) return props.columns
  const idx = new Map(props.order.map((k, i) => [k, i]))
  return [...props.columns].sort((a, b) => (idx.get(a.key) ?? 999) - (idx.get(b.key) ?? 999))
})

const defaultOf = (key: string): ColViz | undefined =>
  props.columns.find(c => c.key === key)?.default

// 'user' = explicitly set by user | 'default' = matches table default | 'off' = neither
const btnLevel = (key: string, state: ColViz): 'user' | 'default' | 'off' => {
  const u = props.states[key]
  if (u === state) return 'user'
  if (!u && defaultOf(key) === state) return 'default'
  return 'off'
}

function toggle(key: string, state: ColViz): void {
  // clicking the already user-selected state resets to default
  emit('set-state', key, props.states[key] === state ? null : state)
}

// ── Drag & drop ───────────────────────────────────────────────────────────────
const dragKey = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)

function onDragStart(key: string): void { dragKey.value = key }
function onDragOver(key: string): void  { dragOverKey.value = key }
function onDragEnd(): void              { dragKey.value = null; dragOverKey.value = null }
function onDrop(targetKey: string): void {
  const from = dragKey.value
  if (!from || from === targetKey) { onDragEnd(); return }
  const keys = orderedColumns.value.map(c => c.key)
  const fi = keys.indexOf(from)
  const ti = keys.indexOf(targetKey)
  keys.splice(fi, 1)
  keys.splice(ti, 0, from)
  emit('reorder', keys)
  onDragEnd()
}
</script>

<template>
  <Popover
    align="start"
    :label="hasUserPrefs ? t('nui.columns.titleCustom', 'Columns (custom)') : t('nui.columns.title', 'Columns')"
    trigger-class="nui-btn text-nui-accent-fg hover:bg-white/10"
    active-class="bg-white/15"
  >
    <span class="i-lucide-columns-3 size-3.5" aria-hidden="true" />

    <template #content="{ close }">
      <div class="w-80 max-w-[calc(100vw-2rem)] py-1">

        <!-- Header -->
        <div class="flex items-center justify-between px-3 py-1.5 border-b border-nui-border">
          <span class="text-xs font-medium uppercase tracking-wide text-nui-muted">
            {{ t('nui.columns.title', 'Columns') }}
          </span>
          <button v-if="hasUserPrefs" type="button" class="nui-btn-ghost" @click="emit('reset'); close()">
            {{ t('nui.reset', 'Reset') }}
          </button>
        </div>

        <!-- Column rows -->
        <ul class="py-1 max-h-[min(480px,70vh)] overflow-y-auto" role="listbox">
          <li
            v-for="col in orderedColumns"
            :key="col.key"
            class="flex items-center gap-1.5 px-2 py-1 select-none"
            :class="dragOverKey === col.key && dragKey !== col.key ? 'border-t-2 border-nui-accent' : 'border-t-2 border-transparent'"
            draggable="true"
            @dragstart="onDragStart(col.key)"
            @dragover.prevent="onDragOver(col.key)"
            @drop.prevent="onDrop(col.key)"
            @dragend="onDragEnd"
          >
            <!-- Drag handle -->
            <span class="i-lucide-grip-vertical size-3.5 text-nui-subtle cursor-grab shrink-0" aria-hidden="true" />

            <!-- Field type icon -->
            <span v-if="col.icon" :class="[col.icon, 'size-3.5 text-nui-muted shrink-0']" aria-hidden="true" />
            <span v-else class="size-3.5 shrink-0" />

            <!-- Label — left-aligned -->
            <span class="flex-1 text-left text-sm truncate">{{ col.label }}</span>

            <!-- 4-state visibility buttons -->
            <div class="flex items-center gap-0.5 shrink-0">
              <button
                v-for="opt in VIZ"
                :key="opt.id"
                type="button"
                class="p-0.5 rounded transition-colors hover:bg-nui-bg-accent"
                :title="opt.label"
                @click.stop="toggle(col.key, opt.id)"
              >
                <span
                  :class="[
                    opt.icon, 'size-3.5 block',
                    btnLevel(col.key, opt.id) === 'user'    ? 'text-nui-accent' :
                    btnLevel(col.key, opt.id) === 'default' ? 'text-nui-accent opacity-40' :
                                                              'text-nui-subtle opacity-30'
                  ]"
                  aria-hidden="true"
                />
              </button>
            </div>
          </li>
        </ul>

        <!-- Legend -->
        <div class="flex items-center gap-3 flex-wrap px-3 pt-1.5 pb-1 border-t border-nui-border">
          <span v-for="opt in VIZ" :key="opt.id" class="flex items-center gap-1 text-[10px] text-nui-muted whitespace-nowrap">
            <span :class="[opt.icon, 'size-3 text-nui-accent']" aria-hidden="true" />{{ opt.label }}
          </span>
        </div>
      </div>
    </template>
  </Popover>
</template>
