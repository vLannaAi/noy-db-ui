// Schema-driven form logic — pick the input control for a describe() field. Pure; shared by
// RecordForm (and any custom editor). Validation stays with the collection: the host calls put(),
// noy-db zod-validates, and errors flow back to the form per field.
import type { DescribedField, StandardSchemaV1Issue } from '@noy-db/hub'
import { detailFields } from './detail'

export type InputKind = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'

export interface FieldInput {
  key: string
  label: string
  kind: InputKind
  /** select options (from the field's dictionary, or host-supplied for entity/other fields). */
  options?: { value: string; label: string }[]
}

/** Resolve the input control for a field, honouring its `widget`, then `semanticType`/`type`. */
export function fieldInput(field: DescribedField, extraOptions?: { value: string; label: string }[]): FieldInput {
  const options = extraOptions ?? field.dict?.values?.map((v) => ({ value: v.value, label: v.label ?? v.value }))
  const w = field.widget
  let kind: InputKind = 'text'
  if (options) kind = 'select'
  else if (w === 'textarea') kind = 'textarea'
  else if (w === 'checkbox' || field.type === 'boolean') kind = 'checkbox'
  else if (w === 'date' || field.semanticType === 'date' || field.semanticType === 'datetime') kind = 'date'
  else if (w === 'number' || w === 'money' || field.semanticType === 'currency' || field.semanticType === 'percent' || field.type === 'number') kind = 'number'
  return { key: field.key, label: field.label, kind, options }
}

/** Editable fields for a form: the detail fields minus computed/id/provenance (editable === false). */
export function formFields(fields: readonly DescribedField[]): DescribedField[] {
  return detailFields(fields).filter((f) => f.editable !== false)
}

/**
 * Decompose a failed `put()` into per-field error text for `RecordForm`'s `errors` prop.
 *
 * Maps both `SchemaValidationError` (carrying Standard-Schema-v1 `issues`) and `MissingTranslationError`
 * (duck-typed on `field` + `missing` array) into per-field error messages. For `issues`, we key by the
 * **first** path segment (the top-level field) and keep the first message per field. Duck-typed on
 * `issues` and `field`+`missing` so it's resilient across module realms; a non-validation error
 * (or one with no field path) yields `{}` — the host shows its generic message instead.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  // i18n `required` violation: MissingTranslationError carries the offending field directly
  const mt = err as { field?: unknown; missing?: unknown; message?: unknown } | null | undefined
  if (typeof mt?.field === 'string' && Array.isArray(mt.missing)) {
    return { [mt.field]: String(mt.message ?? 'Missing required translation') }
  }
  const issues = (err as { issues?: readonly StandardSchemaV1Issue[] } | null | undefined)?.issues
  if (!Array.isArray(issues)) return {}
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const seg = issue.path?.[0]
    const key = seg == null ? '' : typeof seg === 'object' ? String((seg as { key: PropertyKey }).key) : String(seg)
    if (key && !(key in out)) out[key] = issue.message
  }
  return out
}
