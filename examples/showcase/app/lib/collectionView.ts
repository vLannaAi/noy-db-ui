import { schemaFromDescribe, joinedSchema, joinedRows } from '@noy-db/ui'
import type { AppColumn, JoinLeg } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'
import { COVER_FIELD } from '../../src/data/vault'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

/**
 * Build the joined schema, column definitions, and joined rows for the records list.
 * Caller must have called .list() on all three collections before invoking this.
 * Joined keys: artist_name = joinedKey('artist', 'name'), label_name = joinedKey('label', 'name').
 * Column labels and enum cell values (genre/format/condition) are localized via useShowcaseI18n.
 */
export function buildRecordsView(vault: Vault) {
  const { fieldLabel, enumLabel } = useShowcaseI18n()

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
  const rawRows = joinedRows(records.query().toArray() as Record<string, unknown>[], legs)

  // Localize enum display values for genre, format, condition
  const rows = rawRows.map((r) => ({
    ...r,
    genre: enumLabel('genre', String(r.genre ?? '')),
    format: enumLabel('format', String(r.format ?? '')),
    condition: enumLabel('condition', String(r.condition ?? '')),
  }))

  const columns: AppColumn[] = [
    { key: COVER_FIELD, label: '' },
    { key: 'title', label: fieldLabel('records', 'title'), sortable: true },
    { key: 'artist_name', label: fieldLabel('records', 'artistId'), sortable: true, filter: 'enum' },
    { key: 'label_name', label: fieldLabel('records', 'labelId'), filter: 'enum' },
    { key: 'year', label: fieldLabel('records', 'year'), sortable: true, align: 'right' },
    { key: 'genre', label: fieldLabel('records', 'genre'), sortable: true, filter: 'enum' },
    { key: 'format', label: fieldLabel('records', 'format'), filter: 'enum' },
    { key: 'condition', label: fieldLabel('records', 'condition'), filter: 'enum' },
    { key: 'priceUsd', label: fieldLabel('records', 'priceUsd'), sortable: true, align: 'right' },
  ]

  return { schema, columns, rows }
}
