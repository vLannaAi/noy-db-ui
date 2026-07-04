import { ref, type Vault, type Collection } from '@noy-db/hub'
import { i18nText, staticDict } from '@noy-db/hub/i18n'
import { COVER_FIELD } from './vault'
import { ArtistSchema, LabelSchema, RecordSchema, GENRES, FORMATS, CONDITIONS } from './types'
import { FIELD_LABELS, GENRE_LABELS, FORMAT_LABELS, CONDITION_LABELS } from './dicts'

export const NAME_I18N = i18nText({ languages: ['en', 'th'], required: 'any' })
export const TITLE_I18N = i18nText({ languages: ['en', 'th'], required: 'any' })
export const NOTES_I18N = i18nText({ languages: ['en', 'th'], required: 'any' })

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
      name:       { group: 'Identity', order: 1 },
      country:    { semanticType: 'country', group: 'Identity', order: 2 },
      genre:      { group: 'Career', order: 10 },
      formedYear: { semanticType: 'number', group: 'Career', order: 11 },
    }),
    meta: { label: 'Artists' },
  })
  const labels = vault.collection('labels', {
    schema: LabelSchema,
    i18nFields: { name: NAME_I18N, notes: NOTES_I18N },
    fieldMeta: fieldMeta('labels', {
      name:    { group: 'Identity', order: 1 },
      country: { semanticType: 'country', group: 'Identity', order: 2 },
      founded: { semanticType: 'number', group: 'History', order: 10 },
      notes:   { widget: 'textarea', group: 'History', order: 11 },
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
      title:       { group: 'Identity', order: 1 },
      artistId:    { semanticType: 'entity', group: 'Identity', order: 2 },
      labelId:     { semanticType: 'entity', group: 'Identity', order: 3 },
      year:        { semanticType: 'number', group: 'Release', order: 10 },
      genre:       { group: 'Release', order: 11 },
      format:      { group: 'Release', order: 12 },
      condition:   { group: 'Condition & Value', order: 20 },
      rating:      { semanticType: 'number', group: 'Condition & Value', order: 21 },
      priceUsd:    { semanticType: 'currency', unit: 'USD', group: 'Condition & Value', order: 22 },
      purchasedOn: { semanticType: 'date', group: 'Condition & Value', order: 23 },
      shopUrl:     { semanticType: 'url', group: 'Condition & Value', order: 24 },
      durationMin: { semanticType: 'number', unit: 'min', group: 'Listening', order: 30 },
      trackCount:  { semanticType: 'number', group: 'Listening', order: 31 },
      favorite:    { widget: 'checkbox', group: 'Listening', order: 32 },
      notes:       { widget: 'textarea', group: 'Listening', order: 33 },
    }),
    meta: { label: 'Records' },
  })
  return { artists, labels, records }
}
