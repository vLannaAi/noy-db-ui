import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPayload, hasRealDelta, isFirstPublishFromError } from './build-payload.mjs'

/** A throwaway repo: packages/<dir>/{package.json,CHANGELOG.md}. */
function fixture(pkgs) {
  const root = mkdtempSync(join(tmpdir(), 'ui-bridge-'))
  for (const [dir, { name, version, description, peer, changelog }] of Object.entries(pkgs)) {
    const d = join(root, 'packages', dir)
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      name, version, description,
      ...(peer ? { peerDependencies: { '@noy-db/hub': peer } } : {}),
    }))
    if (changelog) writeFileSync(join(d, 'CHANGELOG.md'), changelog)
  }
  return root
}

const CL = (v) => `# Changelog\n\n## [${v}] — 2026-08-09\n\n### Added\n- a thing\n`
const V = '0.3.0-pre.6'
const THREE = {
  ui: { name: '@noy-db/ui', version: V, description: 'engine', peer: '^0.6.0-pre.0', changelog: CL(V) },
  'ui-nuxt': { name: '@noy-db/ui-nuxt', version: V, description: 'nuxt', peer: '^0.6.0-pre.0', changelog: CL(V) },
  'ui-suai': { name: '@noy-db/ui-suai', version: V, description: 'suai', peer: '^0.6.0-pre.0', changelog: CL(V) },
}
const build = (pkgs, over = {}) => {
  const root = fixture(pkgs)
  try {
    return buildPayload({
      rootDir: root, tag: `v${V}`, channel: 'next', runUrl: 'http://run',
      isFirstPublish: () => false, ...over,
    })
  } finally { rmSync(root, { recursive: true, force: true }) }
}

describe('buildPayload', () => {
  it('emits the bridge: 1 schema noy-db-docs parses, self-identifying as this repo', () => {
    const p = build(THREE)
    expect(p.bridge).toBe(1)
    expect(p.repo).toBe('vLannaAi/noy-db-ui')
    expect(p).toMatchObject({ version: V, tag: `v${V}`, channel: 'next', runUrl: 'http://run' })
  })

  // The whole point of deriving from the filesystem: noy-db-to's bridge broke
  // twice because a new package was missing from a hard-coded WIRING table.
  // There is no table here to fall out of date.
  it('derives the package set from packages/, so a fourth package needs no wiring', () => {
    const p = build({ ...THREE, 'ui-svelte': { name: '@noy-db/ui-svelte', version: V, changelog: CL(V) } })
    expect(p.packages.map((x) => x.dir)).toEqual(['ui', 'ui-nuxt', 'ui-suai', 'ui-svelte'])
  })

  it('carries the hub peer range — unlike noy-db, these packages declare a real one', () => {
    expect(build(THREE).packages[0].hubPeerRange).toBe('^0.6.0-pre.0')
  })

  it('classifies a package with a section for this version as updated, and keeps the body', () => {
    const [ui] = build(THREE).packages
    expect(ui.changeType).toBe('updated')
    expect(ui.changelog).toBe('### Added\n- a thing')
  })

  it('classifies a package whose CHANGELOG has no section for this version as version-only', () => {
    const p = build({ ...THREE, 'ui-nuxt': { ...THREE['ui-nuxt'], changelog: CL('0.3.0-pre.1') } })
    const nuxt = p.packages.find((x) => x.dir === 'ui-nuxt')
    expect(nuxt.changeType).toBe('version-only')
    expect(nuxt.changelog).toBeNull()
  })

  it('classifies a never-published package as added, even when it has a changelog section', () => {
    const p = build(THREE, { isFirstPublish: (n) => n === '@noy-db/ui-suai' })
    expect(p.packages.find((x) => x.dir === 'ui-suai').changeType).toBe('added')
  })

  it('refuses to emit a payload for a repo with no packages rather than a valid empty one', () => {
    expect(() => build({})).toThrow(/no packages/i)
  })

  // The lockstep is not enforced by changesets (`fixed: []`); it holds only
  // because every changeset so far cascaded through @noy-db/ui. A split would
  // make the payload's single `version` a lie about the other two.
  it('refuses to emit a payload when the packages are not in lockstep', () => {
    expect(() => build({ ...THREE, 'ui-suai': { ...THREE['ui-suai'], version: '0.3.0-pre.5' } }))
      .toThrow(/lockstep|version/i)
  })
})

describe('hasRealDelta', () => {
  it('is true when anything was added or updated', () => {
    expect(hasRealDelta({ packages: [{ changeType: 'version-only' }, { changeType: 'updated' }] })).toBe(true)
    expect(hasRealDelta({ packages: [{ changeType: 'added' }] })).toBe(true)
  })

  it('is false for an all-version-only payload with no changelog text — not worth an issue', () => {
    expect(hasRealDelta({ packages: [{ changeType: 'version-only', changelog: null }] })).toBe(false)
  })

  it('is true when a version-only package still carries changelog text', () => {
    expect(hasRealDelta({ packages: [{ changeType: 'version-only', changelog: 'body' }] })).toBe(true)
  })
})

describe('isFirstPublishFromError', () => {
  it('treats npm E404 as never-published', () => {
    expect(isFirstPublishFromError({ stderr: 'npm ERR! code E404' })).toBe(true)
  })

  // Mislabelling a transient failure tells the docs side to write a brand-new
  // page for a package that has shipped for months.
  it('does not treat a network failure as never-published', () => {
    expect(isFirstPublishFromError({ stderr: 'ETIMEDOUT' })).toBe(false)
  })
})
