import { schemaFromDescribe } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

export function buildSimpleView(vault: Vault, entity: string) {
  const { fieldLabel } = useShowcaseI18n()
  const col = vault.collection(entity)
  const fields = col.describe().fields
  const schema = schemaFromDescribe(entity, fields)
  const columns = fields
    .filter((f: any) => f.key !== 'id')
    .map((f: any) => ({ key: f.key, label: fieldLabel(entity, f.key), sortable: true }))
  return { schema, columns, rows: col.query().toArray() }
}
