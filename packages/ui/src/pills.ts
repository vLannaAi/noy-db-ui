// AST → display pills (A7). Each top-level conjunct of the where-tree becomes one pill; sort and
// group keys become their own pills. The search box (Phase 2) renders these and maps clicks back
// to AST edits. Complex OR/grouped subtrees fall back to their serialized form as a single pill.
// See docs/unified-search-and-data-cube-spec.md §3.1.
import type { Ast, Node, Predicate, RawValue } from './ast.js'
import { resolveField, type EntitySchema } from './schema.js'
import { serialize } from './serialize.js'
import { dateLabel } from './dates.js'

export interface Pill {
  /** Stable-ish key for v-for / removal. */
  id: string
  kind: 'filter' | 'text' | 'sort' | 'group' | 'view'
  field?: string
  label: string
  negated?: boolean
  /** Which AST list this pill came from, and its index there — used by removePill. */
  source: 'where' | 'sort' | 'group' | 'show' | 'hide'
  index: number
}

const OP_LABEL: Partial<Record<Predicate['op'], string>> = { gt: '>', gte: '≥', lt: '<', lte: '≤', ne: '≠' }

function valueText(v: RawValue): string {
  if (v.k === 'scalar') return v.v
  if (v.k === 'list') return v.v.join(', ')
  return `${v.from ?? ''}–${v.to ?? ''}`
}

function fieldLabel(schema: EntitySchema, id: string): string {
  return resolveField(schema, id)?.label ?? id
}

function predLabel(schema: EntitySchema, p: Predicate): string {
  const label = fieldLabel(schema, p.field)
  const sym = OP_LABEL[p.op]
  if (sym) return `${label} ${sym} ${valueText(p.value)}`
  // Date fields: show the friendly rolling label ("Last 30 days") rather than the raw token.
  if (p.value.k === 'scalar' && resolveField(schema, p.field)?.type === 'date') return `${label}: ${dateLabel(p.value.v)}`
  return `${label}: ${valueText(p.value)}` // eq / in / range
}

function pillFor(schema: EntitySchema, node: Node, i: number): Pill {
  if (node.t === 'not') {
    const inner = pillFor(schema, node.node, i)
    return { ...inner, id: `n${i}`, negated: true, label: `not ${inner.label}` }
  }
  if (node.t === 'pred') return { id: `f${i}`, kind: 'filter', field: node.field, label: predLabel(schema, node), source: 'where', index: i }
  if (node.t === 'text') return { id: `t${i}`, kind: 'text', label: node.value, source: 'where', index: i }
  // and/or subtree → one fallback pill carrying its serialized form
  return { id: `g${i}`, kind: 'filter', label: serialize({ where: node, sort: [], groupBy: [] }), source: 'where', index: i }
}

export function astToPills(ast: Ast, schema: EntitySchema): Pill[] {
  const pills: Pill[] = []
  const top: Node[] = ast.where ? (ast.where.t === 'and' ? ast.where.nodes : [ast.where]) : []
  top.forEach((n, i) => pills.push(pillFor(schema, n, i)))
  ast.sort.forEach((s, i) =>
    pills.push({ id: `s${i}`, kind: 'sort', field: s.field, label: `Sort: ${fieldLabel(schema, s.field)} ${s.dir === 'desc' ? '↓' : '↑'}`, source: 'sort', index: i }))
  ast.groupBy.forEach((g, i) =>
    pills.push({ id: `gr${i}`, kind: 'group', field: g.field, label: `Group: ${fieldLabel(schema, g.field)}`, source: 'group', index: i }))
  ast.view?.show.forEach((f, i) =>
    pills.push({ id: `sh${i}`, kind: 'view', field: f, label: `Show: ${fieldLabel(schema, f)}`, source: 'show', index: i }))
  ast.view?.hide.forEach((f, i) =>
    pills.push({ id: `hd${i}`, kind: 'view', field: f, label: `Hide: ${fieldLabel(schema, f)}`, source: 'hide', index: i }))
  return pills
}

/** Return a new AST with the given pill removed (top-level where conjunct, or a sort/group key). */
export function removePill(ast: Ast, pill: Pick<Pill, 'source' | 'index'>): Ast {
  if (pill.source === 'sort') return { ...ast, sort: ast.sort.filter((_, i) => i !== pill.index) }
  if (pill.source === 'group') return { ...ast, groupBy: ast.groupBy.filter((_, i) => i !== pill.index) }
  if (pill.source === 'show' || pill.source === 'hide') {
    const view = ast.view ?? { show: [], hide: [] }
    const key = pill.source
    return { ...ast, view: { ...view, [key]: view[key].filter((_, i) => i !== pill.index) } }
  }
  const top: Node[] = ast.where ? (ast.where.t === 'and' ? ast.where.nodes : [ast.where]) : []
  const kept = top.filter((_, i) => i !== pill.index)
  const where: Node | null = kept.length === 0 ? null : kept.length === 1 ? kept[0]! : { t: 'and', nodes: kept }
  return { ...ast, where }
}
