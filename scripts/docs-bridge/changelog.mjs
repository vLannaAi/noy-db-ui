/**
 * Extract the verbatim markdown body of a CHANGELOG's section for `version`.
 * Returns null when the version has no section — a version-only release for
 * that package.
 *
 * DELIBERATELY NOT byte-identical to noy-db's and noy-db-to's copies, which
 * match a bare `## 0.6.0-pre.16` heading exactly. This repo writes Keep a
 * Changelog: `## [0.3.0-pre.5] — 2026-08-09`. Porting theirs verbatim would
 * match nothing here, so every package would be classified `version-only`,
 * `hasRealDelta` would always be false, and the bridge would never open a
 * doc-sync issue — while looking installed and reporting success.
 *
 * Both forms are accepted so this keeps working if the heading style changes.
 * Matching stays exact on the version itself: `0.3.0` must not match
 * `0.3.0-pre.11`.
 */
const SECTION = /^##\s+(?:\[([^\]]+)\]|(\S+))/

function headingVersion(line) {
  const m = SECTION.exec(line)
  return m ? (m[1] ?? m[2]) : null
}

export function extractSection(changelogText, version) {
  const lines = changelogText.split('\n')
  const start = lines.findIndex((l) => headingVersion(l) === version)
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break }
  }
  return lines.slice(start + 1, end).join('\n').trim() || null
}
