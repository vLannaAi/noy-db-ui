import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publishablePackages, planAlignment, readDistTags, classifyResults, exitCodeFor, settle } from './align-dist-tags.mjs'

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

// noy-db's alignment job reported all 52 packages failed while all 52 had
// succeeded: `npm view` is CDN-served, so a read taken straight after
// `dist-tag add` returns the old value. The damage was not the red run — it was
// that the failure path printed 52 repair commands for packages needing none.
describe('classifyResults — the stale-read hazard', () => {
  const pkgs = [{ name: '@noy-db/ui', version: '0.3.0' }]

  it('confirms when the registry reads back the target', () => {
    const [r] = classifyResults(pkgs, { tags: { '@noy-db/ui': { latest: '0.3.0', next: '0.3.0' } } })
    expect(r.outcome).toBe('confirmed')
  })

  it('does NOT call a stale read a failure — that is the bug being fixed', () => {
    const [r] = classifyResults(pkgs, { tags: { '@noy-db/ui': { latest: '0.3.0', next: '0.3.0-pre.8' } } })
    expect(r.outcome).toBe('stale')
    expect(r.outcome).not.toBe('failed')
  })

  it('calls a real write error a failure', () => {
    const [r] = classifyResults(pkgs, { writeErrors: { '@noy-db/ui': 'E404 Not Found' }, tags: {} })
    expect(r.outcome).toBe('failed')
    expect(r.detail).toMatch(/E404/)
  })

  it('prefers the write error over the read — a failed write is not merely stale', () => {
    const [r] = classifyResults(pkgs, {
      writeErrors: { '@noy-db/ui': 'boom' },
      tags: { '@noy-db/ui': { latest: '0.3.0', next: '0.3.0' } },
    })
    expect(r.outcome).toBe('failed')
  })

  it('treats a missing registry entry as stale, not failed', () => {
    expect(classifyResults(pkgs, { tags: {} })[0].outcome).toBe('stale')
  })
})

describe('exitCodeFor', () => {
  // The whole point: a correct release must not go red because a CDN read lagged.
  it('does not fail the run on stale reads', () => {
    expect(exitCodeFor([{ outcome: 'stale' }, { outcome: 'confirmed' }])).toBe(0)
  })

  it('fails the run on a real write error', () => {
    expect(exitCodeFor([{ outcome: 'confirmed' }, { outcome: 'failed' }])).toBe(1)
  })

  it('is zero when everything confirmed', () => {
    expect(exitCodeFor([{ outcome: 'confirmed' }])).toBe(0)
  })
})

// The read-after-write defect itself is unreachable by any test that does not
// write — invisible in every dry run and live pre-flight, first reachable on the
// real cut. What IS testable is that the settling behaves: that it retries, that
// a stale read followed by a fresh one ends confirmed, and that a write error is
// never retried away. Those are what a refactor would silently break.
describe('settle', () => {
  const pkgs = [{ name: 'a', version: '1.0.0' }]
  const fresh = { a: { latest: '1.0.0', next: '1.0.0' } }
  const stale = { a: { latest: '1.0.0', next: '0.9.0' } }

  it('confirms without sleeping when the first read is already fresh', () => {
    const slept = []
    const r = settle(pkgs, { read: () => fresh, sleep: (ms) => slept.push(ms) })
    expect(r[0].outcome).toBe('confirmed')
    expect(slept).toEqual([])
  })

  it('retries a stale read and confirms once the registry catches up', () => {
    let call = 0
    const slept = []
    const r = settle(pkgs, { read: () => (++call === 1 ? stale : fresh), sleep: (ms) => slept.push(ms) })
    expect(r[0].outcome).toBe('confirmed')
    expect(slept).toHaveLength(1)
  })

  it('backs off between attempts rather than hammering the registry', () => {
    const slept = []
    settle(pkgs, { read: () => stale, sleep: (ms) => slept.push(ms), attempts: 3 })
    expect(slept).toEqual([5000, 10000, 15000])
  })

  it('gives up as stale rather than failed when it never catches up', () => {
    const r = settle(pkgs, { read: () => stale, sleep: () => {}, attempts: 2 })
    expect(r[0].outcome).toBe('stale')
    expect(exitCodeFor(r)).toBe(0)
  })

  // A failed write is not a visibility problem; retrying it wastes the settle
  // budget and cannot change the answer.
  it('never sleeps for a package whose write errored', () => {
    const slept = []
    const r = settle([{ name: 'a', version: '1.0.0' }], {
      writeErrors: { a: 'E404' }, read: () => ({}), sleep: (ms) => slept.push(ms),
    })
    expect(r[0].outcome).toBe('failed')
    expect(slept).toEqual([])
  })

  it('re-reads only the stragglers, not every package', () => {
    const asked = []
    const pkgs2 = [{ name: 'a', version: '1.0.0' }, { name: 'b', version: '1.0.0' }]
    let call = 0
    settle(pkgs2, {
      read: (names) => {
        asked.push([...names]); call++
        return call === 1
          ? { a: { latest: '1.0.0', next: '1.0.0' }, b: { latest: '1.0.0', next: '0.9.0' } }
          : { b: { latest: '1.0.0', next: '1.0.0' } }
      },
      sleep: () => {},
    })
    expect(asked[0]).toEqual(['a', 'b'])
    expect(asked[1]).toEqual(['b'])
  })
})

