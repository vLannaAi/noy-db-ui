/**
 * Align `@next` onto a freshly published STABLE, so cutting a stable does not
 * leave `@next` pointing BEHIND `@latest`.
 *
 * Cutting `0.3.0` to `@latest` while `@next` sits at `0.3.0-pre.7` puts the
 * in-flight tag behind the stable one — the "lying tag" state the family sweep
 * flags. The repair is an extraordinary alignment: both tags on the stable. It
 * is self-correcting, because the next pre-release moves `@next` forward again
 * and restores the invariant.
 *
 * Stable publishes only. A pre-release already sets `@next` and must never
 * touch `@latest`.
 *
 * The pure half lives here so the dangerous part is testable: a blind
 * `npm dist-tag add <pkg>@<version> next` is correct when the stable published
 * and catastrophic when the version is wrong. `planAlignment` refuses rather
 * than guessing.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * Every publishable package, derived from `packages/` rather than hardcoded.
 *
 * Three packages is exactly the case where a hardcoded list looks harmless and
 * exactly the case where a fourth is later missed in silence — noy-db-to's
 * bridge broke twice on that shape.
 *
 * Each carries its OWN version. This repo's lockstep is NOT enforced
 * (`.changeset/config.json` has `fixed: []`); it holds only because every
 * changeset so far cascaded through `@noy-db/ui`. Assuming one version for all
 * three would, on the day they diverge, move two tags to a version that does
 * not exist for those packages.
 */
export function publishablePackages(rootDir) {
  const dir = join(rootDir, 'packages')
  if (!existsSync(dir)) throw new Error(`no packages/ directory at ${rootDir}`)
  const found = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'package.json')))
    .map((e) => JSON.parse(readFileSync(join(dir, e.name, 'package.json'), 'utf8')))
    .filter((pj) => pj.private !== true)
    .map((pj) => ({ name: pj.name, version: pj.version }))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (found.length === 0) throw new Error('no publishable packages found under packages/')
  return found
}

const isPrerelease = (v) => typeof v === 'string' && v.includes('-')

/**
 * Decide, per package, whether `@next` should move onto its version.
 *
 * `current` is `{ [name]: { latest, next } }` read from the registry. Refusals
 * are returned as data, never thrown, so the caller reports every problem at
 * once instead of stopping at the first.
 */
export function planAlignment(pkgs, current) {
  const actions = []
  const skipped = []
  const refusals = []

  for (const { name, version } of pkgs) {
    const tags = current[name]
    if (!tags) {
      refusals.push({ name, reason: `no dist-tags on the registry for ${name}` })
      continue
    }
    if (isPrerelease(version)) {
      refusals.push({ name, reason: `${name}@${version} is a pre-release; alignment is for stables only` })
      continue
    }
    // The before-state assertion. If @latest is not already this version the
    // publish did not land, or the version input is wrong — either way, writing
    // @next here would point it at something unverified.
    if (tags.latest !== version) {
      refusals.push({ name, reason: `${name}: expected @latest to be ${version} after publish, found ${tags.latest ?? '(none)'}` })
      continue
    }
    if (tags.next === version) {
      skipped.push({ name, reason: `${name}: @next is already ${version}` })
      continue
    }
    actions.push({ name, version, from: tags.next ?? '(none)' })
  }

  return { actions, skipped, refusals }
}

/** Read `{ latest, next }` per package from the registry. */
export function readDistTags(names, view = npmView) {
  const out = {}
  for (const n of names) out[n] = view(n)
  return out
}

function npmView(name) {
  try {
    return JSON.parse(execFileSync('npm', ['view', name, 'dist-tags', '--json'], { stdio: 'pipe' }).toString())
  } catch {
    return null
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const apply = process.argv.includes('--apply')
  const pkgs = publishablePackages(process.cwd())
  const { actions, skipped, refusals } = planAlignment(pkgs, readDistTags(pkgs.map((p) => p.name)))

  for (const s of skipped) console.log(`  = ${s.reason}`)
  for (const a of actions) console.log(`  → ${a.name}: @next ${a.from} → ${a.version}`)
  for (const r of refusals) console.error(`  ✗ ${r.reason}`)

  if (refusals.length) {
    console.error('\nRefusing to move any tag. Alignment is all-or-nothing: a partial move leaves the')
    console.error('tags in a state nobody designed, across packages that are supposed to ship together.')
    process.exit(1)
  }
  if (!apply) { console.log('\n--apply not given; nothing written.'); process.exit(0) }

  for (const a of actions) {
    execFileSync('npm', ['dist-tag', 'add', `${a.name}@${a.version}`, 'next'], { stdio: 'inherit' })
  }

  // A zero exit is not evidence. Re-read the registry.
  const after = readDistTags(pkgs.map((p) => p.name))
  let bad = 0
  for (const { name, version } of pkgs) {
    const t = after[name]
    const ok = t?.next === version && t?.latest === version
    console.log(`  ${ok ? '✓' : '✗'} ${name}: latest=${t?.latest} next=${t?.next}`)
    if (!ok) bad++
  }
  if (bad) { console.error(`\n✗ ${bad} package(s) did not land as expected.`); process.exit(1) }
  console.log('\n✓ @latest and @next both on the stable for every package')
}
