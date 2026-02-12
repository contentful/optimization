# Quickstart: React Web SDK

## Package Location

- `/Users/charles.hudson/Projects/contentful/optimization/platforms/javascript/web-frameworks/react`

## Goals

- Expose full Web SDK capability coverage through React APIs.
- Support both browser-rendered and server-rendered React usage.
- Prioritize performance and bundle size via minimal dependency policy.

## Setup Steps

1. Create package scaffold under `platforms/javascript/web-frameworks/react`.
2. Configure TypeScript by extending monorepo base config in the same pattern as Web SDK.
3. Configure Vite build scripts to match Web SDK conventions (`build`, `build:esm`, optional UMD if
   required by package parity policy).
4. Configure Vitest for unit/integration coverage with `happy-dom` where browser-like behavior is
   needed.
5. Add Vite dev dashboard HTML entry for local validation workflows.

## Required Public Surface

- Provider-based initialization for app root integration.
- Hook-based consumption for runtime access in components.
- Essential helper components for common flows.
- Export mappings documented against Web SDK capabilities.

## Performance and Bundle-Size Guardrails

- Dependency additions must be strictly justified and minimized.
- Prefer re-exporting or wrapping existing Web SDK behavior over introducing new runtime layers.
- Keep exports tree-shakeable and avoid side effects in module top-level scope.
- Avoid unnecessary React re-renders via stable context values and selective subscriptions.

## Testing Guidance

Use MSW handler helpers exported by the `mocks` workspace package for API behavior simulation in
tests. Add `mocks` as a dev dependency in the React SDK package and import handlers via package
exports, not direct source file paths.

Expected checks:

1. `pnpm --filter @contentful/optimization-react-web test:unit`
2. `pnpm --filter @contentful/optimization-react-web typecheck`
3. `pnpm --filter @contentful/optimization-react-web build`

## Migration Guidance

- Supported migration path is full replacement of direct Web SDK usage in React applications.
- Mixed direct Web SDK + React SDK usage in the same app is not a supported steady state.
