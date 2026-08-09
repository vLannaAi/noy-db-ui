# Release-triggered publishing for noy-db-ui

**Date:** 2026-08-09
**Status:** approved

## The problem

`noy-db-ui` publishes from a `workflow_dispatch`-only `release.yml`. It works — `0.3.0-pre.4`
and `0.3.0-pre.5` both reached npm through it on 2026-08-09 — but it produces **no GitHub Release
object**. `gh release list -R vLannaAi/noy-db-ui` is empty while the repo has 17 package tags.

Two costs:

1. **The family sweep is blind here.** The coordination sweep's step 3 ("did the publish actually
   run?") is `gh release list` + `gh run list --workflow release.yml`. For this repo the first half
   returns nothing, so the repo has to be checked a different way from its four siblings — exactly
   the kind of per-repo exception that makes a sweep stop being run.
2. **No release notes.** There is no durable, human-readable record of what a given cut contained.
   The `0.3.0-pre.4` / `0.3.0-pre.5` split is recorded only in the family coordination file.

`noy-db`, `noy-db-to` and `klum-db` all publish on `release: [published]`. This repo is the outlier,
and the family's own operating rule already says publishing happens via a GitHub Release triggering
`release.yml`.

## The complication: changesets tags per-package

The siblings publish with `pnpm publish` and hang the Release off a hand-cut `vX.Y.Z` tag, then
assert `package.json` version == tag. This repo publishes with **changesets**, which tags each
package separately:

```
@noy-db/ui@0.3.0-pre.5   @noy-db/ui-nuxt@0.3.0-pre.5   @noy-db/ui-suai@0.3.0-pre.5
```

There is no `vX.Y.Z` tag anywhere in the repo — all 17 tags are package-scoped. A GitHub Release
must hang off exactly one tag, and each cut produces three.

**Decision: introduce a repo-level `vX.Y.Z` tag.** The Release hangs off it; changesets' per-package
tags continue to be created and pushed alongside, unchanged. This makes `gh release list` read
identically across all four publishing repos.

### That tag makes a claim nothing currently enforces

`v0.3.0-pre.6` asserts all three packages are at `0.3.0-pre.6`. Today that is true only by
coincidence: `.changeset/config.json` has `fixed: []` and `linked: []`, so changesets does not tie
the three together. It has held because every changeset so far touched `@noy-db/ui`, and both
bindings carry `"@noy-db/ui": "workspace:*"`, so `updateInternalDependencies: "patch"` cascades a
bump into them. **A changeset touching only `ui-nuxt` would bump only `ui-nuxt`**, and the tag would
then misdescribe the release.

**Decision: verify at release time rather than change versioning.** The `verify` job asserts all
three versions equal the tag and fails the release otherwise. This is additive — no change to how
versioning behaves, no new changesets config, and no new failure mode for ordinary cuts. Enforcing
lockstep upstream via `fixed: [[...]]` was considered and rejected as a larger change than the
problem warrants; if divergence ever becomes intentional, this check is the thing to revisit.

## Design

### Trigger surface

| Event | Runs | Publishes |
|---|---|---|
| `release: [published]` | verify → publish | yes |
| `workflow_dispatch` with `confirm: PUBLISH` | verify → publish | yes |
| `push` to main touching `.github/workflows/release.yml` | verify only | **no** |

`workflow_dispatch` is retained deliberately. It is the path that shipped `0.3.0-pre.4` and
`0.3.0-pre.5`, so this change never leaves the repo without a working publish route — and it is the
recovery path if the Release-triggered run fails. The `push` leg lets workflow edits be tested
without being able to publish; the publish job carries an explicit event guard so that a workflow
edit can never reach npm.

### Jobs

**`verify`** — install (frozen lockfile) → `pnpm build` → `pnpm lint` → `pnpm typecheck` →
`pnpm test`, then on `release` events the version↔tag check and the pre-release routing check.

Single Node 22 runner. noy-db runs a 22 + 24 matrix because `@noy-db/hub` must be portable across
runtimes; that rationale does not extend to a Vue UI layer, and `ci.yml` already covers the normal
matrix.

