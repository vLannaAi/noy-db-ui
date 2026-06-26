import { describe, it, expect } from 'vitest'
import { columnAggregate, singularize, daysBetween } from './aggregate'

describe('singularize', () => {
  it('handles the column nouns', () => {
    expect(singularize('buyers')).toBe('buyer')
    expect(singularize('suppliers')).toBe('supplier')
    expect(singularize('companies')).toBe('company')
    expect(singularize('statuses')).toBe('status')
  })
})

describe('columnAggregate distinct', () => {
  const rows = (vals: string[]) => vals.map((buyerName) => ({ buyerName }))
  it('pluralizes by count, singular at 1', () => {
    expect(columnAggregate(rows(['A', 'B', 'A']), { key: 'buyerName', aggregate: 'distinct', aggregateNoun: 'buyers' })!.text).toBe('2 buyers')
    expect(columnAggregate(rows(['A', 'A']), { key: 'buyerName', aggregate: 'distinct', aggregateNoun: 'buyers' })!.text).toBe('1 buyer')
  })
})

describe('daysBetween / dateRange', () => {
  it('1 Jan → 15 Feb = 45 days', () => {
    expect(daysBetween('2026-01-01', '2026-02-15')).toBe(45)
  })
  it('singular "1 day"', () => {
    const r = columnAggregate([{ d: '2026-01-01' }, { d: '2026-01-02' }], { key: 'd', aggregate: 'dateRange', dateOf: (x) => x.d })
    expect(r!.text).toBe('1 day')
  })
})
