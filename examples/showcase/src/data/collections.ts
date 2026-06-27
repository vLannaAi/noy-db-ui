import { ref, type Vault, type Collection } from '@noy-db/hub'
import { COVER_FIELD } from './vault'
import { ArtistSchema, LabelSchema, RecordSchema } from './types'
import { FIELD_LABELS } from './dicts'

// fieldMeta builder: English label + per-field overrides.
function fieldMeta(collection: string, overrides: Record<string, Record<string, unknown>> = {}) {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [key, l] of Object.entries(FIELD_LABELS[collection]!)) {
    out[key] = { label: l.en, ...(overrides[key] ?? {}) }
  }
  return out
}

export function declareCollections(vault: Vault): {
  artists: Collection<any>
  labels: Collection<any>
  records: Collection<any>
} {
  const artists = vault.collection('artists', {
    schema: ArtistSchema,
    fieldMeta: fieldMeta('artists', { country: { semanticType: 'country' } }),
    meta: { label: 'Artists' },
  })
  const labels = vault.collection('labels', {
    schema: LabelSchema,
    fieldMeta: fieldMeta('labels', { country: { semanticType: 'country' } }),
    meta: { label: 'Labels' },
  })
  const records = vault.collection('records', {
    schema: RecordSchema,
    refs: { artistId: ref('artists', 'warn'), labelId: ref('labels', 'warn') },
    blobFields: { [COVER_FIELD]: { retainDays: 36500 } },
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
  return { artists, labels, records }
}
