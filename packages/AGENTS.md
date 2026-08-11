# AGENTS.md

Applies to all workspace packages under `packages/`.

## Boundaries

- Published SDK behavior belongs in packages; reference implementations are first-class downstream
  consumers that exercise public APIs as maintained E2E targets and consumer references.
- Every `CoreStateful`-backed SDK participates in the same `globalThis` singleton lock. Exactly one
  active stateful SDK instance is supported per JavaScript runtime; call `destroy()` before replacing
  it during teardown or hot reload. Structural runtime interfaces, injected providers, snapshot
  runtimes, and test doubles do not represent permission to run multiple live stateful instances.
- Never model concurrent stateful SDK instances as supported behavior in state, request ownership,
  hydration, or tests. Singleton-enforcement tests may attempt a second construction only to assert
  that it fails. Framework roots and adapters either own the one active singleton or reuse that same
  injected singleton. Stateless request clients are the separate request-scoped model.
- Shared cross-platform behavior usually belongs in `packages/universal/core-sdk` unless it is
  clearly platform-specific.
- Keep package-local `dev/` harnesses aligned with the SDK behavior they exercise.
- When public SDK behavior changes, update relevant TSDoc/JSDoc and package README guidance in the
  same change.
- Stateful SDK APIs that wire shared runtime state must not use `create*` or factory wording unless
  they create truly isolated state; name and document them by purpose with initialize, bind, or
  configure.
- Exception to the root `eslint-disable` rule: package constants may use the standardized
  `// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time`
  suppression for bundler-injected replacement globals such as `__OPTIMIZATION_VERSION__`. Keep the
  suppression text and injected global naming consistent across packages.

## Dependency surfaces

- Treat **public API** as package-accessible API, not as a synonym for normal application-facing
  **consumer API**. Public surfaces may primarily serve downstream SDKs while remaining available
  for exceptional custom integrations and unsupported frameworks. State the intended audience in
  TSDoc and package guidance; do not hide an inter-SDK contract merely because ordinary
  applications rarely call it.
- Prefer purpose-specific public integration operations for coordination between lower- and
  higher-level SDKs. They must preserve the owning SDK's invariants and must not expose raw writable
  signals or invite callers to reproduce internal state transitions.
- Do not use a bridge as a generic private channel between SDKs or as a substitute for a defensible
  public integration contract. Reserve bridge capabilities for cases where offering the underlying
  authority as a supported integration contract would enable misuse, such as preview tooling that
  requires controlled access to writable Core signals to synthesize local preview state.
- SDK packages may expose pass-through entrypoints for lower-layer exports they intentionally make
  available to downstream adapters. A downstream SDK can depend on a single upstream SDK and reach
  lower-layer-owned exports through that upstream SDK's public pass-through entrypoints instead of
  adding direct dependencies on every source package.
- Keep ownership clear when using pass-throughs: implement behavior in the owning lower-layer
  package, export it through the chosen pass-through surface, and validate both the owner and the
  downstream consumer.
- Do not add direct workspace dependencies merely to reach exports that are already part of an
  intended public pass-through contract.

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
