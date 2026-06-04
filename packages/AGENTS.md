# AGENTS.md

Applies to all workspace packages under `packages/`.

## Boundaries

- Published SDK behavior belongs in packages; reference implementations only demonstrate it.
- Shared cross-platform behavior usually belongs in `packages/universal/core-sdk` unless it is
  clearly platform-specific.
- Keep package-local `dev/` harnesses aligned with the SDK behavior they exercise.
- When public SDK behavior changes, update relevant TSDoc/JSDoc and package README guidance in the
  same change.

## Package READMEs

- Follow root Markdown rules and [`../STYLE_GUIDE.md`](../STYLE_GUIDE.md).
- Public package READMEs use the repo-standard Contentful header, package-specific `<h3>`, Guides,
  Reference, Contributing links, pre-release warning, and SDK-layer summary.
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
- Run `size:check` for runtime, export, dependency, bundler config, or bundle-shape changes.
- Validate package-local harnesses when changing flows they demonstrate.
- For package changes consumed by implementations, run `pnpm build:pkgs` before implementation
  install or tests.
- Broaden to affected downstream SDKs or reference implementations for shared behavior, public
  contracts, preview behavior, event flow, or platform integration changes.
