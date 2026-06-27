import { schemaFromDescribe } from '@noy-db/ui'
import type { AppColumn } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

interface EntityConfig {
  enumFields?: string[]
  columnOverrides?: Record<string, Partial<AppColumn>>
}

const ENTITY_CONFIG: Record<string, EntityConfig> = {
  artists: {
    enumFields: ['genre'],
    columnOverrides: {
      genre: { filter: 'enum' },
      country: { filter: 'enum' },
      formedYear: { relevance: 50 },
    },
  },
  labels: {
    columnOverrides: {
      country: { filter: 'enum' },
      founded: { relevance: 50 },
    },
  },
}

export function buildSimpleView(vault: Vault, entity: string) {
  const { fieldLabel } = useShowcaseI18n()
  const col = vault.collection(entity)
  const fields = col.describe().fields
  const config = ENTITY_CONFIG[entity] ?? {}
  const schema = schemaFromDescribe(entity, fields, { enumFields: config.enumFields })
  const columns: AppColumn[] = fields
    .filter((f: any) => f.key !== 'id')
    .map((f: any) => ({
      key: f.key,
      label: fieldLabel(entity, f.key),
      sortable: true,
      ...config.columnOverrides?.[f.key],
    }))
  return { schema, columns, rows: col.query().toArray() }
}
