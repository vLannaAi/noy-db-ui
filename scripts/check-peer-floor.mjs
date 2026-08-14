// check-peer-floor — do all three packages actually COMPILE against the oldest
// @noy-db/* versions their peer ranges admit?
//
// Ported from noy-db-to (PR #92), klum-db (PR #87) and doi-db (PR #2).
//
// Why it is needed here: every gate in this repo — build, lint, typecheck, 234
// tests — resolves @noy-db/* from the exact DEV PIN, so none of them exercises
// the declared peer RANGES. A range can promise versions the code cannot run on
// and the whole suite stays green. klum-db shipped exactly that: a range
// narrowed by reasoning about symbols, published, and still wrong by fourteen
// pre-releases when this guard first compiled against it.
//
// It COMPILES rather than greps. In noy-db-to the equivalent bug was a type
// parameter added to an existing export: the symbol was present at the old
// floor and simply could not accept the argument, so a presence check passed.
//
// Repo-specific note: the three packages must declare the SAME floor. Their
// lockstep is not enforced (`fixed: []` in the changesets config) and holds only
// because every changeset so far cascaded through @noy-db/ui — so a divergent
// floor here is a signal worth failing on, not a case to handle.
//
// The examples/ apps are deliberately OUT of scope: they are private: true,
// outside the pnpm workspace, and pin @noy-db/* as ordinary dependencies rather
// than peers. They are verified by `nuxi build`, not by this.
//
// Usage:  node scripts/check-peer-floor.mjs [--dry-run]

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { planFloors, withRestoredFile } from './peer-floor.mjs'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const DRY = process.argv.includes('--dry-run')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const pkgs = readdirSync(join(ROOT, 'packages'))
  .map((d) => join(ROOT, 'packages', d))
  .filter((d) => existsSync(join(d, 'package.json')))
  .map((d) => ({ dir: d, pj: readJson(join(d, 'package.json')) }))

// ── Plan: every @noy-db peer, floored, checked for agreement across packages ──
// Computed by scripts/peer-floor.mjs, which is unit-tested — this half is pure,
// fast, and the half a refactor can silently break (a range flooring at `0.6.0`
// instead of `0.6.0-pre.0` would skip every version it actually admits and still
// look right).
const { floors, conflicts, invalid } = planFloors(pkgs)

if (invalid.length) {
  console.error('✗ peer range(s) with no usable floor:\n')
  for (const i of invalid) console.error(`  ${i.pkg}: ${i.name} "${i.range}"`)
  console.error('\nA range is unusable here when it is malformed, satisfiable by nothing, or')
  console.error('unbounded. Unbounded is the subtle one: `*`, `x`, `>=0.0.0`, `<1.0.0` and a')
  console.error('half-finished `^0.6.0-pre.0 || ` all floor at 0.0.0, a version no @noy-db')
  console.error('package has ever published — so there is no real version to check against.')
  console.error('Declare a lower bound (and if you were widening by appending, finish the edit).')
  process.exit(1)
}

console.log(`Peer-floor check — ${pkgs.length} packages, ${Object.keys(floors).length} @noy-db peer(s)\n`)
for (const { pj } of pkgs) {
  const own = Object.entries(pj.peerDependencies ?? {}).filter(([n]) => n.startsWith('@noy-db/'))
  console.log(`  ${pj.name}`)
  // Reuses the floor already computed above rather than recomputing it. The old
  // line called semver.minVersion(r).version with no null check at all, so a bad
  // range threw a TypeError out of a DISPLAY loop — and did it under --dry-run,
  // before any validation ran. A value that cannot exist here cannot throw.
  for (const [n, r] of own) console.log(`     ${n.padEnd(20)} ${r}   → floor ${floors[n]}`)
}
console.log()

if (conflicts.length) {
  console.error('✗ packages declare DIFFERENT floors for the same peer:')
  for (const c of conflicts) console.error(`  ${c.name}: ${c.a} vs ${c.b}`)
  console.error('\nThe three packages ship in lockstep, so their floors must agree. Note the')
  console.error('lockstep is not enforced by changesets (`fixed: []`) — it holds only because')
  console.error('every changeset so far cascaded through @noy-db/ui.')
  process.exit(1)
}

if (DRY) {
  console.log('--dry-run: nothing installed.')
  process.exit(0)
}

// ── Execute ─────────────────────────────────────────────────────────────────
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', env: process.env })
const rootPath = join(ROOT, 'package.json')
const failures = []

// withRestoredFile puts the root package.json back byte-for-byte however this
// exits. It is unit-tested (scripts/peer-floor.test.mjs) because a restore
// regression corrupts the repo the guard just checked, on the failure path,
// where the run is already red and nobody reads the working tree.
try {
  withRestoredFile(rootPath, () => {
    const mutated = JSON.parse(readFileSync(rootPath, 'utf8'))
    mutated.pnpm = { ...(mutated.pnpm ?? {}), overrides: { ...(mutated.pnpm?.overrides ?? {}), ...floors } }
    writeFileSync(rootPath, JSON.stringify(mutated, null, 2) + '\n')

    console.log('── installing every @noy-db peer at its floor …')
    try {
      run('pnpm', ['install', '--no-frozen-lockfile', '--silent'])
    } catch (e) {
      failures.push({ step: 'install', error: `${e.stdout ?? ''}${e.stderr ?? ''}`.slice(0, 1200) })
      throw new Error('install')
    }

  // Build first: ui-nuxt and ui-suai consume @noy-db/ui through the workspace
  // link, whose `types` points into dist/. Without a build the typecheck fails
  // with TS2307 "Cannot find module", which looks like a peer failure and is
  // not one. That false positive is exactly what noy-db-to's first CI run hit.
    for (const step of ['build', 'typecheck']) {
      process.stdout.write(`   ${step.padEnd(10)} `)
      try {
        run('pnpm', [step])
        console.log('ok')
      } catch (e) {
        console.log('FAILED')
        const out = `${e.stdout ?? ''}${e.stderr ?? ''}`
        const errs = out.split('\n').filter((l) => /error TS/.test(l)).slice(0, 8)
        failures.push({ step, error: errs.join('\n      ') || out.slice(0, 600) })
      }
    }
  })
} catch {
  // recorded in `failures`; the file is already restored by withRestoredFile
}

// Re-resolve the tree against the restored manifest. Runs after the restore,
// never instead of it.
try {
  run('pnpm', ['install', '--no-frozen-lockfile', '--silent'])
} catch {
  console.error('\n⚠  restore install failed — run `pnpm install` before committing.')
}

console.log()
if (failures.length) {
  console.error('✗ does not work against the floors it advertises:\n')
  for (const f of failures) console.error(`  [${f.step}]\n      ${f.error}\n`)
  console.error('Either narrow the peer range to a floor that works, or restore compatibility')
  console.error('with the older package. A range that does not compile is a false promise —')
  console.error('consumers hit it as a broken install, not as a refused one.')
  process.exit(1)
}
console.log('✓ all packages compile against the oldest @noy-db/* versions their ranges admit')
