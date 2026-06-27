<script setup lang="ts">
import { useShowcaseI18n } from '../composables/useShowcaseI18n'
const { t, locale, setLocale } = useShowcaseI18n()
const theme = useTheme() // { mode, resolved, set } — auto-imported by the module
const nav = [['/records', 'nav.records'], ['/artists', 'nav.artists'], ['/labels', 'nav.labels']] as const
</script>

<template>
  <div class="nui-shell">
    <aside class="nui-sidebar" data-tour="nav">
      <nav>
        <NuxtLink v-for="[to, key] in nav" :key="to" :to="to" class="nui-nav-link" active-class="nui-nav-link--active">
          {{ t(key) }}
        </NuxtLink>
      </nav>
    </aside>
    <div class="nui-content">
      <header class="nui-header">
        <button class="nui-icon-btn" data-tour="theme" :title="theme.resolved.value === 'dark' ? 'Light mode' : 'Dark mode'" @click="theme.set(theme.resolved.value === 'dark' ? 'light' : 'dark')">◐</button>
        <select class="nui-lang-select" data-tour="lang" :value="locale" @change="(e: any) => setLocale(e.target.value)">
          <option value="en">EN</option>
          <option value="th">TH</option>
        </select>
        <!-- TODO(Task 9): start tour -->
        <button class="nui-icon-btn" data-tour="help">?</button>
      </header>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.nui-shell {
  display: flex;
  min-height: 100dvh;
}

.nui-sidebar {
  width: 11rem;
  flex-shrink: 0;
  background: var(--nui-surface-alt, #f5f5f5);
  border-right: 1px solid var(--nui-border, #e0e0e0);
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nui-sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nui-nav-link {
  display: block;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  color: var(--nui-text, #222);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.1s;
}

.nui-nav-link:hover {
  background: var(--nui-surface-hover, rgba(0,0,0,0.06));
}

.nui-nav-link--active {
  background: var(--nui-accent-soft, rgba(99,102,241,0.12));
  color: var(--nui-accent, #6366f1);
  font-weight: 600;
}

.nui-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.nui-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--nui-border, #e0e0e0);
  background: var(--nui-surface, #fff);
}

.nui-icon-btn {
  background: none;
  border: 1px solid var(--nui-border, #e0e0e0);
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  color: var(--nui-text, #222);
  font-size: 0.875rem;
  line-height: 1.4;
}

.nui-icon-btn:hover {
  background: var(--nui-surface-hover, rgba(0,0,0,0.06));
}

.nui-lang-select {
  font-size: 0.75rem;
  padding: 0.2rem 0.35rem;
  border: 1px solid var(--nui-border, #e0e0e0);
  border-radius: 4px;
  background: var(--nui-surface, #fff);
  color: var(--nui-text, #222);
  cursor: pointer;
}
</style>
