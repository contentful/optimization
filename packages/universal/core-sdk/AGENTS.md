# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, and `packages/universal/AGENTS.md`
before this file.

## Scope

This package owns platform-agnostic optimization business logic and the shared stateful and
stateless core used by all platform SDKs.

## Key Paths

- `src/` — root entry: stateless/stateful core, signals, events, queues, interceptors, resolvers
- `src/preview-support/` — preview-panel toolkit with additional local guidance
- `README.md`

## Local Rules

- Prefer shared behavior fixes here when the problem affects more than one platform SDK.

## Commands

- `pnpm --filter @contentful/optimization-core typecheck`
- `pnpm --filter @contentful/optimization-core test:unit`
- `pnpm --filter @contentful/optimization-core build`
- `pnpm --filter @contentful/optimization-core size:check`

## Usually Validate

- Run `typecheck`, `test:unit`, and `build`.
