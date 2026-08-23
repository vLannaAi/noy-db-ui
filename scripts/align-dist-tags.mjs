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
 * DELIBERATELY FATAL, unlike noy-db's `repoint-pre-only-latest.mjs`, which is
 * the mirror operation (moving `latest` FORWARD onto a prerelease for packages
 * that have no stable) and never fails its caller. That posture is right there:
 * a stale `latest` on a pre-only package is cosmetic, and reddening a release
 * over it only trains people to stop reading the log. It is wrong here. This
 * runs as part of delivering a stable, and a half-applied state across three
 * packages that ship together is worse than a loud failure — it is precisely
 * the state a human then has to repair by hand, with an OTP. Do not "fix" this
 * to match the sibling script.
 *
 * BECAUSE IT IS FATAL, IT MUST STAY ITS OWN JOB, `needs: publish`, ALONGSIDE
 * `docs-bridge` — never a step inside `publish`. A job's exit code conflates
 * "my purpose failed" with "something after my purpose failed", and everything
 * downstream of `needs:` inherits the conflation. noy-db put its alignment
 * INSIDE `publish`; when it false-alarmed it took the publish job's exit code
 * with it, and the bridge — `needs: publish` — was skipped, leaving a correct
 * release with zero assets. The sibling layout makes that impossible here.
 *
 * Untested, deliberately noted: this repo has never observed a red alignment
 * beside a green bridge, because `settle()`'s retry has so far prevented one.
 * The immunity is structural, derived from the job graph, not demonstrated.
 * Two independent defences; do not remove either on the strength of the other.
 *
 * The pure half lives here so the dangerous part is testable: a blind
 * `npm dist-tag add <pkg>@<version> next` is correct when the stable published
 * and catastrophic when the version is wrong. `planAlignment` refuses rather
 * than guessing.
 */
import { readdirSync, readFileSync, existsSync, appendFileSync } from 'node:fs'
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

/**
 * Classify what happened to each package after the writes.
 *
 * THREE outcomes, not two, and the third is the point. `npm view` is CDN-served,
 * so a read taken immediately after `dist-tag add` can still return the OLD
 * value for a write that landed perfectly. noy-db's alignment job reported all
 * 52 packages failed while all 52 had succeeded, and the damage was not the red
 * — it was that the failure path printed 52 repair commands for packages that
 * needed no repair (noy-db #1156).
 *
 *   failed       the `dist-tag add` itself errored. A real problem. Repair.
 *   confirmed    the registry reads back the target. Done.
 *   unconfirmed  the write did not error but the read has not caught up.
 *                CHECK, do not repair — and do not fail the run over it.
 *
 * Collapsing `unconfirmed` into `failed` is what turns a correct release red and
 * hands out instructions to fix something that is not broken.
 */
export function classifyResults(pkgs, { writeErrors = {}, tags = {}, previous = {} } = {}) {
  return pkgs.map(({ name, version }) => {
    if (writeErrors[name]) return { name, version, outcome: 'failed', detail: writeErrors[name] }

    const t = tags[name]
    // A read that did not come back is a read problem, not corruption.
    if (!t) return { name, version, outcome: 'stale', detail: 'no dist-tags read back yet' }

    // This script NEVER writes `latest`. So a wrong `latest` cannot be our lag —
    // it is something else acting on the package, and elapsed time will not fix
    // it. That is the discriminator: lag vs corruption decided by what this
    // script is CAPABLE of having written, not by how long we have waited.
    if (t.latest !== version) {
      return { name, version, outcome: 'unexpected', detail: `latest=${t.latest ?? '(none)'}, expected ${version} — this script never writes latest` }
    }
    if (t.next === version) return { name, version, outcome: 'confirmed', detail: `latest=${t.latest} next=${t.next}` }

    // The PREVIOUS value still showing is exactly what propagation lag looks
    // like. Anything else is a third value nobody here wrote.
    if (previous[name] !== undefined && t.next === previous[name]) {
      return { name, version, outcome: 'stale', detail: `next still ${t.next}, waiting for ${version}` }
    }
    if (previous[name] === undefined) {
      return { name, version, outcome: 'stale', detail: `next=${t.next}, waiting for ${version}` }
    }
    return { name, version, outcome: 'unexpected', detail: `next=${t.next} — neither ${previous[name]} (lag) nor ${version} (target)` }
  })
}

