<script setup lang="ts">
// Hand-rolled accessible popover (no Nuxt UI / headless dep). Owns its own a11y: opens on trigger
// click, closes on Escape or outside pointer-down, returns focus to the trigger on close, and moves
// focus into the panel on open. Positioning is a simple below-the-trigger anchor with start/end
// alignment (enough for header-filter menus; collision-aware placement can layer on later).
import { ref, nextTick, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  align?: 'start' | 'end'
  /** Accessible label for the trigger button. */
  label?: string
  /** Classes for the trigger button (the host styles the funnel/affordance). */
  triggerClass?: string
  /** Extra classes applied to the trigger when the panel is open. */
  activeClass?: string
}>(), { align: 'start' })

const emit = defineEmits<{ close: [] }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)

function onDocPointer(e: PointerEvent): void {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) close()
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.stopPropagation(); close() }
}
function listen(on: boolean): void {
  const m = on ? 'addEventListener' : 'removeEventListener'
  document[m]('pointerdown', onDocPointer as EventListener, true)
  document[m]('keydown', onKey as EventListener, true)
}
function openPanel(): void {
  open.value = true
  listen(true)
  nextTick(() => {
    const focusable = panelEl.value?.querySelector<HTMLElement>('input, button, [tabindex]')
    ;(focusable ?? panelEl.value)?.focus()
  })
}
function close(): void {
  if (!open.value) return
  open.value = false
  listen(false)
  emit('close')
  triggerEl.value?.focus()
}
function toggle(): void { open.value ? close() : openPanel() }
onBeforeUnmount(() => listen(false))
</script>

<template>
  <div ref="rootEl" class="relative inline-flex">
    <button
      ref="triggerEl"
      type="button"
      :class="[triggerClass, open && activeClass]"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="label"
      @click="toggle"
    >
      <slot />
    </button>
    <div
      v-if="open"
      ref="panelEl"
      class="nui-panel absolute top-full mt-1 z-50"
      :class="align === 'end' ? 'right-0' : 'left-0'"
    >
      <slot name="content" :close="close" />
    </div>
  </div>
</template>
