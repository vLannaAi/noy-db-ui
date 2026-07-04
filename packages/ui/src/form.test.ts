import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { fieldInput, formFields, fieldErrors } from './form'

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
