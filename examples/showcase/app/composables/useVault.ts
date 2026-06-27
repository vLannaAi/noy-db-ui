import { ref, computed } from 'vue'
import type { Vault } from '@noy-db/hub'
import { ref as nref } from '@noy-db/hub'
import { openVaultFromBundle } from '../../src/data/vault'

const vault = ref<Vault | null>(null)

export function useVault() {
  async function unlock(secret: string) {
    const bytes = new Uint8Array(await fetch('/demo.noydb').then((r) => r.arrayBuffer()))
    const v = await openVaultFromBundle(bytes, secret) // throws InvalidKeyError on wrong passphrase
    // Re-declare records with refs (needed for joins) and hydrate all collections.
    v.collection('records', { refs: { artistId: nref('artists', 'warn'), labelId: nref('labels', 'warn') } })
    await v.collection('records').list()
    await v.collection('artists').list()
    await v.collection('labels').list()
    vault.value = v
  }
  return { vault, unlock, locked: computed(() => vault.value === null) }
}
