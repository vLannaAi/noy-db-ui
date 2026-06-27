import { schemaFromDescribe, joinedSchema, joinedRows } from '@noy-db/ui'
import type { AppColumn, JoinLeg } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'
import { COVER_FIELD } from '../../src/data/vault'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

/**
 * Build the joined schema, column definitions, and joined rows for the records list.
 * Caller must have called .list() on all three collections before invoking this.
 * Joined keys: artist_name = joinedKey('artist', 'name'), label_name = joinedKey('label', 'name').
 * Column labels are localized via useShowcaseI18n (reactive — re-runs on locale change).
 * Enum values in rows are kept CANONICAL (raw keys like 'rock') so the engine can
 * filter/facet/sort correctly. Display localization happens in cell slots.
 */
export function buildRecordsView(vault: Vault) {
  const { fieldLabel } = useShowcaseI18n()

  const records = vault.collection('records')
  const artists = vault.collection('artists')
  const labels = vault.collection('labels')

  const base = schemaFromDescribe('records', records.describe().fields, {
    enumFields: ['genre', 'format', 'condition'],
  })
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
    { key: COVER_FIELD, label: '', class: 'nui-col-cover' },
    { key: 'title', label: fieldLabel('records', 'title'), sortable: true },
    { key: 'artist_name', label: fieldLabel('records', 'artistId'), sortable: true, filter: 'enum' },
    { key: 'label_name', label: fieldLabel('records', 'labelId'), sortable: true, filter: 'enum', relevance: 60 },
    { key: 'year', label: fieldLabel('records', 'year'), sortable: true, align: 'right', relevance: 70 },
    { key: 'genre', label: fieldLabel('records', 'genre'), sortable: true, filter: 'enum', relevance: 65 },
    { key: 'format', label: fieldLabel('records', 'format'), filter: 'enum', relevance: 50 },
    { key: 'condition', label: fieldLabel('records', 'condition'), filter: 'enum', relevance: 45 },
    {
      key: 'rating',
      label: fieldLabel('records', 'rating'),
      sortable: true,
      align: 'right',
      relevance: 55,
      stackWith: 'condition',
    },
    { key: 'durationMin', label: fieldLabel('records', 'durationMin'), align: 'right', relevance: 35 },
    { key: 'trackCount', label: fieldLabel('records', 'trackCount'), align: 'right', relevance: 30 },
    {
      key: 'priceUsd',
      label: fieldLabel('records', 'priceUsd'),
      sortable: true,
      align: 'right',
      summable: true,
      aggregate: 'sum',
      amountOf: (r) => r.priceUsd as number,
      formatSum: (n) => '$' + n.toFixed(0),
      relevance: 75,
    },
    { key: 'purchasedOn', label: fieldLabel('records', 'purchasedOn'), filter: 'date', relevance: 40 },
    { key: 'favorite', label: fieldLabel('records', 'favorite'), relevance: 25 },
  ]

  return { schema, columns, rows }
}
