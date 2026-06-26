import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { formatDetailCell, detailFields } from './detail'

// minimal DescribedField builder for the pure formatter (no vault needed)
const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField

describe('formatDetailCell', () => {
  it('formats currency with its unit', () => {
    const c = formatDetailCell(f({ key: 'total', label: 'Total', semanticType: 'currency', unit: '€' }), { total: 100 })
    expect(c.display).toBe('100 €')
  })

  it('shows the enum label, not the code', () => {
    const field = f({ key: 'status', label: 'Status', dict: { name: 's', static: true, values: [{ value: 'paid', label: 'Paid' }] } })
    expect(formatDetailCell(field, { status: 'paid' }).display).toBe('Paid')
  })

  it('resolves an entity field to its name + a ref for routing', () => {
    const field = f({ key: 'buyerId', label: 'Buyer', displayFor: 'buyerName', ref: { target: 'buyers', mode: 'warn' } })
    const c = formatDetailCell(field, { buyerId: 'b1', buyerName: 'ACME' })
    expect(c.display).toBe('ACME')
    expect(c.ref).toEqual({ collection: 'buyers', id: 'b1' })
  })

  it('masks PII unless revealed', () => {
    const field = f({ key: 'pec', label: 'PEC', semanticType: 'email', sensitivity: 'pii' })
    expect(formatDetailCell(field, { pec: 'x@y.it' }).masked).toBe(true)
    expect(formatDetailCell(field, { pec: 'x@y.it' }).display).toBe('••••••')
    const revealed = formatDetailCell(field, { pec: 'x@y.it' }, { reveal: true })
    expect(revealed.masked).toBe(false)
    expect(revealed.href).toBe('mailto:x@y.it')
  })

  it('renders empty values as —', () => {
    const c = formatDetailCell(f({ key: 'note', label: 'Note' }), {})
    expect(c).toMatchObject({ display: '—', empty: true })
  })
})

describe('detailFields', () => {
  it('drops id, audit internals and display-target names', () => {
    const fields = [
      f({ key: 'id' }),
      f({ key: 'buyerId', displayFor: 'buyerName' }),
      f({ key: 'buyerName' }), // display target → hidden (shown via buyerId)
      f({ key: '_internal' }),
      f({ key: 'total' }),
    ]
    expect(detailFields(fields).map((x) => x.key)).toEqual(['buyerId', 'total'])
  })
})
