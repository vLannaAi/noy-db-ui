// @noy-db/ui — framework-agnostic base of the noy-db UI family.
//
// The domain-free DATA core + the pure SEARCH ENGINE + the `useCollectionList` composable + the
// detail/form field resolvers. The Vue/Nuxt components live in the binding packages
// (@noy-db/ui-nuxt, …) which import from here. Destined for the noy-db monorepo.

// schema shape + resolver
export type { EntitySchema, FieldDef, FieldType } from './types'
export { resolveField, ordinalRank } from './resolve-field'

// schema-derived data-type icons (column chooser / header type indicators)
export { FIELD_TYPE_ICON, fieldTypeIcon } from './field-icons'

// responsive width engine: fit-the-container column sizing (no horizontal overflow)
export {
  WIDTH_ARCHETYPES, archetypeForFieldType, selectColumns, distributeWidths, fitColumns,
  type WidthArchetype, type ArchetypeSpec, type SizedColumn,
} from './column-width'

// adaptive text: fit a value into a width via abbreviate → condense → wrap → ellipsis
export {
  fitText, repsFor, compactNumber,
  type FitTreatment, type FitOptions, type TextKind,
} from './adaptive-text'

// describe()-driven schema + cross-collection joins
export { schemaFromDescribe, type SchemaFromDescribeOptions } from './schema-from-describe'
export { joinedSchema, joinedRows, joinedKey, type JoinLeg } from './collection-source'

// search engine (Pass 1): AST → parse → resolve* → evaluate (filter+sort) → group/summary/pills
// (*resolve stays app-side until value-synonyms are made injectable)
export * from './ast'
export * from './tokenize'
export * from './parse'
export * from './serialize'
export * from './resolve'
export * from './evaluate'
export * from './group'
export * from './summary'
export * from './dates'
export * from './pills'
export * from './narrate'
export * from './column-filter'

// filter value types — explicit so they win over column-filter's re-export of Facet/EntityFacets
export type { ColumnFilterValue, Facet, EntityFacets, FilterChip } from './table-filter'

// value-synonym mechanism (the host registers its domain table via registerSynonyms)
export {
  registerSynonyms, normalizeTerm, resolveSynonym, hasSynonyms, synonymCanonicals,
  type SynonymTable,
} from './synonyms'

// column model (view-side description of a list column)
export type { AppColumn, SubtotalEnum } from './column'

// the list composable: query string ⇄ AST → rows/facets/subtotals/grouping/column prefs
export { useCollectionList, type DisplayLine, type GroupLine, type RowLine } from './use-collection-list'

// Item family: detail-view value formatting + schema-driven form input resolution
export { formatDetailCell, detailFields, type DetailCell } from './detail'
export { groupFields, type FieldGroup } from './groups'
export { fieldInput, formFields, fieldErrors, type FieldInput, type InputKind } from './form'

// search-box + saved/recent/NL search logic (domain-free; storage data supplied by the host)
export * from './suggest'
export * from './history'
export * from './saved'
export * from './nl'

// table utilities: formatting, column aggregates, responsive column resolution, column prefs
export * from './format'
export * from './aggregate'
export * from './responsive-columns'
export * from './use-column-prefs'

// shipped locale catalogs for the engine's own strings (hosts spread into their translator)
export { LOCALE_TH } from './locale-th'
