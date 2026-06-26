import { describe, it, expect } from 'vitest'
import { ref } from '@noy-db/hub'
import { dictKey } from '@noy-db/hub/i18n'
import { toBytes } from '@noy-db/as-noydb'
import { seedVault, coverFiles } from '../../../scripts/seed'
import { openVaultFromBundle } from '../vault'

const PASS = 'spin-the-black-circle'

describe('seeded vault', () => {
  it('round-trips 24 records with joins, covers, and TH/EN labels', async () => {
    const vault = await seedVault()
    const bytes = await toBytes(vault)
    const v = await openVaultFromBundle(bytes, PASS)

    // Reopened caches are empty — declare records with its refs (so joins know
    // their target collections) and hydrate all three collections first (Task 2 finding).
    const records = v.collection('records', {
      refs: { artistId: ref('artists', 'warn'), labelId: ref('labels', 'warn') },
      dictKeyFields: { genre: dictKey('genre'), format: dictKey('format'), condition: dictKey('condition') },
    })
    await records.list()
    await v.collection('artists').list()
    await v.collection('labels').list()
    const rows = records.query().join('artistId', { as: 'artist' }).join('labelId', { as: 'label' }).toArray()
    expect(rows).toHaveLength(24)
    expect((rows[0] as any).artist).toBeTruthy()      // join resolved
    expect((rows[0] as any).label).toBeTruthy()

    const covers = coverFiles()  // covers ship as static PNG assets, not in the bundle
    expect(covers).toHaveLength(24)
    expect(Array.from(covers[0]!.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])

    const en = await records.get('rc01', { locale: 'en' })  // enum label localized (rc01 genre = 'rock')
    const th = await records.get('rc01', { locale: 'th' })
    expect((en as any).genreLabel).toBe('Rock')
    expect((th as any).genreLabel).toBe('ร็อก')
  }, 30_000)
})
