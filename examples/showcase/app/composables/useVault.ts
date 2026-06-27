import { ref, computed } from 'vue'
import type { Vault } from '@noy-db/hub'
import { openVaultFromBundle } from '../../src/data/vault'
import { declareCollections } from '../../src/data/collections'

const vault = ref<Vault | null>(null)

export function useVault() {
  async function unlock(secret: string) {
    const bytes = new Uint8Array(await fetch('/demo.noydb').then((r) => r.arrayBuffer()))
    const v = await openVaultFromBundle(bytes, secret) // throws InvalidKeyError on wrong passphrase
    // Re-declare all collections with full config (schema + refs + fieldMeta) so
    // describe() returns rich metadata after reopen, then hydrate.
    const { artists, labels, records } = declareCollections(v)
    await records.list()
    await artists.list()
    await labels.list()
    vault.value = v
  }
  return { vault, unlock, locked: computed(() => vault.value === null) }
}
