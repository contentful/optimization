# AGENTS.md

Read the repository root `AGENTS.md` first, then the nearest package-specific `AGENTS.md`.

These instructions apply to all workspace packages under `packages/`.

## Package Boundaries

- Published SDK behavior belongs in packages, not in `implementations/` reference apps.
- Keep reusable cross-platform behavior in `packages/universal/core-sdk` unless it is clearly
  platform-specific.
- Keep package-local `dev/` harnesses and other development surfaces aligned with the current SDK
  behavior they are meant to exercise.
- When public SDK behavior changes, update the relevant TSDoc or JSDoc and the package README in the
  same change.

## Package README Standards

- Public package READMEs should open with the repository-standard centered Contentful header,
  package-specific `<h3>`, navigation links to Guides, Reference, and Contributing, the pre-release
  warning, and a short paragraph that states the package layer and the SDK suite relationship.
- Package README header navigation must work in GitHub source browsing, TypeDoc project documents,
  and npmjs package README rendering. Prefer canonical absolute URLs for generated Guides and
  Reference links in that header; do not change them to repo-relative source links unless npm
  publish rewriting and TypeDoc output have both been verified.
- Include a collapsible table of contents for public package READMEs with more than a short status
  note. Preserve `<!-- mtoc-start -->` and `<!-- mtoc-end -->` markers.
- Application-facing SDK package READMEs, such as Web, React Web, React Native, and Node, should
  stay orientation-first. Keep purpose, install, minimal initialization, common setup options, one
  or two core workflows, critical runtime caveats, and links to guides, reference implementations,
  and generated reference docs. Do not turn these READMEs into exhaustive API manuals.
- Lower-level package READMEs, such as Core, API Client, API Schemas, preview-panel internals, and
  bridge packages, should be maintainer-oriented. State who should use the package directly, explain
  where it sits in the SDK stack, include only minimal usage or common options needed for successful
  first-party work, and link to generated reference docs for exported APIs.
- Prefer this public package section order unless the package has a clear local exception:
  1. `## Getting Started`
  2. `## When to Use This Package`
  3. reference implementation, harness, or usage-orientation sections when relevant
  4. `## Configuration`
  5. common workflows, runtime notes, or package-layer notes
  6. `## Related`
- In `Getting Started`, show installation with `pnpm install`, then the smallest useful import and
  initialization example. Mention CJS support only when the package supports it, but keep ESM
  preferred.
- Use tables for common option references with `Option`, `Required?`, `Default`, and `Description`
  columns when those options are crucial to initial setup. Leave exhaustive config tables, callback
  payload shapes, method argument lists, and exported type details to generated reference docs
  unless they are needed to avoid an integration trap.
- State "Most application code should use..." when documenting lower-level packages such as Core,
  API Client, or API Schemas, so package hierarchy remains clear.
- Link to repository reference implementations that exercise the package. Do not link to external
  demos as the primary example source.
- Body links to other source-of-truth repo files may stay repo-relative when TypeDoc can resolve
  them and the package publish flow rewrites them for npm. If a package README link needs to work
  without publish rewriting, use a stable absolute GitHub or generated-docs URL instead.
- Placeholder platform package READMEs, such as planned native SDKs, should remain status markers:
  `# Optimization <Platform> SDK`, `## Current Status`, and `## When to Use This Directory`. Do not
  add install commands, exports, package scripts, or setup steps before the package exists.
- Package-local dev harness README files should clearly distinguish the harness from the published
  SDK surface and repo-level reference implementations. Prefer `## Quick Start`, `## Prerequisites`,
  `## Troubleshooting`, architecture, environment, and script sections when the harness has local
  app workflows.
- Internal sub-entry or support README files should use a plain Markdown title, identify the surface
  as internal, state the narrow first-party use case, and avoid presenting the entry as an
  application-facing SDK.

## Generated And Derived Files

- Edit package source, configuration, docs, tests, and harness files rather than generated outputs.
- Do not hand-edit package `dist/`, `.rslib/`, `.rsdoctor/`, `coverage/`, or local `node_modules/`
  artifacts.

## Common Pnpm Commands

For pnpm-managed packages with matching package scripts:

- `pnpm --filter <package-name> typecheck`
- `pnpm --filter <package-name> test:unit`
- `pnpm --filter <package-name> build`
- `pnpm --filter <package-name> size:check`

## Usually Validate

- For pnpm-managed TypeScript or TSX packages, run the targeted package `typecheck`.
- Run package unit tests when behavior, helpers, contracts, or test-covered code changed and a
  meaningful test script exists.
- Run the package `build` when exports, bundling, emitted declarations, runtime code, or packaging
  changed and the package provides a build script.
- Run `size:check` for runtime, export, dependency, bundler config, or bundle-shape changes when the
  package provides that script.
- Validate the package-local harness itself when changing flows it is meant to demonstrate.
- For package changes consumed by implementations, run `pnpm build:pkgs` before reinstalling or
  running implementation tests.
- Broaden validation to affected downstream SDKs or reference implementations when shared behavior,
  public contracts, preview behavior, event flow, or platform integrations changed.
