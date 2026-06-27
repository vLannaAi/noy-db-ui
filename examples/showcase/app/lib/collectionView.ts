import { schemaFromDescribe, joinedSchema, joinedRows } from '@noy-db/ui'
import type { AppColumn, JoinLeg } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'
import { COVER_FIELD } from '../../src/data/vault'

/**
 * Build the joined schema, column definitions, and joined rows for the records list.
 * Caller must have called .list() on all three collections before invoking this.
 * Joined keys: artist_name = joinedKey('artist', 'name'), label_name = joinedKey('label', 'name').
 */
export function buildRecordsView(vault: Vault) {
  const records = vault.collection('records')
  const artists = vault.collection('artists')
  const labels = vault.collection('labels')

  const base = schemaFromDescribe('records', records.describe().fields)
  const artistsSchema = schemaFromDescribe('artists', artists.describe().fields)
  const labelsSchema = schemaFromDescribe('labels', labels.describe().fields)

  const legs: JoinLeg[] = [
    {
      schema: artistsSchema,
      rows: artists.query().toArray() as Record<string, unknown>[],
      localKey: 'artistId',
      fields: ['name'],
      as: 'artist',
    },
    {
      schema: labelsSchema,
      rows: labels.query().toArray() as Record<string, unknown>[],
      localKey: 'labelId',
      fields: ['name'],
      as: 'label',
    },
  ]

  const schema = joinedSchema(base, legs)
  const rows = joinedRows(records.query().toArray() as Record<string, unknown>[], legs)

  const columns: AppColumn[] = [
    { key: COVER_FIELD, label: '' },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'artist_name', label: 'Artist', sortable: true, filter: 'enum' },
    { key: 'label_name', label: 'Label', filter: 'enum' },
    { key: 'year', label: 'Year', sortable: true, align: 'right' },
    { key: 'genre', label: 'Genre', sortable: true, filter: 'enum' },
    { key: 'format', label: 'Format', filter: 'enum' },
    { key: 'condition', label: 'Condition', filter: 'enum' },
    { key: 'priceUsd', label: 'Price', sortable: true, align: 'right' },
  ]

  return { schema, columns, rows }
}
