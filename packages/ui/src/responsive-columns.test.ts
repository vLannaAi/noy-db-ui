import { describe, it, expect } from 'vitest'
import { bucketFor, resolveResponsiveColumns, shouldStack, applyStacking } from './responsive-columns'

const cols = [
  { key: 'reg' },                    // core
  { key: 'date' },                   // core
  { key: 'buyer' },                  // core
  { key: 'outstanding', relevance: 70 },
  { key: 'country', relevance: 60 },
  { key: 'supplier', relevance: 50 },
]

describe('bucketFor', () => {
  it('maps widths to the largest bucket whose min fits', () => {
    expect(bucketFor(0).name).toBe('xs')
    expect(bucketFor(500).name).toBe('sm')
    expect(bucketFor(800).name).toBe('md')
    expect(bucketFor(1200).name).toBe('lg')
    expect(bucketFor(Infinity).name).toBe('lg')
  })
})

describe('resolveResponsiveColumns', () => {
  it('narrow → core columns only', () => {
    expect(resolveResponsiveColumns(cols, 500).map((c) => c.key)).toEqual(['reg', 'date', 'buyer'])
  })
  it('medium → core + outstanding + country (not supplier)', () => {
    expect(resolveResponsiveColumns(cols, 800).map((c) => c.key)).toEqual(['reg', 'date', 'buyer', 'outstanding', 'country'])
  })
  it('wide → everything, original order preserved', () => {
    expect(resolveResponsiveColumns(cols, 1200).map((c) => c.key)).toEqual(['reg', 'date', 'buyer', 'outstanding', 'country', 'supplier'])
  })
  it('Infinity (pre-measurement) shows everything', () => {
    expect(resolveResponsiveColumns(cols, Infinity)).toHaveLength(6)
  })
  it('force-show reveals a hidden column even when narrow (focus / show:)', () => {
    expect(resolveResponsiveColumns(cols, 500, new Set(['country'])).map((c) => c.key)).toEqual(['reg', 'date', 'buyer', 'country'])
  })
})

describe('shouldStack', () => {
  it('only the xs bucket stacks', () => {
    expect(shouldStack(300)).toBe(true)
    expect(shouldStack(500)).toBe(false)
    expect(shouldStack(1200)).toBe(false)
  })
})

describe('applyStacking', () => {
  const visible = [
    { key: 'reg', stackWith: 'date' },
    { key: 'buyer', stackWith: 'country' },
    { key: 'status' },
    { key: 'amount', stackWith: 'outstanding' },
    { key: 'date' }, // present standalone — should be folded away
  ]
  it('off → returns columns unchanged, no folds', () => {
    const r = applyStacking(visible, false)
    expect(r.columns).toHaveLength(5)
    expect(r.folds).toEqual({})
  })
  it('on → folds partners into hosts and drops standalone partners present in the list', () => {
    const r = applyStacking(visible, true)
    expect(r.columns.map((c) => c.key)).toEqual(['reg', 'buyer', 'status', 'amount']) // date folded away
    expect(r.folds).toEqual({ reg: 'date', buyer: 'country', amount: 'outstanding' })
  })
  it('a hidden (hide:) partner is not folded', () => {
    const r = applyStacking(visible, true, new Set(['outstanding']))
    expect(r.folds).toEqual({ reg: 'date', buyer: 'country' })
    expect(r.columns.map((c) => c.key)).toContain('amount')
  })
  it('a force-shown (focus / show: / pin) partner stays standalone, not folded', () => {
    const r = applyStacking(visible, true, new Set(), new Set(['date']))
    expect(r.folds).toEqual({ buyer: 'country', amount: 'outstanding' }) // reg no longer folds date
    expect(r.columns.map((c) => c.key)).toContain('date') // date kept as its own column
  })
})
