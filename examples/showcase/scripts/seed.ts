import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { dictKey } from '@noy-db/hub/i18n'
import { ref, type Vault } from '@noy-db/hub'
import { toBytes } from '@noy-db/as-noydb'
import { buildVault } from '../src/data/vault'
import { makeCover } from '../src/data/cover'
import { artists, labels, records } from '../src/data/dataset'
import {
  GENRE_LABELS, FORMAT_LABELS, CONDITION_LABELS, FIELD_LABELS,
} from '../src/data/dicts'
import { ArtistSchema, LabelSchema, RecordSchema } from '../src/data/types'

const PASS = 'spin-the-black-circle'

// fieldMeta builder: English label + semanticType from FIELD_LABELS + a small overrides map.
function fieldMeta(collection: string, overrides: Record<string, Record<string, unknown>> = {}) {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [key, l] of Object.entries(FIELD_LABELS[collection]!)) {
    out[key] = { label: l.en, ...(overrides[key] ?? {}) }
  }
  return out
}

export async function seedVault(): Promise<Vault> {
  const { vault } = await buildVault(PASS)

  // --- dictionaries (TH/EN) ---
  const putDict = async (name: string, table: Record<string, { en: string; th: string }>) => {
    const dict = vault.dictionary(name)
    for (const [k, v] of Object.entries(table)) await dict.put(k, { en: v.en, th: v.th })
  }
  await putDict('genre', GENRE_LABELS)
  await putDict('format', FORMAT_LABELS)
  await putDict('condition', CONDITION_LABELS)

  // --- collections ---
  const artistsCol = vault.collection('artists', {
    schema: ArtistSchema,
    dictKeyFields: { genre: dictKey('genre') },
    fieldMeta: fieldMeta('artists', { country: { semanticType: 'country' } }),
    meta: { label: 'Artists' },
  })
  const labelsCol = vault.collection('labels', {
    schema: LabelSchema,
    fieldMeta: fieldMeta('labels', { country: { semanticType: 'country' } }),
    meta: { label: 'Labels' },
  })
  const recordsCol = vault.collection('records', {
    schema: RecordSchema,
    refs: { artistId: ref('artists', 'warn'), labelId: ref('labels', 'warn') },
    dictKeyFields: { genre: dictKey('genre'), format: dictKey('format'), condition: dictKey('condition') },
    blobFields: { cover: { retainDays: 36500 } },
    fieldMeta: fieldMeta('records', {
      artistId: { semanticType: 'entity' },
      labelId: { semanticType: 'entity' },
      priceUsd: { semanticType: 'money', unit: 'USD' },
      durationMin: { semanticType: 'number', unit: 'min' },
      purchasedOn: { semanticType: 'date' },
      notes: { widget: 'textarea' },
      favorite: { widget: 'checkbox' },
    }),
    meta: { label: 'Records' },
  })

  // --- seed rows (records only; blobs are NOT written here — they don't
  //     survive the bundle export, so covers ship as static assets and the
  //     browser writes them into the vault at runtime, see Plan B) ---
  for (const a of artists) await artistsCol.put(a.id, a)
  for (const l of labels) await labelsCol.put(l.id, l)
  for (const r of records) await recordsCol.put(r.id, r)

  return vault
}

/** Cover PNG bytes per record id — written as static assets by `main()`. */
export function coverFiles(): { id: string; bytes: Uint8Array }[] {
  return records.map((r) => ({ id: r.id, bytes: makeCover(r.title) }))
}

// Executed by `pnpm seed`.
async function main() {
  const vault = await seedVault()
  const bytes = await toBytes(vault)
  const here = dirname(fileURLToPath(import.meta.url))
  const publicDir = join(here, '..', 'public')
  await mkdir(publicDir, { recursive: true })
  const out = join(publicDir, 'demo.noydb')
  await writeFile(out, bytes)

  // Covers ship as static assets (blobs don't travel in the bundle).
  const coversDir = join(publicDir, 'covers')
  await mkdir(coversDir, { recursive: true })
  for (const { id, bytes: png } of coverFiles()) {
    await writeFile(join(coversDir, `${id}.png`), png)
  }
  console.log(`wrote ${out} (${bytes.length} bytes) + ${coverFiles().length} covers`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
