import { defineConfig, presetWind4, presetIcons, transformerVariantGroup, transformerDirectives } from 'unocss'

// @noy-db/ui-nuxt styling config. preset-wind4 = Tailwind-4-compatible utilities (low migration
// friction); preset-icons = pure-CSS `i-lucide-*` icons (no Nuxt UI / @nuxt/icon dependency).
//
// COEXISTENCE: token-bearing colours are namespaced `nui-*` (e.g. `text-nui-muted`,
// `bg-nui-bg-accent`) so the library's pre-compiled CSS never collides with a host app's
// identically-named Tailwind/Nuxt-UI classes (`.text-muted`, …). Plain layout utilities (flex,
// gap-2, rounded) are Tailwind-4-identical, so duplicates are harmless. Colours resolve to
// `--nui-*` CSS variables (see src/style/tokens.css) → a host reskins by setting them on :root.
// transformerVariantGroup gives `hover:(…)`; transformerDirectives enables `@apply` in <style>.
export default defineConfig({
  presets: [
    presetWind4(),
    presetIcons({ scale: 1.1, warn: true }),
  ],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  // The schema-derived data-type icons (see @noy-db/ui FIELD_TYPE_ICON) reach a column header /
  // ColumnChooser as runtime `col.icon` DATA, never as a literal class the scanner can see. Because
  // this package ships a PRE-COMPILED style.css (built from src/runtime/**/*.vue only), those icons
  // must be safelisted or they emit no CSS and render blank. Keep this in sync with FIELD_TYPE_ICON
  // plus the host's type-icon overrides (blob/cover, boolean).
  safelist: [
    'i-lucide-type',         // text
    'i-lucide-hash',         // number
    'i-lucide-calendar',     // date
    'i-lucide-dollar-sign',  // money
    'i-lucide-tags',         // enum
    'i-lucide-link-2',       // entity
    'i-lucide-image',        // blob / cover
    'i-lucide-square-check', // boolean
    'i-lucide-lock',         // read-only field in edit mode
    'i-lucide-chevron-up',      // traverse: prev
    'i-lucide-chevron-down',    // traverse: next
    'i-lucide-chevrons-up',     // traverse: first
    'i-lucide-chevrons-down',   // traverse: last
    'i-lucide-history',         // change-history panel header
    'i-lucide-arrow-right',     // change-history: from → to
    'i-lucide-disc-3',          // related-list summary: record count
    'i-lucide-star',            // related-list summary: avg rating
    'i-lucide-paperclip',       // attachments gallery header
    'i-lucide-upload',          // attachments: add
    'i-lucide-trash-2',         // attachments: delete
    'i-lucide-file',            // attachments: non-image tile
    'i-lucide-list-checks',     // lists (P-D): menu + active-list banner
    'i-lucide-list-plus',       // lists (P-D): detail pin-to-list
    'i-lucide-check',           // lists (P-D): pinned membership
    'i-lucide-plus',            // lists (P-D): add-to-list
  ],
  theme: {
    colors: {
      'nui-fg': 'var(--nui-fg)',
      'nui-accent': 'var(--nui-accent)',
      'nui-accent-fg': 'var(--nui-accent-fg)',
      'nui-muted': 'var(--nui-muted)',
      'nui-subtle': 'var(--nui-subtle)',
      'nui-border': 'var(--nui-border)',
      'nui-bg': 'var(--nui-bg)',
      'nui-bg-accent': 'var(--nui-bg-accent)',
      'nui-danger': 'var(--nui-danger)',
    },
  },
  shortcuts: {
    // composable, app-overridable building blocks ("the adjustable template")
    'nui-chip': 'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs',
    'nui-btn': 'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:(opacity-40 pointer-events-none)',
    'nui-btn-ghost': 'nui-btn text-nui-muted hover:bg-nui-bg-accent',
    'nui-btn-soft': 'nui-btn bg-nui-bg-accent text-nui-muted hover:opacity-80',
    'nui-icon-btn': 'inline-flex items-center justify-center rounded hover:bg-nui-bg-accent',
    'nui-field': 'border border-nui-border rounded px-2 py-1 text-sm bg-nui-bg w-full',
    'nui-panel': 'rounded-lg border border-nui-border bg-nui-bg text-nui-fg shadow-lg',
  },
})
