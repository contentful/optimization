# Research: React Web SDK

## Decision 1: Build directly on `@contentful/optimization-web` with a thin React adapter

- Decision: The React package will wrap the Web SDK instance and expose React primitives without
  adding new core behavior.
- Rationale: Preserves capability parity, reduces maintenance surface, and minimizes bundle growth
  by reusing existing runtime logic.
- Alternatives considered:
  - Re-implement Web behavior in React package (rejected: high drift and maintenance risk).
  - Build on `@contentful/optimization-core` only (rejected: violates explicit requirement to base
    solely on Web SDK).

## Decision 2: Follow Web SDK build/test configuration patterns with minimal deltas

- Decision: Use monorepo TS base config inheritance, Vite-based builds, Vitest tests, and a Vite dev
  dashboard HTML entry, matching `platforms/javascript/web` conventions.
- Rationale: Ensures consistency in package scripts and tooling behavior across monorepo packages.
- Alternatives considered:
  - Use alternative bundler/build pipeline (rejected: consistency and operational friction).
  - Reuse React Native `rslib` setup (rejected: target package should align with Web SDK, not RN).

## Decision 3: Keep dependency policy "React + required peer/runtime only"

- Decision: Add dependencies sparingly; default to existing workspace libraries and avoid
  introducing new runtime dependencies unless essential.
- Rationale: User priority is performance and bundle size, and unnecessary dependencies increase
  both transfer and execution costs.
- Alternatives considered:
  - Add helper utility libraries for convenience (rejected: avoid bundle inflation).
  - Add state libraries for context management (rejected: React context/hooks are sufficient).

## Decision 4: Require provider + hooks + essential helper components in v1

- Decision: Initial release must include provider-based setup, hook-based consumption, and essential
  helper components for common flows.
- Rationale: This balances usability with bounded scope and aligns with clarified feature decisions.
- Alternatives considered:
  - Hooks-only surface (rejected: weak onboarding ergonomics).
  - Provider/hooks without helper components (rejected: incomplete common-flow support).

## Decision 5: Enforce full migration replacement and no mixed support mode

- Decision: Supported migration path is full replacement of direct Web SDK usage in React apps.
- Rationale: Prevents ambiguous ownership of state/event behavior and simplifies support boundaries.
- Alternatives considered:
  - Side-by-side migration support (rejected by clarification decision).

## Decision 6: Runtime compatibility target is browser + SSR in initial release

- Decision: Design and validate both client-rendered and server-rendered runtime behavior.
- Rationale: Clarified requirement mandates both environments in initial release.
- Alternatives considered:
  - Browser-only initial support (rejected by clarification decision).

## Decision 7: Standardized logs + metrics guidance, optional tracing

- Decision: Require deterministic logging and metrics guidance for integration and troubleshooting;
  tracing remains optional in v1.
- Rationale: Meets operational readiness requirement without over-constraining initial scope.
- Alternatives considered:
  - Mandatory tracing in v1 (rejected: scope and implementation overhead).
  - No explicit observability guidance (rejected: weak diagnosability).

## Decision 8: Use shared MSW handler helpers from the `mocks` workspace package

- Decision: Tests that simulate API interactions must consume handler helpers exported by the
  `mocks` workspace package (declared as a dev dependency).
- Rationale: Enforces consistency with monorepo fixtures and avoids drift in test behavior.
- Alternatives considered:
  - Direct imports from `lib/mocks/src/*-handlers.ts` (rejected: tighter coupling to internal file
    layout).
  - Feature-local ad hoc handlers (rejected: inconsistency and duplicate fixtures).
