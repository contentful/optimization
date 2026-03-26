# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package contains internal build helpers used by workspace package builds, especially around
build output, declaration emission, and shared bundle-size enforcement.

## Key Paths

- `src/`
- `bin/`

## Local Rules

- Treat changes here as high-impact. Even a small helper change can affect many package builds.
- Keep command-line interfaces and helper behavior stable unless the task explicitly changes them.
- Prefer fixing build logic here rather than adding one-off build workarounds in downstream
  packages.
- Keep bundle-size logic centralized here. Package-specific thresholds belong in each package's
  `package.json` under `buildTools.bundleSize.gzipBudgets`, not in duplicated scripts.

## Commands

- `pnpm --filter build-tools typecheck`
- `pnpm --filter build-tools test:unit`

## Usually Validate

- Always run `typecheck` and `test:unit`.
- Also run at least one downstream package build, or `pnpm build`, when changing build behavior,
  declaration emission, or bundle-size measurement logic.
- Run `pnpm size:report` or `pnpm size:check` after changing bundle-size measurement logic or the
  CLI contract.
