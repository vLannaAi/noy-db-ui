import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { fieldInput, formFields, fieldErrors, fieldHint } from './form'

const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField

describe('fieldInput', () => {
  it('picks controls from widget / semanticType', () => {
    expect(fieldInput(f({ key: 'name' })).kind).toBe('text')
    expect(fieldInput(f({ key: 'notes', widget: 'textarea' })).kind).toBe('textarea')
    expect(fieldInput(f({ key: 'total', semanticType: 'currency', widget: 'money' })).kind).toBe('number')
    expect(fieldInput(f({ key: 'date', semanticType: 'date' })).kind).toBe('date')
    expect(fieldInput(f({ key: 'active', type: 'boolean' })).kind).toBe('checkbox')
  })

  it('makes a select from a dictionary, with labels', () => {
    const inp = fieldInput(f({ key: 'status', dict: { name: 's', static: true, values: [{ value: 'paid', label: 'Paid' }, { value: 'draft' }] } }))
    expect(inp.kind).toBe('select')
    expect(inp.options).toEqual([{ value: 'paid', label: 'Paid' }, { value: 'draft', label: 'draft' }])
  })

  it('accepts host-supplied options (e.g. entity refs)', () => {
    const inp = fieldInput(f({ key: 'buyerId', label: 'Buyer' }), [{ value: 'b1', label: 'ACME' }])
    expect(inp.kind).toBe('select')
    expect(inp.options).toEqual([{ value: 'b1', label: 'ACME' }])
  })
})

describe('fieldInput — phase-3 widgets', () => {
  it('an i18n field becomes an i18n-text input carrying its locales', () => {
    const inp = fieldInput(f({ key: 'title', label: 'Title', i18n: { locales: ['en', 'th'] } }))
    expect(inp.kind).toBe('i18n-text')
    expect(inp.locales).toEqual(['en', 'th'])
  })

  it('a currency field keeps kind number and carries its unit', () => {
    const inp = fieldInput(f({ key: 'price', label: 'Price', semanticType: 'currency', unit: 'USD', type: 'number' }))
    expect(inp.kind).toBe('number')
    expect(inp.unit).toBe('USD')
  })

  it('ref-select with host options is a select; without options it falls back to text', () => {
    const field = f({ key: 'labelId', label: 'Label', widget: 'ref-select', ref: { target: 'labels', mode: 'warn' } })
    expect(fieldInput(field, [{ value: 'lb1', label: 'Groove Hill' }]).kind).toBe('select')
    expect(fieldInput(field).kind).toBe('text')
  })

  it('an integer-typed field (zod .int()) is a number input', () => {
    expect(fieldInput(f({ key: 'year', label: 'Year', type: 'integer' })).kind).toBe('number')
  })
})

describe('fieldHint', () => {
  it('marks non-optional fields required', () => {
    expect(fieldHint(f({ key: 'year', optional: false })).required).toBe(true)
    expect(fieldHint(f({ key: 'notes', optional: true })).required).toBe(false)
  })

  it('composes a numeric range from minimum/maximum', () => {
    expect(fieldHint(f({ key: 'year', constraints: { minimum: 1900, maximum: 2100 } })).text).toBe('1900–2100')
    expect(fieldHint(f({ key: 'price', constraints: { minimum: 0 } })).text).toBe('≥ 0')
  })

  it('composes a length range and a format name', () => {
    expect(fieldHint(f({ key: 'notes', constraints: { maxLength: 300 } })).text).toBe('≤ 300 chars')
    expect(fieldHint(f({ key: 'shopUrl', constraints: { format: 'uri' } })).text).toBe('uri')
  })

  it('no constraints → no text', () => {
    expect(fieldHint(f({ key: 'genre' })).text).toBeUndefined()
  })
})

describe('fieldErrors', () => {
  it('keys issues by the first path segment, first message per field', () => {
    const err = { issues: [
      { message: 'Invalid VAT number', path: ['vatNumber'] },
      { message: 'Required', path: [{ key: 'companyName' }] },   // object segment form
      { message: 'ignored — second on same field', path: ['vatNumber'] },
    ] }
    expect(fieldErrors(err)).toEqual({ vatNumber: 'Invalid VAT number', companyName: 'Required' })
  })

  it('returns {} for non-validation errors (host shows the generic message)', () => {
    expect(fieldErrors(new Error('network down'))).toEqual({})
    expect(fieldErrors(null)).toEqual({})
    expect(fieldErrors({ issues: undefined })).toEqual({})
  })

  it('skips issues with no field path', () => {
    expect(fieldErrors({ issues: [{ message: 'whole-record rule failed', path: [] }] })).toEqual({})
    expect(fieldErrors({ issues: [{ message: 'no path at all' }] })).toEqual({})
  })
})

describe('fieldErrors — MissingTranslationError', () => {
  it('maps a missing-translation failure to its field', () => {
    const err = Object.assign(new Error('Field "title": missing required translation(s): th.'), {
      field: 'title',
      missing: ['th'],
    })
    expect(fieldErrors(err)).toEqual({ title: 'Field "title": missing required translation(s): th.' })
  })

  it('still returns {} for a plain error', () => {
    expect(fieldErrors(new Error('boom'))).toEqual({})
  })
})

describe('formFields', () => {
  it('keeps editable fields, drops computed/id/audit', () => {
    const fields = [
      f({ key: 'id' }),
      f({ key: 'total', editable: false }), // computed
      f({ key: 'name' }),
      f({ key: 'buyerId', displayFor: 'buyerName' }),
      f({ key: 'buyerName' }), // display target
    ]
    expect(formFields(fields).map((x) => x.key)).toEqual(['name', 'buyerId'])
  })
})
