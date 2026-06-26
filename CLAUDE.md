# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**noy-db-ui** — the UI family for [noy-db](https://github.com/vLannaAi/noy-db) vaults. A noy-db
collection self-describes via `collection.describe()` (labels, types, units, enums, refs, edit widgets);
this repo turns that metadata into UI — **list, detail, search, edit, AI/voice** — with no
per-collection code. Domain-free, design-system-free (everything is `--nui-*` CSS variables),
local-first.

## Packages

Two packages, one rule — **bare name = the agnostic base, `<framework>` suffix = the binding**
(mirrors noy-db's `@noy-db/in-*` integrations):

| Package | Dir | What |
|---|---|---|
| **`@noy-db/ui`** | `packages/ui` | framework-agnostic base — the search/list engine, `schemaFromDescribe` + joins, the `detail`/`form` resolvers, `useCollectionList`, and the design tokens (`tokens.css`). Pure TS + CSS. |
| **`@noy-db/ui-nuxt`** | `packages/ui-nuxt` | the Nuxt binding — components + the `core/` config layer + the Nuxt module. Depends on `@noy-db/ui` (`workspace:*`). |

`@noy-db/hub` (the vault runtime) is an external peer, consumed from npm — **not** a workspace package
here.

## The `nui` namespace

`nui` = **noy-db UI**. The one prefix for everything cross-cutting, so the library never collides with a
host's Tailwind/Nuxt UI: CSS tokens `--nui-*`, utility classes `nui-*`, i18n keys `nui.*`. Keep using it.

## Build / test / lint

```bash
pnpm install          # pnpm@9.15.4 workspace
pnpm build            # turbo → tsup (each package to dist/)
pnpm test             # turbo → vitest (engine unit tests live in @noy-db/ui)
pnpm typecheck        # @noy-db/ui: tsc · @noy-db/ui-nuxt: vue-tsc (covers .vue)
pnpm lint             # eslint (TS; .vue is type-checked by vue-tsc, not linted)

# one package:
pnpm --filter @noy-db/ui test
```

## Build shapes (how each package ships)

- **`@noy-db/ui`** — tsup, dual ESM+CJS + `.d.ts`/`.d.cts`. `tokens.css` is copied verbatim into `dist`.
- **`@noy-db/ui-nuxt`** — tsup builds only `src/module.ts` (the Nuxt module factory). The **runtime**
  (`src/runtime/`: `.vue` components, `internal/`, `core/`, the client plugin) ships as **source** under
  `dist/runtime` and is compiled by the consuming Nuxt app (Nuxt transpiles module runtime). The
  pre-compiled CSS (`dist/style.css`) is produced by `build:css` (UnoCSS) after tsup. The module
  resolves `./runtime/*` at run time.
  - Runtime that touches Nuxt virtuals imports from `nuxt/app` (not `#imports`) so it type-checks
    standalone. The module's default export is explicitly annotated `NuxtModule<NoydbUiOptions>` to keep
    the emitted `.d.ts` portable (avoids TS2742).

## Conventions

- **Nuxt-UI-free / framework-agnostic core.** `@noy-db/ui` must never import a framework binding or any
  app/domain code. Anything Vue lives in `@noy-db/ui-nuxt`; anything domain-specific stays in the host.
- **Mechanism vs data.** Generic mechanism ships here (injectable synonyms, schema-driven resolvers,
  injected LLM/voice); domain data is supplied by the host.
- **i18n.** Every user-facing string routes through `useNuiI18n()` as `t('nui.<area>.<key>', '<English
  fallback>')` — usable unconfigured, translatable when a host supplies `t`.
- Match the style of the file you're editing.

## Verify (the commit gate — run before every commit)

The full pipeline must be green. Run it from the repo root:

```bash
pnpm install
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

What "green" means — check each, don't trust an early exit:

| Step | Expected |
|---|---|
| `pnpm build` | `@noy-db/ui` → `dist/{index.js,index.cjs,index.d.ts,index.d.cts,tokens.css}`; `@noy-db/ui-nuxt` → `dist/{module.js,module.d.ts}`, `dist/runtime/` (copied source), `dist/style.css` ("✔ N utilities generated") |
| `pnpm lint` | `Tasks: N successful`, 0 errors |
| `pnpm typecheck` | `@noy-db/ui` tsc clean · `@noy-db/ui-nuxt` vue-tsc clean (covers `.vue`) |
| `pnpm test` | `@noy-db/ui` **30 tests** pass (engine unit tests; the binding has none) |

If you changed the build wiring, also confirm `dist/` is gitignored and **not** staged
(`git status --short | grep dist` → empty).

## Validate (before publishing — beyond the commit gate)

```bash
# 1. Package export / types correctness (publint is not a devDep — run via dlx).
#    Build first; publint inspects dist + the exports map.
pnpm build
pnpm dlx publint packages/ui
pnpm dlx publint packages/ui-nuxt
#   Both must print "All good!". Note: @noy-db/ui-nuxt exports ./core as TypeScript
#   source (./dist/runtime/core/index.ts) — intentional, the Nuxt consumer transpiles
#   the runtime; publint accepts it. The module entry is exported at both "." and
#   "./module" (same target), so `modules: ['@noy-db/ui-nuxt']` and
#   `'@noy-db/ui-nuxt/module'` both work.

# 2. What actually ships in the tarball (no stray src, tests, or .map-only output).
#    Run from each package dir:
( cd packages/ui      && npm pack --dry-run )
( cd packages/ui-nuxt && npm pack --dry-run )
#   Expect only: dist/**, README.md, LICENSE (the `files` field).

# 3. End-to-end smoke test (the one thing CI can't prove): consume the packed
#   tarballs from a scratch Nuxt 4 app — add '@noy-db/ui-nuxt/module', render a
#   <CollectionList>, confirm components register, CSS loads, and types resolve.
```

A change is publish-ready only when the commit gate is green AND `publint` shows nothing beyond the
known `./core` note AND the Nuxt smoke test renders.

## Create the GitHub repo (first push)

The `repository` / `homepage` / `bugs` URLs already point at `vLannaAi/noy-db-ui`. The local repo is
already `git init`-ed on `main` with an initial commit. To create and push:

```bash
# with the gh CLI (creates the remote repo + pushes in one step):
gh repo create vLannaAi/noy-db-ui --public --source=. --remote=origin --push

# or manually, if the repo already exists on GitHub:
git remote add origin git@github.com:vLannaAi/noy-db-ui.git
git push -u origin main
```

After the first push, confirm CI is green on GitHub (`.github/workflows/ci.yml` runs
install → build → lint → typecheck → test on push/PR to `main`).

## Releasing (requires explicit user confirmation — never publish unprompted)

Versions are `0.0.0` until the first cut. Packages are public-scoped (`publishConfig.access: public`),
so publishing needs an npm account with access to the `@noy-db` scope (`npm whoami`).

```bash
pnpm changeset            # pick packages + bump level + write the summary
pnpm changeset version    # apply pending changesets → bump versions + update CHANGELOGs
pnpm install              # refresh the lockfile after the version bumps
git commit -am "release: <summary>"
# then, only on explicit confirmation:
pnpm release              # = pnpm build && changeset publish --tag latest
```

`@noy-db/ui-nuxt` depends on `@noy-db/ui` via `workspace:*`; changesets rewrites that to the real version
range on publish, so cut and publish them together.

## Where to read more

`docs/ui/` — the family docs (concepts, engine, tokens, architecture). `docs/ui-nuxt/` — the binding docs
(installation, configuration, components, theme, AI/voice, internals). Each package's `README.md` links in.
