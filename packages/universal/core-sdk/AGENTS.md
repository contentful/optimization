# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns platform-agnostic optimization business logic and the shared stateful and
stateless core used by all platform SDKs.

## Key Paths

- `src/`
- `README.md`

## Local Rules

- Prefer shared behavior fixes here when the problem affects more than one platform SDK.
- Do not introduce platform-specific browser, Node, or React Native assumptions here.
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
