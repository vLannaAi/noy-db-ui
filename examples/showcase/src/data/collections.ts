import { ref, type Vault, type Collection } from '@noy-db/hub'
import { i18nText, staticDict } from '@noy-db/hub/i18n'
import { COVER_FIELD } from './vault'
import { ArtistSchema, LabelSchema, RecordSchema, GENRES, FORMATS, CONDITIONS } from './types'
import { FIELD_LABELS, GENRE_LABELS, FORMAT_LABELS, CONDITION_LABELS } from './dicts'

export const NAME_I18N = i18nText({ languages: ['en', 'th'], required: 'any' })
export const TITLE_I18N = i18nText({ languages: ['en', 'th'], required: 'any' })

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
    i18nFields: { name: NAME_I18N },
    fieldMeta: fieldMeta('artists', {
      country: { semanticType: 'country' },
      formedYear: { semanticType: 'number' },
    }),
    meta: { label: 'Artists' },
  })
  const labels = vault.collection('labels', {
    schema: LabelSchema,
    i18nFields: { name: NAME_I18N },
    fieldMeta: fieldMeta('labels', {
      country: { semanticType: 'country' },
      founded: { semanticType: 'number' },
    }),
    meta: { label: 'Labels' },
  })
  const records = vault.collection('records', {
    schema: RecordSchema,
    refs: { artistId: ref('artists', 'warn'), labelId: ref('labels', 'warn') },
    blobFields: { [COVER_FIELD]: { retainDays: 36500 } },
    i18nFields: { title: TITLE_I18N },
    dictKeyFields: {
      genre:     staticDict('genre',     GENRE_LABELS     as Record<string, Record<string, string>>),
      format:    staticDict('format',    FORMAT_LABELS    as Record<string, Record<string, string>>),
      condition: staticDict('condition', CONDITION_LABELS as Record<string, Record<string, string>>),
    },
    fieldMeta: fieldMeta('records', {
      artistId:    { semanticType: 'entity' },
      labelId:     { semanticType: 'entity' },
      year:        { semanticType: 'number' },
      durationMin: { semanticType: 'number', unit: 'min' },
      trackCount:  { semanticType: 'number' },
      rating:      { semanticType: 'number' },
      priceUsd:    { semanticType: 'currency', unit: 'USD' },
      purchasedOn: { semanticType: 'date' },
      notes:       { widget: 'textarea' },
      favorite:    { widget: 'checkbox' },
    }),
    meta: { label: 'Records' },
  })
  return { artists, labels, records }
}
