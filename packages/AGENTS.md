# AGENTS.md

Applies to all workspace packages under `packages/`.

## Boundaries

- Published SDK behavior belongs in packages; reference implementations are first-class downstream
  consumers that exercise public APIs as maintained E2E targets and consumer references.
- Shared cross-platform behavior usually belongs in `packages/universal/core-sdk` unless it is
  clearly platform-specific.
- Keep package-local `dev/` harnesses aligned with the SDK behavior they exercise.
- When public SDK behavior changes, update relevant TSDoc/JSDoc and package README guidance in the
  same change.

## Package READMEs

- Follow root Markdown rules and [`../STYLE_GUIDE.md`](../STYLE_GUIDE.md).
- Public package READMEs use the repo-standard Contentful header, package-specific `<h3>`, Guides,
  Reference, Contributing links, native beta status warning when applicable, and SDK-layer summary.
- Application-facing READMEs stay orientation-first: install, minimal initialization, common setup,
  critical caveats, and links to guides, reference implementations, and generated reference docs.
- Lower-level package READMEs are maintainer-oriented: direct users, stack position, minimal
  first-party usage, and generated reference links.
- TypeDoc owns exhaustive signatures, callback payloads, method catalogs, and exported type detail.
- Placeholder platform READMEs remain status markers until the package exists.
- Dev harness READMEs must distinguish the harness from both the published SDK and repo reference
  implementations.

## Common commands

For pnpm-managed packages with matching scripts, use `pnpm --filter <package-name> <script>` with
`typecheck`, `test:unit`, `build`, `size:check`, or `size:report`.

## Validate

- Run targeted `typecheck` for TypeScript or TSX package changes.
- Run unit tests when behavior, helpers, contracts, or tested code changed.
- Run package `build` when exports, bundled runtime code, emitted declarations, or packaging
  changed.
- When adding a package export or Rslib entry that emits a new bundle, add its matching
  `buildTools.bundleSize.gzipBudgets` entry in the same package change. This does not relax the root
  policy for changing existing budgets.
- Run `size:check` for runtime, export, dependency, bundler config, or bundle-shape changes, and
  handle failures under the root `Bundle size` policy.
- Validate package-local harnesses when changing flows they demonstrate.
- For package changes consumed by implementations, run `pnpm build:pkgs` before implementation
  install or tests.
- Identify and validate affected downstream SDKs or reference implementations for shared behavior,
  public contracts, preview behavior, event flow, or platform integration changes. If you skip one,
  report the exact reason and risk.
- Schedule package validation by the workspace dependency graph. Do not manually run SDK `build`,
  `clean`, `build:pkgs`, implementation install, `size:report`, or `size:check` commands in parallel
  across packages when one package can consume another package's generated output.
- Run upstream SDK build, package, and size commands to completion before starting downstream SDK
  build, package, or size commands. When the affected graph is broad or uncertain, prefer the
  aggregate workspace command so pnpm owns the dependency scheduling.
- Common package order is: `@contentful/optimization-api-schemas`, then
  `@contentful/optimization-api-client`, then `@contentful/optimization-core`, then leaf packages
  such as `@contentful/optimization-node`, `@contentful/optimization-react-native`,
  `@contentful/optimization-web`, and `@contentful/optimization-js-bridge`. Web dependents such as
  `@contentful/optimization-react-web` and `@contentful/optimization-web-preview-panel` run after
  `@contentful/optimization-web`; `@contentful/optimization-nextjs` runs after
  `@contentful/optimization-node`, `@contentful/optimization-web`, and
  `@contentful/optimization-react-web`.
