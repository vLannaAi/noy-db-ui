// Per-column aggregate for the second-header row and the group-rollup banners — one implementation
// so both agree. count → N; sum → decimal (no € symbol, the header says "Amount €"); distinct →
// open-domain count ("4 buyers"); dateRange → the SPAN IN DAYS between first and last date
// ("45 days", with the from→to range as a tooltip). `numeric` drives right-alignment.
import { formatAmount } from './format'

export interface AggregateColumn {
  key: string
  aggregate?: 'count' | 'sum' | 'distinct' | 'dateRange'
  aggregateNoun?: string
  amountOf?: (r: Record<string, any>) => number
  enumOf?: (r: Record<string, any>) => string | null | undefined
  dateOf?: (r: Record<string, any>) => string | null | undefined
}

export interface AggregateResult { text: string; title?: string; numeric: boolean }

/** Naive English singular of a plural noun for count==1 ("buyers"→"buyer", "companies"→"company",
 *  "statuses"→"status"). Good enough for our fixed column nouns. */
export function singularize(plural: string): string {
  if (/ies$/i.test(plural)) return plural.replace(/ies$/i, 'y')
  if (/(s|x|z|ch|sh)es$/i.test(plural)) return plural.replace(/es$/i, '')
  return plural.replace(/s$/i, '')
}

/** Whole days between two ISO dates (max − min); 1/1 → 15/2 = 45. */
export function daysBetween(minISO: string, maxISO: string): number {
  const a = new Date(`${minISO}T00:00:00`).getTime()
  const b = new Date(`${maxISO}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function columnAggregate(rows: readonly Record<string, any>[], col: AggregateColumn): AggregateResult | null {
  switch (col.aggregate) {
    case 'count':
      return { text: String(rows.length), numeric: true }
    case 'sum': {
      const get = col.amountOf ?? ((r) => Number(r[col.key]) || 0)
      let sum = 0
      for (const r of rows) sum += get(r)
      return { text: formatAmount(sum), numeric: true }
    }
    case 'distinct': {
      const get = col.enumOf ?? ((r) => r[col.key])
      const set = new Set<string>()
      for (const r of rows) { const v = get(r); if (v != null && v !== '') set.add(String(v)) }
      const noun = col.aggregateNoun ? (set.size === 1 ? singularize(col.aggregateNoun) : col.aggregateNoun) : ''
      return { text: noun ? `${set.size} ${noun}` : String(set.size), numeric: true }
    }
    case 'dateRange': {
      const get = col.dateOf ?? ((r) => r[col.key])
      let min = ''; let max = ''
      for (const r of rows) {
        const v = get(r); if (v == null || v === '') continue
        const s = String(v)
        if (!min || s < min) min = s
        if (!max || s > max) max = s
      }
      if (!min) return null
      const d = daysBetween(min, max)
      return { text: `${d} ${d === 1 ? 'day' : 'days'}`, title: `${min} → ${max}`, numeric: true }
    }
    default:
      return null
  }
}
