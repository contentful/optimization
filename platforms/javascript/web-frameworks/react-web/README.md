# React Web SDK

Scaffold package for `@contentful/optimization-react-web`.

## Status

This package is currently scaffold-only and pre-release.

- Runtime behavior beyond the current placeholder surface is intentionally out of scope for this
  phase.
- React Web API semantics and parity coverage with other SDK layers are tracked as planned follow-up
  work.

## Purpose

`@contentful/optimization-react-web` is intended to become the React framework layer on top of
`@contentful/optimization-web`.

## Development

From repository root:

```sh
pnpm --filter @contentful/optimization-react-web build
pnpm --filter @contentful/optimization-react-web typecheck
pnpm --filter @contentful/optimization-react-web test:unit
pnpm --filter @contentful/optimization-react-web dev
```

From this package directory:

```sh
pnpm build
pnpm typecheck
pnpm test:unit
pnpm dev
```

## Current Contents

- package metadata and dual module exports
- `rslib`/`rsbuild`/`rstest`/TypeScript baseline aligned with Web SDK patterns
- placeholder React-facing API surface in `src/` (provider/root/personalization/analytics/hooks)
- scaffold dev dashboard harness in `dev/` for consent, identify/reset, state, events, and entries
