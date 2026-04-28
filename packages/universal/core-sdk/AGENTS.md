# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns platform-agnostic optimization business logic and the shared stateful and
stateless core used by all platform SDKs. It also owns the cross-platform preview-panel support
toolkit (override management, preview-model building, Contentful entry mapping) that powers the
preview panels shipped with the platform SDKs.

## Key Paths

- `src/` — root entry: stateless/stateful core, signals, events, queues, interceptors, resolvers
- `src/preview-support/` — preview-panel toolkit (`PreviewOverrideManager`, `buildPreviewModel`,
  Contentful entry mappers, fetch helpers); exposed via the dedicated `./preview-support` entry
  point
- `README.md`

## Local Rules

- Prefer shared behavior fixes here when the problem affects more than one platform SDK.
- Do not introduce platform-specific browser, Node, or React Native assumptions here.
- Contentful content-model knowledge (`nt_audience`, `nt_experience`, `nt_config`, …) lives only
  under `src/preview-support/`. Keep the rest of core platform-agnostic and free of Contentful
  schema knowledge.
- The `./preview-support` entry is consumed by the React Native SDK (re-exported as its own
  `./preview-support` entry) and the iOS JSC bridge. Re-validate those when changing public behavior
  under `src/preview-support/`.
- Changes in this package often cascade to Node, Web, and React Native SDKs. Validate accordingly.
- Update README and TSDoc when public behavior changes.

## Commands

- `pnpm --filter @contentful/optimization-core typecheck`
- `pnpm --filter @contentful/optimization-core test:unit`
- `pnpm --filter @contentful/optimization-core build`
- `pnpm --filter @contentful/optimization-core size:check`

## Usually Validate

- Run `typecheck`, `test:unit`, and `build`.
- Run `size:check` for runtime, export, dependency, or bundle-shape changes.
- Also validate affected downstream SDKs or implementations when touching exported types, state
  management, event flow, preview behavior, or shared optimization logic.