/**
 * Confirm the writes, re-reading only the packages that have not caught up.
 *
 * `read` and `sleep` are injected so this is testable. That matters more than
 * usual: the underlying defect — a read-after-write against a distributed cache
 * — is unreachable by any test that does not actually write, so it is invisible
 * in every dry run and live pre-flight and first reachable on a real cut. What
 * CAN be tested is that it retries, that a stale read followed by a fresh one
 * ends `confirmed`, that a write error is never retried away, and that only
 * stragglers are re-read. Those are what a refactor would silently break.
 *
 * THE RETRY IS THE MECHANISM, not belt-and-braces, and this is measured rather
 * than argued. klum-db's alignment job — ONE package — needed FIVE reads on its
 * 0.4.0 cut; the first four came back stale. So propagation lag is not a
 * scale artefact of noy-db's 52 packages, it is the default behaviour, and one
 * package is the case with the LEAST free settling from the write pass.
 *
 * The budget is therefore sized past the only live observation we have rather
 * than to it: 5 attempts (6 reads, ~75s) against klum's observed 5. Sitting
 * exactly on a measured boundary is not a margin. Pinned by test.
 *
 * ORDERING, which this deliberately does NOT depend on: "settle ≈ one pass"
 * holds only if the write and read passes iterate in the same order, and
 * reversing the read loop takes the free minimum to zero. Here the retry is
 * unconditional rather than a backstop, so correctness is order-independent.
 * Do not add an ordering assumption on the strength of that — take the retry.
 */
export function settle(pkgs, { writeErrors = {}, previous = {}, read, sleep, attempts = 5 } = {}) {
  const names = pkgs.map((p) => p.name)
  let tags = read(names)
  let results = classifyResults(pkgs, { writeErrors, tags, previous })

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const pending = results.filter((r) => r.outcome === 'stale').map((r) => r.name)
    if (pending.length === 0) break
    sleep(attempt * 5000)
    tags = { ...tags, ...read(pending) }
    results = classifyResults(pkgs, { writeErrors, tags, previous })
  }
  return results
}

/** Portable synchronous sleep — no external `sleep` binary on the PATH. */
export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * `stale` never fails the run — it is propagation, and the instruction is to
 * check. `failed` and `unexpected` do: a write that errored, and a tag state
 * this script could not have produced, both need a human.
 */
export function exitCodeFor(results) {
  return results.some((r) => r.outcome === 'failed' || r.outcome === 'unexpected') ? 1 : 0
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

  // Write everything in one pass, recording errors rather than stopping — a
  // half-written state across packages that ship together is the outcome to
  // avoid, so finish the pass and report all of it.
  const writeErrors = {}
  for (const a of actions) {
    try {
      execFileSync('npm', ['dist-tag', 'add', `${a.name}@${a.version}`, 'next'], { stdio: 'pipe' })
      console.log(`  wrote ${a.name}@${a.version} → next`)
    } catch (err) {
      writeErrors[a.name] = (err?.stderr?.toString() ?? err?.message ?? 'unknown').split('\n')[0]
      console.error(`  ✗ write failed for ${a.name}: ${writeErrors[a.name]}`)
    }
  }

  // Confirm AFTER all writes, and let the registry settle. npm view is
  // CDN-served: an immediate read can return the old value for a write that
  // landed. Re-check only the packages that have not caught up.
  // The plan knows what @next pointed at before we wrote — that is what tells
  // propagation lag apart from a third value nobody here wrote.
  const previous = Object.fromEntries(actions.map((a) => [a.name, a.from]))
  const results = settle(pkgs, {
    writeErrors,
    previous,
    read: (names) => readDistTags(names),
    sleep: (ms) => { console.log(`  … not yet visible; settling ${ms / 1000}s`); sleepSync(ms) },
  })

  const summary = []
  const mark = { confirmed: '✓', stale: '…', unexpected: '⚠️', failed: '⚠️' }
  for (const r of results) {
    console.log(`  ${mark[r.outcome]} ${r.name}: ${r.detail}`)
    summary.push(`- ${mark[r.outcome]} \`${r.name}\` — ${r.detail}`)
    if (r.outcome === 'failed') {
      summary.push(`    repair: \`npm dist-tag add ${r.name}@${r.version} next --otp=<code>\``)
    } else if (r.outcome === 'unexpected') {
      summary.push(`    the tag is in a state this script does not write. Investigate before repairing.`)
      summary.push(`    \`npm view ${r.name} dist-tags\``)
    } else if (r.outcome === 'stale') {
      // Deliberately NOT a repair command. The write did not error; the read has
      // not caught up. Telling someone to repair a tag that is probably already
      // correct is the failure mode this exists to avoid.
      summary.push(`    the write did not error — the registry read has not caught up yet.`)
      summary.push(`    CHECK, do not repair: \`npm view ${r.name} dist-tags\``)
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### dist-tag alignment\n\n${summary.join('\n')}\n\n`)
  }

  const failed = results.filter((r) => r.outcome === 'failed').length
  const unexpected = results.filter((r) => r.outcome === 'unexpected').length
  const stale = results.filter((r) => r.outcome === 'stale').length
  if (failed) console.error(`\n✗ ${failed} package(s) failed to write.`)
  if (unexpected) console.error(`\n✗ ${unexpected} package(s) are in a tag state this script does not write.`)
  if (stale) console.log(`\n… ${stale} package(s) written but not yet visible after ~75s. Verify with npm view; this is propagation, not a failure.`)
  if (!failed && !unexpected && !stale) console.log('\n✓ @latest and @next both on the stable for every package')
  process.exit(exitCodeFor(results))
}
