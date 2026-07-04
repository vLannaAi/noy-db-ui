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

describe('formatDetailCell — href scheme safety', () => {
  const url = (v: string) => formatDetailCell(f({ key: 'link', label: 'Link', semanticType: 'url' }), { link: v })
  it('http/https become links', () => {
    expect(url('https://vinyl.example/x').href).toBe('https://vinyl.example/x')
    expect(url('http://vinyl.example/x').href).toBe('http://vinyl.example/x')
  })
  it('javascript:/data:/relative values render as text, not links', () => {
    expect(url('javascript:alert(1)').href).toBeUndefined()
    expect(url('JavaScript:alert(1)').href).toBeUndefined()
    expect(url('data:text/html,<script>x</script>').href).toBeUndefined()
    expect(url('/relative/path').href).toBeUndefined()
    expect(url('javascript:alert(1)').display).toBe('javascript:alert(1)')
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

describe('formatDetailCell — i18n locale maps (raw reads)', () => {
  const nameField = f({ key: 'name', label: 'Name', i18n: { locales: ['en', 'th'] } })

  it('explodes a raw locale map into per-locale entries, display = first non-missing', () => {
    const c = formatDetailCell(nameField, { name: { en: 'Groove Hill', th: 'กรูฟ ฮิลล์' } })
    expect(c.display).toBe('Groove Hill')
    expect(c.i18n).toEqual([
      { locale: 'en', display: 'Groove Hill', missing: false },
      { locale: 'th', display: 'กรูฟ ฮิลล์', missing: false },
    ])
  })

  it('missing locale renders as an empty-dash entry', () => {
    const c = formatDetailCell(nameField, { name: { en: 'Only English' } })
    expect(c.i18n).toEqual([
      { locale: 'en', display: 'Only English', missing: false },
      { locale: 'th', display: '—', missing: true },
    ])
    expect(c.empty).toBe(false)
  })

  it('a resolved-string read (locale collapsed) has no i18n entries', () => {
    expect(formatDetailCell(nameField, { name: 'Groove Hill' }).i18n).toBeUndefined()
  })

  it('all locales missing → empty cell', () => {
    expect(formatDetailCell(nameField, { name: {} }).empty).toBe(true)
  })

  it('sensitivity masking wins over locale explosion', () => {
    const field = f({ key: 'alias', label: 'Alias', sensitivity: 'pii', i18n: { locales: ['en', 'th'] } })
    const c = formatDetailCell(field, { alias: { en: 'x', th: 'y' } })
    expect(c.masked).toBe(true)
    expect(c.i18n).toBeUndefined()
  })
})
