import type { Vault } from '@noy-db/hub'
import { COVER_FIELD, COVER_SLOT } from '../../src/data/vault'

// fetchPng defaults to the static asset; injectable for tests.
export async function loadCoverBytes(
  vault: Vault, id: string,
  fetchPng: (id: string) => Promise<Uint8Array> = (i) =>
    fetch(`/covers/${i}.png`).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)),
): Promise<Uint8Array> {
  const png = await fetchPng(id)
  const records = vault.collection('records', { blobFields: { [COVER_FIELD]: { retainDays: 36500 } } })
  await records.blob(id).put(COVER_SLOT, png, { mimeType: 'image/png' })
  const back = await records.blob(id).get(COVER_SLOT)
  if (!back) throw new Error(`cover blob missing for ${id}`)
  return back
}
