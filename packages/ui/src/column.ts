// Column model for the list/table: a view-side description of one column (label, alignment,
// filter kind, aggregate, responsive priority, accessors). Distinct from the data-layer FieldDef
// (which comes from the schema) — an AppColumn is what a view chooses to render and how.
import type { EnumCount } from './summary'

/** Per-column enum breakdown for the second-header row (e.g. Status → draft/to_verify counts). */
export interface SubtotalEnum { items: readonly EnumCount[]; distinctNoun: string }

export interface AppColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  sortable?: boolean
  /** Extra classes for the header + body cells of this column. */
  class?: string
  /** Header filter control. Omit for no filter. */
  filter?: 'enum' | 'entity' | 'date'
  /** Amount column: sum visible rows into the subtotal cell. */
  summable?: boolean
  /** Read the categorical/entity value of a row for enum/entity filtering (default: String(row[key])). */
  enumOf?: (row: Record<string, any>) => string | null | undefined
  /** Read the numeric value of a row for summing (default: Number(row[key])). */
  amountOf?: (row: Record<string, any>) => number
  /** Read the ISO date string of a row for date filtering (default: String(row[key])). */
  dateOf?: (row: Record<string, any>) => string | null | undefined
  /** Format a summed amount for the subtotal cell (default: n.toFixed(2)). */
  formatSum?: (n: number) => string
  /** What to show in this column's second-header cell. enum breakdowns come via `subtotalEnums`. */
  aggregate?: 'count' | 'sum' | 'distinct' | 'dateRange'
  /** Plural noun for a 'distinct' aggregate (e.g. "buyers" → "4 buyers"). */
  aggregateNoun?: string
  /** Sort by several fields at once (a composite ID, e.g. Reg = ['year','numberT']). */
  sortFields?: string[]
  /** Responsive priority (R1). Omit = CORE (always shown). With a value, the column appears only
   *  once the container is wide enough (relevance ≥ the active bucket threshold). */
  relevance?: number
  /** At the narrowest (xs) bucket, fold this other column's value onto a 2nd line of this cell (R6),
   *  e.g. Reg.stackWith='saleDate'. The folded column then isn't shown standalone. */
  stackWith?: string
}
