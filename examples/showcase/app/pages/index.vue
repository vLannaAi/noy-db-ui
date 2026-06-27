<script setup lang="ts">
import { ref } from 'vue'
import { useVault } from '../composables/useVault'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

const { unlock } = useVault()
const { t } = useShowcaseI18n()
const pass = ref('')
const error = ref('')
const busy = ref(false)
async function submit() {
  busy.value = true; error.value = ''
  try { await unlock(pass.value); await navigateTo('/records') }
  catch { error.value = t('unlock.error', "That didn't unlock the vault.") }
  finally { busy.value = false }
}
</script>
<template>
  <main class="nui-unlock" data-tour="unlock">
    <h1>{{ t('unlock.title', 'noy-db · Vinyl') }}</h1>
    <p>{{ t('unlock.hint', 'Passphrase hint') }}: <code>spin-the-black-circle</code></p>
    <form @submit.prevent="submit">
      <input v-model="pass" type="password" placeholder="passphrase" autofocus />
      <button :disabled="busy || !pass">{{ t('unlock.button', 'Unlock') }}</button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
  </main>
</template>
