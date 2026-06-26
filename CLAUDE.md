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

## Releasing (requires explicit user confirmation — never publish unprompted)

Changesets + `pnpm release`. Add a changeset (`pnpm changeset`) for any user-facing change; versions are
`0.0.0` until the first cut. Packages are public-scoped (`publishConfig.access: public`).

## Where to read more

`docs/ui/` — the family docs (concepts, engine, tokens, architecture). `docs/ui-nuxt/` — the binding docs
(installation, configuration, components, theme, AI/voice, internals). Each package's `README.md` links in.
