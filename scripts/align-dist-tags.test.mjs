import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publishablePackages, planAlignment, readDistTags } from './align-dist-tags.mjs'

function repo(pkgs) {
  const root = mkdtempSync(join(tmpdir(), 'dist-tags-'))
  for (const [dir, pj] of Object.entries(pkgs)) {
    const d = join(root, 'packages', dir)
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'package.json'), JSON.stringify(pj))
  }
  return root
}
const withRepo = (pkgs, fn) => { const r = repo(pkgs); try { return fn(r) } finally { rmSync(r, { recursive: true, force: true }) } }

const THREE = {
  ui: { name: '@noy-db/ui', version: '0.3.0' },
  'ui-nuxt': { name: '@noy-db/ui-nuxt', version: '0.3.0' },
  'ui-suai': { name: '@noy-db/ui-suai', version: '0.3.0' },
}
const stable = { latest: '0.3.0', next: '0.3.0-pre.8' }
const allAt = (t) => ({ '@noy-db/ui': t, '@noy-db/ui-nuxt': t, '@noy-db/ui-suai': t })

describe('publishablePackages', () => {
  it('derives the set from packages/ rather than a hardcoded list', () => {
    withRepo(THREE, (r) => {
      expect(publishablePackages(r).map((p) => p.name))
        .toEqual(['@noy-db/ui', '@noy-db/ui-nuxt', '@noy-db/ui-suai'])
    })
  })

  // The failure noy-db-to's bridge hit twice: a new package appears and a
  // hardcoded list silently omits it.
  it('picks up a fourth package with no edit', () => {
    withRepo({ ...THREE, 'ui-svelte': { name: '@noy-db/ui-svelte', version: '0.3.0' } }, (r) => {
      expect(publishablePackages(r)).toHaveLength(4)
    })
  })

  it('skips private packages', () => {
    withRepo({ ...THREE, playground: { name: 'playground', version: '0.0.0', private: true } }, (r) => {
      expect(publishablePackages(r).map((p) => p.name)).not.toContain('playground')
    })
  })

  // Lockstep is not enforced here (`fixed: []`), so each package must carry its
  // own version. Assuming one version for all of them would, on the day they
  // diverge, move two tags to a version those packages never published.
  it('carries each package its own version rather than assuming one', () => {
    withRepo({ ...THREE, 'ui-suai': { name: '@noy-db/ui-suai', version: '0.3.1' } }, (r) => {
      const byName = Object.fromEntries(publishablePackages(r).map((p) => [p.name, p.version]))
      expect(byName['@noy-db/ui']).toBe('0.3.0')
      expect(byName['@noy-db/ui-suai']).toBe('0.3.1')
    })
  })

  it('refuses a repo with no publishable packages instead of returning an empty plan', () => {
    withRepo({ playground: { name: 'p', version: '0.0.0', private: true } }, (r) => {
      expect(() => publishablePackages(r)).toThrow(/no publishable packages/i)
    })
  })
})

describe('planAlignment', () => {
  const pkgs = [{ name: '@noy-db/ui', version: '0.3.0' }]

  it('moves @next onto the stable when @latest is already there', () => {
    const p = planAlignment(pkgs, { '@noy-db/ui': stable })
    expect(p.actions).toEqual([{ name: '@noy-db/ui', version: '0.3.0', from: '0.3.0-pre.8' }])
    expect(p.refusals).toEqual([])
  })

  // The before-state assertion. A blind `dist-tag add` is correct when the
  // stable published and catastrophic when the version is wrong.
  it('REFUSES when @latest is not already the version — the publish did not land', () => {
    const p = planAlignment(pkgs, { '@noy-db/ui': { latest: '0.2.0', next: '0.3.0-pre.8' } })
    expect(p.actions).toEqual([])
    expect(p.refusals[0].reason).toMatch(/expected @latest to be 0\.3\.0.*found 0\.2\.0/)
  })

  it('REFUSES a pre-release version — alignment is stable-only', () => {
    const p = planAlignment([{ name: '@noy-db/ui', version: '0.3.0-pre.9' }], { '@noy-db/ui': { latest: '0.3.0-pre.9', next: '0.3.0-pre.8' } })
    expect(p.actions).toEqual([])
    expect(p.refusals[0].reason).toMatch(/pre-release/)
  })

  it('REFUSES a package the registry does not know', () => {
    expect(planAlignment(pkgs, {}).refusals[0].reason).toMatch(/no dist-tags/)
  })

  it('is idempotent — a second run moves nothing', () => {
    const p = planAlignment(pkgs, { '@noy-db/ui': { latest: '0.3.0', next: '0.3.0' } })
    expect(p.actions).toEqual([])
    expect(p.skipped[0].reason).toMatch(/already 0\.3\.0/)
  })

  it('reports every refusal rather than stopping at the first', () => {
    const p = planAlignment(
      [{ name: 'a', version: '0.3.0' }, { name: 'b', version: '0.3.0' }],
      { a: { latest: '0.2.0', next: 'x' }, b: { latest: '0.1.0', next: 'x' } },
    )
    expect(p.refusals).toHaveLength(2)
  })

  // One package lagging must not let the other two move: a partial alignment
  // leaves tags in a state nobody designed, across packages meant to ship together.
  it('refuses the lagging package while the CLI treats any refusal as all-or-nothing', () => {
    const p = planAlignment(
      [{ name: '@noy-db/ui', version: '0.3.0' }, { name: '@noy-db/ui-suai', version: '0.3.0' }],
      { '@noy-db/ui': stable, '@noy-db/ui-suai': { latest: '0.2.9', next: '0.3.0-pre.8' } },
    )
    expect(p.actions).toHaveLength(1)
    expect(p.refusals).toHaveLength(1)
  })
})

describe('readDistTags', () => {
  it('reads each package through the injected viewer', () => {
    const seen = []
    const out = readDistTags(['a', 'b'], (n) => { seen.push(n); return { latest: '1.0.0', next: '1.1.0-pre.0' } })
    expect(seen).toEqual(['a', 'b'])
    expect(out.a.latest).toBe('1.0.0')
  })
})
