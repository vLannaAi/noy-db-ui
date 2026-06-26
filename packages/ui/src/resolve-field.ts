import type { EntitySchema, FieldDef } from './types'

/** Resolve a user-typed field name (canonical id OR alias, case-insensitive) to a FieldDef. */
export function resolveField(schema: EntitySchema, name: string): FieldDef | undefined {
  const n = name.trim().toLowerCase()
  return schema.fields.find(
    (f) => f.id.toLowerCase() === n || f.aliases?.some((a) => a.toLowerCase() === n),
  )
}

/** Ordinal rank of an enum value (unknown/legacy values sort to the end). */
export function ordinalRank(order: readonly string[] | undefined, value: string): number {
  if (!order) return Number.MAX_SAFE_INTEGER
  const i = order.indexOf(value)
  return i === -1 ? order.length : i
}
