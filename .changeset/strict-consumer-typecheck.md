---
"@noy-db/ui-nuxt": patch
---

Fix `possibly undefined` type errors in `CollectionList` (`bannerLeadCols`) and `SearchBox`
(`smartQuote`) that surface when a consuming app type-checks the shipped `.vue` runtime under a strict
tsconfig (`noUncheckedIndexedAccess`). Both accesses are guaranteed by surrounding logic; asserted
non-null. No behavior change.
