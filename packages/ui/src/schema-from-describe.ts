// Derive the search engine's `EntitySchema` from a noy-db `collection.describe()` result.
//
// This is what makes the smart table collection-agnostic: instead of a hand-authored schema
// registry, the search/filter/sort/group engine reads a schema built at runtime from the metadata
// the collection already carries (`fieldMeta` → describe()). The field set, types, enum orderings
// and aliases all come from the data layer.
//
// A small `opts` object supplies the handful of facts that are genuinely VIEW choices, not data
// facts (per the data-vs-view boundary): which free-string fields to facet as enums, and which
// fields free-text search scans. Everything else derives.

import type { DescribedField } from '@noy-db/hub'
import type { EntitySchema, FieldDef, FieldType } from './types'

export interface SchemaFromDescribeOptions {
  /** Free-string fields to treat as faceted enums (e.g. city, country) — a view facet choice. */
  enumFields?: readonly string[]
  /** Fields scanned for bare free-text terms. Defaults to the entity + text fields. */
  textFields?: readonly string[]
  /** Drop fields from the searchable set (e.g. raw audit/id columns) by key. */
  exclude?: readonly string[]
}

/** Map a describe() field (+ its role) to the search engine's coarse FieldType. */
function fieldType(f: DescribedField, isDisplayTarget: boolean, forceEnum: boolean): FieldType {
  if (f.dict || forceEnum) return 'enum'
  if (isDisplayTarget || f.semanticType === 'entity') return 'entity'
  switch (f.semanticType) {
    case 'currency':
      return 'money'
    case 'date':
    case 'datetime':
      return 'date'
    case 'country':
      return 'enum'
    case 'number':
    case 'percent':
      return 'number'
  }
  if (f.type === 'number') return 'number'
  return 'text'
}

/**
 * Build an `EntitySchema` from `collection.describe().fields`. Field types come from
 * semanticType/dict/money/ref, enum orderings from the dictionary's declared value order, aliases
 * from fieldMeta. Every described field is exposed, so the whole record becomes searchable.
 */
export function schemaFromDescribe(
  entity: string,
  described: readonly DescribedField[],
  opts: SchemaFromDescribeOptions = {},
): EntitySchema {
  const enumSet = new Set(opts.enumFields ?? [])
  const excluded = new Set(opts.exclude ?? [])
  // The id side of an entity pairing (buyerId.displayFor = 'buyerName') is internal: its display
  // field carries the searchable entity identity, so skip the id and tag the target as 'entity'.
  const displayTargets = new Set(described.map((f) => f.displayFor).filter(Boolean) as string[])
  const idSides = new Set(described.filter((f) => f.displayFor).map((f) => f.key))

  const fields: FieldDef[] = []
  for (const f of described) {
    if (excluded.has(f.key) || idSides.has(f.key)) continue
    const type = fieldType(f, displayTargets.has(f.key), enumSet.has(f.key))
    const def: FieldDef = { id: f.key, label: f.label, type }
    if (f.aliases?.length) def.aliases = f.aliases
    if (type === 'enum' && f.dict?.values?.length) {
      def.enumOrder = f.dict.values.map((v) => v.value)
    }
    fields.push(def)
  }

  const textFields =
    opts.textFields ?? fields.filter((f) => f.type === 'text' || f.type === 'entity').map((f) => f.id)

  return { entity, fields, textFields }
}
