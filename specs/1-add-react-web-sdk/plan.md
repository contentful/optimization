# Implementation Plan: React Web SDK

## Summary

Create a React Web SDK package at `platforms/javascript/web-frameworks/react` that wraps and exposes
all currently supported Web SDK capabilities through React-native integration primitives (provider,
hooks, essential helper components), while preserving Web SDK semantics and maximizing runtime and
bundle-size performance.

## Technical Context

- Affected SDKs/packages:
  - New: `@contentful/optimization-react-web`
  - Existing integration dependency: `@contentful/optimization-web`
  - Existing references: `platforms/javascript/react-native`, `platforms/javascript/web`
- Public API or schema changes:
  - New package export surface for React integration (`Provider`, hooks, helper components).
  - No behavioral changes to `@contentful/optimization-web` contracts.
- Data/security considerations:
  - No new data classes beyond existing Optimization payloads.
  - Must preserve Web SDK handling for consent/profile/personalization state and avoid new sensitive
    logging.
- Rollout strategy:
  - New package published as additive feature.
  - Existing Web SDK consumers remain unaffected.
  - React consumers migrate with full replacement (no mixed direct Web SDK usage as supported mode).
- Performance constraints:
  - Bundle size is highest priority; dependency additions must be minimal and justified.
  - Hooks/provider implementations should avoid unnecessary subscriptions and re-renders.
- Testing constraints:
  - Unit/integration tests must use MSW handler helpers exported by the `mocks` workspace package
    (via dev dependency), not direct source-file handler imports.

## Constitution Check (Pre-Design)

- Type-Safe Public Contracts: PASS
  - Plan defines typed public React contracts and parity mapping to Web SDK behavior.
- Test-Gated Reliability: PASS
  - Unit/integration/e2e test categories included, with explicit MSW-handler constraint.
- Cross-SDK Consistency: PASS
  - React SDK semantics anchored to Web SDK; divergences limited to React ergonomics.
- Security and Privacy by Default: PASS
  - No expansion of data collection; logging and config behavior inherited from Web SDK patterns.
- Documentation Is a Release Artifact: PASS
  - README/quickstart/examples included in planned outputs.

## Gate Evaluation

- Gate 1: Full capability parity in initial release: PASS
- Gate 2: Browser + SSR support required in initial release: PASS (covered in requirements/design)
- Gate 3: Dependency minimization for bundle-size targets: PASS (research-backed constraints)
- Gate 4: MSW handler reuse in tests: PASS (via `mocks` workspace package helpers)

## Phase 0: Outline & Research

Research tasks executed from remaining uncertainty and key constraints:

1. Best practices for low-bundle-size React SDK wrapper design over an existing Web SDK.
2. Package/build/test convention parity with `platforms/javascript/web`.
3. React integration pattern selection informed by existing React Native SDK abstractions.
4. Test harness approach using shared MSW handler helpers exported by the `mocks` workspace package.
5. SSR + client runtime compatibility strategy while preserving side-effect safety.

Output: `specs/1-add-react-web-sdk/research.md`

Reference anchors for downstream implementation:

- Wrapper strategy and parity boundary: `specs/1-add-react-web-sdk/research.md` (Decision 1)
- Build/test/tooling parity: `specs/1-add-react-web-sdk/research.md` (Decision 2)
- Dependency minimization policy: `specs/1-add-react-web-sdk/research.md` (Decision 3)
- Runtime compatibility (browser + SSR): `specs/1-add-react-web-sdk/research.md` (Decision 6)
- MSW via `mocks` package: `specs/1-add-react-web-sdk/research.md` (Decision 8)

## Phase 1: Design & Contracts

1. Produce entity and lifecycle model for React SDK integration context and primitives.
   - Output: `specs/1-add-react-web-sdk/data-model.md`
   - References:
     - `specs/1-add-react-web-sdk/spec.md` (Functional Requirements 1-4, 8, 13-16)
     - `specs/1-add-react-web-sdk/research.md` (Decisions 1, 4, 6, 8)
2. Produce SDK contract artifact for public integration surface and behavior expectations.
   - Output: `specs/1-add-react-web-sdk/contracts/react-web-sdk-contract.md`
   - References:
     - `specs/1-add-react-web-sdk/spec.md` (Functional Requirements 2, 5, 9, 11, 16)
     - `specs/1-add-react-web-sdk/data-model.md` (CapabilityMapping, ReactOptimizationInstance)
