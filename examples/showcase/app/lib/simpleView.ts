import { schemaFromDescribe } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'

export function buildSimpleView(vault: Vault, entity: string) {
  const col = vault.collection(entity)
  const fields = col.describe().fields
  const schema = schemaFromDescribe(entity, fields)
  const columns = fields
    .filter((f: any) => f.key !== 'id')
    .map((f: any) => ({ key: f.key, label: f.label ?? f.key, sortable: true }))
  return { schema, columns, rows: col.query().toArray() }
}
