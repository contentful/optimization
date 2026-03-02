# React Web SDK

React Web SDK package for `@contentful/optimization-react-web`.

## Status

Core root/provider primitives are implemented.

- `OptimizationProvider` + `useOptimization()` context behavior
- `LiveUpdatesProvider` + `useLiveUpdates()` global live updates context
- `OptimizationRoot` provider composition and defaults

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
- core provider/root/context primitives in `src/`
- scaffold dev dashboard harness in `dev/` for consent, identify/reset, state, events, and entries

## Usage

### Recommended Wrapper

Use `OptimizationRoot` as the standard top-level wrapper:

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-web'

<OptimizationRoot instance={optimization}>
  <App />
</OptimizationRoot>
```

`OptimizationRoot` composition order:

1. `OptimizationProvider` (outermost)
2. `LiveUpdatesProvider`
3. application children

### Provider Requirements

- `OptimizationProvider` requires `instance`.
- `OptimizationRoot` requires `instance`.
- `OptimizationRoot.liveUpdates` is optional and defaults to `false`.

### Hooks

- `useOptimization()` returns the current SDK instance.
- `useOptimization()` throws if used outside `OptimizationProvider`.
- `useLiveUpdates()` returns the live updates context or `null` outside `LiveUpdatesProvider`.

### Live Updates Resolution Semantics

Consumers should resolve live updates behavior with:

```ts
const isLiveUpdatesEnabled = componentLiveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false
```

This gives:

- component-level `liveUpdates` prop override first
- then root-level `liveUpdates`
- then default `false`