3. Produce quickstart flow with package standards, performance guidance, and MSW testing guidance.
   - Output: `specs/1-add-react-web-sdk/quickstart.md`
   - References:
     - `specs/1-add-react-web-sdk/spec.md` (Success Criteria 1-4, Test Strategy)
     - `specs/1-add-react-web-sdk/research.md` (Decisions 2, 3, 8)
4. Update agent context.
   - Command: `.specify/scripts/bash/update-agent-context.sh codex`

## Constitution Check (Post-Design)

- Type-Safe Public Contracts: PASS
  - Contracts and data model define typed, explicit integration surfaces and compatibility behavior.
- Test-Gated Reliability: PASS
  - Test plan references unit/integration/e2e coverage and shared MSW handlers.
- Cross-SDK Consistency: PASS
  - Contract establishes parity with Web SDK capabilities and migration behavior.
- Security and Privacy by Default: PASS
  - No additional data categories; observability guidance avoids sensitive payload leakage.
- Documentation Is a Release Artifact: PASS
  - Quickstart and migration guidance generated as first-class outputs.

## Phase 2: Planning Work Breakdown

1. Scaffold package at `platforms/javascript/web-frameworks/react` with Web-SDK-consistent config.
   - Implementation references:
     - `platforms/javascript/web/package.json`
     - `platforms/javascript/web/tsconfig.json`
     - `platforms/javascript/web/tsconfig.build.json`
     - `platforms/javascript/web/vite.esm.config.ts`
     - `platforms/javascript/web/vitest.config.ts`
     - `specs/1-add-react-web-sdk/quickstart.md` (Setup Steps)
2. Implement provider, hooks, and essential helper components with render-minimizing patterns.
   - Implementation references:
     - `platforms/javascript/react-native/src/components/OptimizationProvider.tsx`
     - `platforms/javascript/react-native/src/context/OptimizationContext.tsx`
     - `platforms/javascript/react-native/src/index.ts`
     - `specs/1-add-react-web-sdk/data-model.md` (OptimizationProviderContext)
     - `specs/1-add-react-web-sdk/contracts/react-web-sdk-contract.md` (Public Exports)
3. Map Web SDK capabilities to React-facing APIs and document parity/limitations.
   - Implementation references:
     - `platforms/javascript/web/src/index.ts`
     - `platforms/javascript/web/src/Optimization.ts`
     - `specs/1-add-react-web-sdk/data-model.md` (CapabilityMapping)
     - `specs/1-add-react-web-sdk/contracts/react-web-sdk-contract.md`
4. Implement SSR-safe and browser-safe initialization paths.
   - Implementation references:
     - `platforms/javascript/web/src/Optimization.ts`
     - `specs/1-add-react-web-sdk/spec.md` (Functional Requirements 13-14)
     - `specs/1-add-react-web-sdk/research.md` (Decision 6)
5. Add tests using MSW handler helpers exported by the `mocks` workspace package.
   - Implementation references:
     - `lib/mocks/src/index.ts`
     - `specs/1-add-react-web-sdk/spec.md` (Functional Requirement 16, Test Strategy)
     - `specs/1-add-react-web-sdk/contracts/react-web-sdk-contract.md` (Testing Contract)
6. Add performance and bundle-size checks to release validation.
   - Implementation references:
     - `platforms/javascript/web/vite.esm.config.ts`
     - `platforms/javascript/web/vite.umd.config.ts`
     - `specs/1-add-react-web-sdk/spec.md` (Non-Functional Quality Attributes)
     - `specs/1-add-react-web-sdk/research.md` (Decisions 2, 3)
7. Finalize README and quickstart documentation.
   - Implementation references:
     - `platforms/javascript/web/README.md`
     - `specs/1-add-react-web-sdk/quickstart.md`
     - `specs/1-add-react-web-sdk/contracts/react-web-sdk-contract.md`

## Risks and Mitigations

- Risk: Bundle-size regression from unnecessary framework-level abstractions.
- Mitigation: Strict dependency budget, tree-shakeable exports, and parity-only scope.
- Risk: React wrapper behavior diverges from Web SDK semantics.
- Mitigation: Capability mapping contract and parity-focused integration tests.
- Risk: SSR/client runtime differences cause initialization mismatch.
- Mitigation: Explicit runtime guardrails and runtime-path test coverage.

## Verification Results

- Typecheck command:
  - `pnpm --filter @contentful/optimization-react-web typecheck`
  - Result: PASS
- Test command:
  - `pnpm --filter @contentful/optimization-react-web test:unit`
  - Result: PASS
  - Note: React `act(...)` environment warnings are emitted by the current test runtime, but tests
    pass.
- Build command:
  - `pnpm --filter @contentful/optimization-react-web build`
  - Result: PASS
