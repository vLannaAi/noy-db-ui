/**
 * Assemble docs-bridge.json for the three @noy-db/ui* packages.
 *
 * Producer parity with noy-db and noy-db-to (spec:
 * `noy-db-to/docs/superpowers/specs/2026-07-30-docs-bridge-design.md`) — the
 * same `bridge: 1` schema, so `noy-db-docs/scripts/sync/bridge.mjs` parses this
 * repo's payload unchanged. Pure given its inputs; the CLI at the bottom wires
 * the real fs/npm.
 *
 * Divergences from the sibling producers, each deliberate:
 *
 *   - The package set is DERIVED from `packages/`, with no capability dump and
 *     no wiring table. noy-db-to's bridge threw on two consecutive releases
 *     because a new store was missing from a hard-coded WIRING table, and both
 *     runs still reported success. There is no table here to fall out of date:
 *     a fourth package is picked up with no edit to this file.
 *
 *   - `hubPeerRange` is per-package and real. noy-db's is always null because
 *     its in-repo stores pin `workspace:*`; these three declare an actual
 *     semver range against the published hub, which is exactly the fact a docs
 *     consumer wants.
 *
 *   - Lockstep is ASSERTED, not assumed. `.changeset/config.json` has
 *     `fixed: []`, so nothing upstream keeps the three versions equal — it has
 *     held only because every changeset so far cascaded through `@noy-db/ui`.
 *     The payload carries one `version`, so a split would make it a lie about
 *     the other two. Fail instead.
 *
 * changeType rule (ordered): "added" when isFirstPublish(name) — no published
 * version before this release; else "updated" when the CHANGELOG has a section
 * for this version; else "version-only".
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { extractSection } from './changelog.mjs'

export function buildPayload({ rootDir, tag, channel, runUrl, isFirstPublish }) {
  const packagesDir = join(rootDir, 'packages')
  // Named explicitly rather than left to ENOENT: this runs in a non-fatal job
  // whose only diagnosis is the run summary, so the error has to say what broke.
  if (!existsSync(packagesDir)) {
    throw new Error(`no packages/ directory at ${rootDir} — refusing to emit an empty payload`)
  }
  const dirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(packagesDir, d.name, 'package.json')))
    .map((d) => d.name)
    .sort()

  if (dirs.length === 0) {
    throw new Error('no packages found under packages/ — refusing to emit an empty payload')
  }

  const packages = dirs.map((dir) => {
    const pkg = JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'))
    const clPath = join(packagesDir, dir, 'CHANGELOG.md')
    const changelog = existsSync(clPath)
      ? extractSection(readFileSync(clPath, 'utf8'), pkg.version)
      : null
    const changeType = isFirstPublish(pkg.name) ? 'added' : changelog !== null ? 'updated' : 'version-only'

    return {
      name: pkg.name,
      dir,
      version: pkg.version,
      description: pkg.description ?? null,
      hubPeerRange: pkg.peerDependencies?.['@noy-db/hub'] ?? null,
      changeType,
      changelog,
    }
  })

  const versions = [...new Set(packages.map((p) => p.version))]
  if (versions.length > 1) {
    const detail = packages.map((p) => `${p.name}@${p.version}`).join(', ')
    throw new Error(
      `packages are not in lockstep (${detail}) — the payload carries one version, so this would ` +
      'misdescribe the others. Bump every package to the same version, or teach the schema to ' +
      'carry per-package versions only.',
    )
  }

  return {
    bridge: 1,
    repo: 'vLannaAi/noy-db-ui',
    version: versions[0],
    tag,
    channel,
    runUrl,
    packages,
  }
}

/**
 * True when the payload shows real work: some package was `added`/`updated`, or
 * carries a non-empty changelog body. An all-`version-only` payload with no
 * changelog text anywhere returns false — the bridge job's signal that a
 * doc-sync issue is not worth opening.
 */
export function hasRealDelta(payload) {
  return payload.packages.some(
    (pkg) => pkg.changeType === 'added' || pkg.changeType === 'updated' || Boolean(pkg.changelog),
  )
}

/**
 * True when a failed `npm view` means the package has never been published
 * (npm's E404). Any other failure — network blip, registry outage, auth — is
 * NOT first-publish; the caller rethrows rather than guessing, because
 * mislabelling one tells the docs side to write a brand-new page for a package
 * that has shipped for months.
 */
export function isFirstPublishFromError(err) {
  return `${err?.stderr ?? ''}${err?.stdout ?? ''}`.toString().includes('E404')
}

/** True when npm knows no version of this package other than the current one. */
export function npmIsFirstPublish(name) {
  try {
    const out = execFileSync('npm', ['view', name, 'versions', '--json'], { stdio: 'pipe' }).toString()
    const versions = JSON.parse(out)
    return (Array.isArray(versions) ? versions : [versions]).length <= 1
  } catch (err) {
    if (isFirstPublishFromError(err)) return true
    throw err
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1] }
  const payload = buildPayload({
    rootDir: process.cwd(),
    tag: get('--tag'),
    channel: get('--channel'),
    runUrl: get('--run-url'),
    isFirstPublish: npmIsFirstPublish,
  })
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}
