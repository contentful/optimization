# AGENTS.md

Internal build helpers for package builds, declaration emission, build outputs, and bundle-size
enforcement.

## Rules

- Treat changes here as high-impact; helper behavior can affect many packages.
- Keep CLI contracts stable unless the task explicitly changes them.
- Prefer fixing shared build logic here over downstream one-off workarounds.
- Bundle-size thresholds are read from package `package.json` under
  `buildTools.bundleSize.gzipBudgets`; the root `Bundle size` policy controls whether they may be
  changed.

## Commands

- `pnpm --filter build-tools <script>` with `typecheck` or `test:unit`.

## Validate

- Always run `typecheck` and `test:unit`.
- Run at least one downstream package build, or `pnpm build`, for build behavior, declaration
  emission, or bundle-size measurement changes.
- Run `pnpm size:report` or `pnpm size:check` for bundle-size measurement or CLI-contract changes,
  and handle failures under the root `Bundle size` policy.
