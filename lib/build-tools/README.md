# Build Tools (internal)

> [!CAUTION]
>
> This package is internal workspace infrastructure. It is not a public SDK package and should not
> be imported by application code.

`build-tools` contains shared command-line helpers used by Optimization SDK package builds,
especially declaration emission and bundle-size checks. Keep cross-package build behavior here
instead of duplicating one-off scripts in downstream package directories.

## When to Use This Package

Use this package when maintaining shared build helper behavior, declaration output handling, or
bundle-size measurement. Package-specific bundle-size budgets belong in each package's
`package.json` under `buildTools.bundleSize.gzipBudgets`.

## Commands

Run commands from the monorepo root:

```sh
pnpm --filter build-tools typecheck
pnpm --filter build-tools test:unit
```

After changing emitted declaration logic, bundle-size measurement, or the CLI contract, validate at
least one downstream package build or run the broader repo build command that matches the change.

## Related

- [Local guidance](./AGENTS.md) - Build-tools maintenance rules
- [Root README](../../README.md) - Optimization SDK Suite overview
