import { describe, it, expect } from 'vitest'
import { extractSection } from './changelog.mjs'

// This repo's CHANGELOGs are Keep a Changelog: `## [0.3.0-pre.5] — 2026-08-09`.
// noy-db and noy-db-to use a bare `## 0.6.0-pre.16`, and their extractor matches
// that form exactly — porting it verbatim would return null for every package on
// every release, so every changeType would be 'version-only', hasRealDelta would
// be false, and no doc-sync issue would EVER be opened. Silently. These tests
// exist because that failure is invisible at the call site.
const CL = `# Changelog

## [0.3.0-pre.5] — 2026-08-09

### Added
- the thing

## [0.3.0-pre.4] — 2026-08-09

### Changed
- the other thing

## [0.3.0] — 2026-07-01

stable body
`

describe('extractSection', () => {
  it('reads a bracketed, dated heading — the format this repo actually uses', () => {
    expect(extractSection(CL, '0.3.0-pre.5')).toBe('### Added\n- the thing')
  })

  it('stops at the next section', () => {
    expect(extractSection(CL, '0.3.0-pre.4')).toBe('### Changed\n- the other thing')
  })

  it('returns null when the version has no section (a version-only release)', () => {
    expect(extractSection(CL, '0.3.0-pre.99')).toBeNull()
  })

  it('matches exactly — a stable version must not match its own pre-releases', () => {
    expect(extractSection(CL, '0.3.0')).toBe('stable body')
    expect(extractSection('# C\n\n## [0.3.0-pre.1] — x\n\nbody\n', '0.3.0')).toBeNull()
  })

  it('still reads the bare heading the sibling producers use, so the format can change under it', () => {
    expect(extractSection('# C\n\n## 0.3.0-pre.5\n\nbody\n', '0.3.0-pre.5')).toBe('body')
  })

  it('returns null for an empty section rather than an empty string', () => {
    expect(extractSection('# C\n\n## [0.3.0-pre.5] — x\n\n## [0.3.0-pre.4] — y\n\nb\n', '0.3.0-pre.5')).toBeNull()
  })
})
