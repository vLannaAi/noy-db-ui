<script setup lang="ts">
import { onMounted } from 'vue'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'
import { useTour } from '../composables/useTour'
import { usePalette } from '../composables/usePalette'

const { t, locale, setLocale } = useShowcaseI18n()
const theme = useTheme() // { mode, resolved, set } — auto-imported by the module
const { palette, setPalette, initPalette } = usePalette()
const nav = [['/collection', 'nav.collection'], ['/records', 'nav.records'], ['/artists', 'nav.artists'], ['/labels', 'nav.labels']] as const
const { steps, start } = useTour()
const restartTour = () => start(steps.value, { force: true })

onMounted(() => {
  initPalette()
})

const palettes = [
  { id: 'bluenote' as const, label: 'Blue Note', accent: '#1c39bb', accentDark: '#6f86ff' },
  { id: 'hifi' as const, label: 'Hi-Fi', accent: '#c07f00', accentDark: '#ffb000' },
  { id: 'whitelabel' as const, label: 'White Label', accent: '#ff2d78', accentDark: '#ff2d78' },
  { id: 'speed' as const, label: 'Speed', accent: '#bb0231', accentDark: '#e0173f' },
] as const
</script>

<template>
  <div class="nui-shell">
    <aside class="nui-sidebar" data-tour="nav">
      <div class="nui-brand">
        <span class="nui-brand-text">Vinyl</span>
      </div>
      <nav>
        <NuxtLink v-for="[to, key] in nav" :key="to" :to="to" class="nui-nav-link" active-class="nui-nav-link--active">
          {{ t(key) }}
        </NuxtLink>
      </nav>
    </aside>
    <div class="nui-content">
      <header class="nui-header">
        <!-- Palette picker -->
        <div class="nui-palette-picker" data-tour="palette">
          <button
            v-for="p in palettes"
            :key="p.id"
            class="nui-palette-btn"
            :class="{ 'nui-palette-btn--active': palette === p.id }"
            :title="p.label"
            @click="setPalette(p.id)"
          >
            <span
              class="nui-palette-swatch"
              :style="{ background: theme.resolved.value === 'dark' ? p.accentDark : p.accent }"
            />
            <span class="nui-palette-label">{{ p.label }}</span>
          </button>
        </div>
        <!-- Divider -->
        <div class="nui-header-sep" />
        <!-- Light / dark toggle -->
        <button
          class="nui-icon-btn"
          data-tour="theme"
          :title="theme.resolved.value === 'dark' ? 'Light mode' : 'Dark mode'"
          @click="theme.set(theme.resolved.value === 'dark' ? 'light' : 'dark')"
        >◐</button>
        <!-- Language -->
        <select class="nui-lang-select" data-tour="lang" :value="locale" @change="(e: any) => setLocale(e.target.value)">
          <option value="en">EN</option>
          <option value="th">TH</option>
        </select>
        <!-- Tour help -->
        <button class="nui-icon-btn" data-tour="help" @click="restartTour">?</button>
      </header>
      <div class="nui-scroll-area">
        <slot />
      </div>
    </div>
    <TourBalloon />
  </div>
</template>

<style scoped>
/* ── Shell layout ─────────────────────────────────────────────────────────── */

.nui-shell {
  display: flex;
  height: 100dvh;
  overflow: hidden;
  background: var(--nui-bg);
  color: var(--nui-fg);
  font-family: var(--font-body);
  gap: var(--shell-gap, 0);
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */

.nui-sidebar {
  width: 11rem;
  flex-shrink: 0;
  background: var(--nui-bg-accent);
  border-right: var(--border-w) solid var(--hairline);
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nui-brand {
  padding: 0 0.6rem 0.75rem;
  border-bottom: var(--border-w) solid var(--hairline);
  margin-bottom: 0.25rem;
}

.nui-brand-text {
  font-family: var(--font-brand, var(--font-display));
  text-transform: var(--display-transform);
  letter-spacing: var(--display-spacing);
  font-weight: var(--display-weight);
  font-size: 1.1rem;
  color: var(--nui-accent);
}

.nui-sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nui-nav-link {
  display: block;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-control);
  color: var(--nui-muted);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.1s, color 0.1s;
}

.nui-nav-link:hover {
  background: var(--nui-bg);
  color: var(--nui-fg);
}

.nui-nav-link--active {
  background: var(--nui-accent);
  color: var(--nui-accent-fg);
  font-weight: 600;
}

/* ── Content area ─────────────────────────────────────────────────────────── */

.nui-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.nui-scroll-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ── Header ───────────────────────────────────────────────────────────────── */

.nui-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.4rem 0.75rem;
  border-bottom: var(--border-w) solid var(--hairline);
  background: var(--nui-bg-accent);
}

.nui-header-sep {
  flex: 1;
}

/* ── Palette picker ───────────────────────────────────────────────────────── */

.nui-palette-picker {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.nui-palette-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.5rem;
  border: var(--border-w) solid transparent;
  border-radius: var(--radius-control);
  background: none;
  color: var(--nui-muted);
  font-family: var(--font-body);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s, background 0.1s;
  white-space: nowrap;
}

.nui-palette-btn:hover {
  border-color: var(--nui-border);
  color: var(--nui-fg);
}

.nui-palette-btn--active {
  border-color: var(--nui-accent);
  color: var(--nui-fg);
  background: var(--nui-bg);
}

.nui-palette-swatch {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid var(--hairline);
}

.nui-palette-label {
  font-family: var(--font-display);
  text-transform: var(--display-transform);
  letter-spacing: var(--display-spacing);
  font-weight: var(--display-weight);
  font-size: 0.7rem;
}

/* ── Shared controls ──────────────────────────────────────────────────────── */

.nui-icon-btn {
  background: none;
  border: var(--border-w) solid var(--nui-border);
  border-radius: var(--radius-control);
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  color: var(--nui-fg);
  font-size: 0.875rem;
  line-height: 1.4;
  transition: background 0.1s;
}

.nui-icon-btn:hover {
  background: var(--nui-bg);
}

.nui-lang-select {
  font-size: 0.75rem;
  padding: 0.2rem 0.35rem;
  border: var(--border-w) solid var(--nui-border);
  border-radius: var(--radius-control);
  background: var(--nui-bg);
  color: var(--nui-fg);
  font-family: var(--font-body);
  cursor: pointer;
}
</style>
