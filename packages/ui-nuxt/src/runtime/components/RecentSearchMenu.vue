<script setup lang="ts">
// Recent-searches dropdown: a clock button opens a list of the freshest queries. Each row renders
// the query as friendly pills (astToPills) + a relative timestamp; click applies, × removes, footer
// clears. Recents come in via props (the host wires its history store). Nuxt-UI-free.
import { computed, ref } from 'vue'
import { astToPills } from '@noy-db/ui'
import { parse } from '@noy-db/ui'
import { resolve } from '@noy-db/ui'
import { relativeTime, type HistoryEntry } from '@noy-db/ui'
import type { EntitySchema } from '@noy-db/ui'
import Popover from '../internal/Popover.vue'
import { useNuiI18n } from '../core/i18n'

const props = defineProps<{ schema: EntitySchema; recents: readonly HistoryEntry[] }>()
const emit = defineEmits<{ apply: [q: string]; remove: [q: string]; clear: [] }>()
const { t } = useNuiI18n()

function labelsFor(q: string): string[] {
  try { return astToPills(resolve(parse(q).ast, props.schema), props.schema).map((p) => p.label) } catch { return [q] }
}
// `new Date()` is fine here (browser runtime); recompute lazily per render.
const now = computed(() => Date.now())
</script>

<template>
  <Popover
    align="end"
    :label="recents.length ? t('nui.recent.title', 'Recent searches') : t('nui.recent.none', 'No recent searches')"
    :trigger-class="`nui-icon-btn text-nui-muted size-6 ${recents.length ? '' : 'opacity-40 pointer-events-none'}`"
  >
    <span class="i-lucide-clock size-3.5" aria-hidden="true" />

    <template #content="{ close }">
      <div class="w-80 max-w-[90vw] py-1">
        <div class="flex items-center justify-between px-3 py-1.5 border-b border-nui-border">
          <span class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.recent.title', 'Recent searches') }}</span>
          <button v-if="recents.length" type="button" class="nui-btn-ghost" @click="emit('clear'); close()">{{ t('nui.clear', 'Clear') }}</button>
        </div>

        <ul v-if="recents.length" class="max-h-80 overflow-y-auto py-1" role="listbox">
          <li
            v-for="entry in recents"
            :key="entry.q"
            class="group flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-nui-bg-accent"
            role="option"
            @click="emit('apply', entry.q); close()"
          >
            <div class="flex flex-wrap items-center gap-1 flex-1 min-w-0">
              <span v-for="(lbl, i) in labelsFor(entry.q)" :key="i" class="nui-chip bg-nui-bg-accent text-nui-muted max-w-full">
                <span class="truncate">{{ lbl }}</span>
              </span>
            </div>
            <span class="text-[11px] text-nui-muted shrink-0 tabular-nums">{{ relativeTime(entry.at, now) }}</span>
            <button
              type="button"
              class="shrink-0 opacity-0 group-hover:opacity-100 hover:text-nui-accent"
              :aria-label="t('nui.recent.remove', 'Remove recent search')"
              @click.stop="emit('remove', entry.q)"
            >
              <span class="i-lucide-x size-3.5" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <p v-else class="px-3 py-4 text-sm text-nui-muted text-center">{{ t('nui.recent.empty', 'No recent searches yet.') }}</p>
      </div>
    </template>
  </Popover>
</template>