**`publish`** — `needs: verify`, guarded to release-or-confirmed-dispatch, checks out
`github.event.release.tag_name`, resolves the dist-tag, runs `pnpm release`, pushes changesets'
per-package tags.

The existing git-identity step is carried forward verbatim, including its comment: changesets creates
**annotated** tags, which fail with exit 128 on a runner with no committer identity, and changesets
discards that exit code after logging "New tag" — so the failure is silent and the subsequent tag
push finds nothing. That comment is hard-won and stays.

### dist-tag routing

Same rules as the siblings: `prerelease: true` → `next`, `prerelease: false` → `latest`,
`workflow_dispatch` → the `tag` input, all behind a `latest|next|canary|rc|beta|alpha` allowlist.
The resolved tag and the reason are written to the run summary before any publish happens.

### The pre-release guard — the one deliberate divergence from the siblings

Porting the sibling routing verbatim would **lose a safety property this repo currently has.** The
dispatch input is `required: true` with a choice list, so a human must consciously choose, and the
input description warns that landing a pre-release on `latest` "corrupts the tag for every consumer
and only a manual `npm dist-tag` repair undoes it."

Under a Release trigger that protection becomes an unchecked checkbox that silently routes to
`latest`. Every version this repo has ever published is a semver pre-release, and `@latest` is
already a stale `0.3.0-pre.3`. Forgetting to tick "Set as a pre-release" would push a pre-release
onto `latest` for all three packages at once.

This is not hypothetical damage. `@klum-db/lobby@latest` is currently rotten at `0.2.0-pre.26`,
whose peer range demands `@noy-db/hub ^0.2.0-pre.24` — anyone installing it untagged gets something
that cannot co-install with the rest of the family. That is the exact failure this guard prevents.

So the workflow refuses the mismatch:

```
version contains "-"  AND  release.prerelease != true   →  fail before publishing
```

Four lines that convert an irreversible-without-manual-repair mistake into a failed run.

### Provenance

The siblings publish with `--provenance`. `changeset publish` accepts no such flag — verified
against the installed 2.31.0, where `grep -rl provenance node_modules/@changesets/` returns nothing.
Changesets shells out to `pnpm publish`, so provenance is requested via `NPM_CONFIG_PROVENANCE=true`
in the job environment plus `id-token: write` on the job.

**This path is unverified end to end.** It is included because the fallback makes it cheap to be
wrong: if the first Release-triggered cut fails on provenance, `workflow_dispatch` still publishes.
**The first cut must be checked for the attestation badge on npm**; if the env var turns out not to
reach npm, provenance is silently absent rather than broken, and the fix is a follow-up.

## Release procedure after this lands

`gh release create` creates the tag, so there is no separate tagging step:

```bash
pnpm changeset                 # author
pnpm changeset version         # bump all three
# merge to main, then:
gh release create v0.3.0-pre.6 --target main --prerelease --generate-notes
```

Omitting `--prerelease` is what routes a stable cut to `@latest`. The guard above blocks the
dangerous half of that choice — a pre-release version can no longer reach `latest` by omission.

## Success criteria

1. `gh release list -R vLannaAi/noy-db-ui` returns rows, so sweep step 3 works unchanged.
2. A Release marked pre-release publishes all three packages to `@next`.
3. A Release **not** marked pre-release, on a version containing `-`, **fails before publishing**.
4. A tag whose version disagrees with any of the three `package.json`s fails before publishing.
5. Pushing an edit to `release.yml` runs `verify` and never publishes.
6. `workflow_dispatch` with `confirm: PUBLISH` still publishes, unchanged in behaviour.

## Out of scope

- Changing how versioning works (`fixed`/`linked` in changesets config).
- A docs-bridge payload job. noy-db and noy-db-to emit one; noy-db-docs consumes no `@noy-db/ui*`
  package at all, so there is nothing for a bridge to carry. A ui release's only docs obligation is
  the one-line `channels.next.noy-db-ui` edit in `docs.manifest.json`.
- Backfilling Releases for the existing 17 package tags.
