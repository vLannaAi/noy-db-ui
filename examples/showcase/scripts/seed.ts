import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type Vault } from '@noy-db/hub'
import { toBytes } from '@noy-db/as-noydb'
import { buildVault } from '../src/data/vault'
import { makeCover } from '../src/data/cover'
import { artists, labels, records } from '../src/data/dataset'
import { declareCollections } from '../src/data/collections'

const PASS = 'spin-the-black-circle'

export async function seedVault(): Promise<Vault> {
  const { vault } = await buildVault(PASS)

  // Note: enum-value dictionaries are NOT seeded — they do not survive the .noydb
  // bundle (internal _* collections, same as blobs). The bundle carries the raw enum
  // keys (e.g. `genre: 'rock'`); enum values are localized at the app level from
  // dicts.ts (Plan B).

  // --- collections ---
  const { artists: artistsCol, labels: labelsCol, records: recordsCol } = declareCollections(vault)

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
