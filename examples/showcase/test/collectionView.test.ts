import { describe, it, expect } from 'vitest'
import { seedVault } from '../scripts/seed'
import { buildRecordsView } from '../app/lib/collectionView'

describe('buildRecordsView', () => {
  it('produces a joined schema + 24 rows with artist/label names', async () => {
    const vault = await seedVault()
    await vault.collection('artists').list()
    await vault.collection('labels').list()
    await vault.collection('records').list()
    const { schema, columns, rows } = buildRecordsView(vault)
    expect(rows).toHaveLength(24)
    expect(columns.some((c) => c.key === 'title')).toBe(true)
    // joinedKey('artist', 'name') === 'artist_name'
    expect((rows[0] as any).artist_name).toBeTruthy()
    expect((rows[0] as any).label_name).toBeTruthy()
    expect(schema.entity).toBe('records')
  }, 30_000)
})