// Pinned, not incidental. At three packages the write pass buys ~3s of settling,
// so the retry IS the mechanism — see the note on settle(). A refactor that
// trims this budget would be invisible until a real cut, because nothing before
// one writes anything.
describe('the settle budget outlasts the cache independent of package count', () => {
  it('waits at least as long as noy-db\'s reference (45s) even for a single package', () => {
    const slept = []
    settle([{ name: 'a', version: '1.0.0' }], {
      read: () => ({ a: { latest: '1.0.0', next: '0.9.0' } }),
      sleep: (ms) => slept.push(ms),
    })
    expect(slept.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(45_000)
  })

  it('probes quickly first, so a fast propagation is not punished', () => {
    const slept = []
    settle([{ name: 'a', version: '1.0.0' }], {
      read: () => ({ a: { latest: '1.0.0', next: '0.9.0' } }),
      sleep: (ms) => slept.push(ms),
    })
    expect(slept[0]).toBeLessThanOrEqual(5_000)
  })
})

// klum-db's 0.4.0 cut: ONE package needed FIVE reads, the first four stale. So
// lag is the default behaviour, not a scale artefact of noy-db's 52 packages —
// and one package is the case with the LEAST free settling from the write pass.
// The discriminator below tells lag from corruption by what this script is
// CAPABLE of having written, rather than by elapsed time.
describe('stale vs unexpected — lag told apart from corruption', () => {
  const pkgs = [{ name: 'a', version: '1.0.0' }]
  const prev = { a: '0.9.0' }

  it('calls the PREVIOUS value still showing stale — that is what lag looks like', () => {
    const [r] = classifyResults(pkgs, { tags: { a: { latest: '1.0.0', next: '0.9.0' } }, previous: prev })
    expect(r.outcome).toBe('stale')
    expect(exitCodeFor([r])).toBe(0)
  })

  // This script only ever writes `next`. A wrong `latest` therefore cannot be
  // our lag, and waiting will not fix it.
  it('calls a wrong @latest unexpected, because this script never writes latest', () => {
    const [r] = classifyResults(pkgs, { tags: { a: { latest: '0.8.0', next: '1.0.0' } }, previous: prev })
    expect(r.outcome).toBe('unexpected')
    expect(exitCodeFor([r])).toBe(1)
  })

  it('calls a THIRD value unexpected — neither the old value nor the target', () => {
    const [r] = classifyResults(pkgs, { tags: { a: { latest: '1.0.0', next: '0.7.0' } }, previous: prev })
    expect(r.outcome).toBe('unexpected')
    expect(exitCodeFor([r])).toBe(1)
  })

  it('confirms the target', () => {
    expect(classifyResults(pkgs, { tags: { a: { latest: '1.0.0', next: '1.0.0' } }, previous: prev })[0].outcome).toBe('confirmed')
  })

  it('a failed write outranks any read state', () => {
    const [r] = classifyResults(pkgs, { writeErrors: { a: 'E404' }, tags: { a: { latest: '1.0.0', next: '1.0.0' } }, previous: prev })
    expect(r.outcome).toBe('failed')
  })
})

describe('the settle budget is sized PAST the live observation, not to it', () => {
  it('attempts at least 6 reads — klum needed 5, and a measured boundary is not a margin', () => {
    let reads = 0
    settle([{ name: 'a', version: '1.0.0' }], {
      previous: { a: '0.9.0' },
      read: () => { reads++; return { a: { latest: '1.0.0', next: '0.9.0' } } },
      sleep: () => {},
    })
    expect(reads).toBeGreaterThanOrEqual(6)
  })

  it('waits at least 70s in total', () => {
    const slept = []
    settle([{ name: 'a', version: '1.0.0' }], {
      previous: { a: '0.9.0' },
      read: () => ({ a: { latest: '1.0.0', next: '0.9.0' } }),
      sleep: (ms) => slept.push(ms),
    })
    expect(slept.reduce((x, y) => x + y, 0)).toBeGreaterThanOrEqual(70_000)
  })
})
