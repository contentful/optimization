# Tasks: React Web SDK

## Phase 1: Setup (Project Initialization)

- [x] T001 Create React Web SDK package directory at
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react`
- [x] T002 Create package manifest aligned to Web SDK conventions in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/package.json`
- [x] T003 Create TypeScript project config extending monorepo base in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/tsconfig.json`
- [x] T004 Create declaration-build config and references in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/tsconfig.build.json`
- [x] T005 [P] Create Vite ESM/CJS build config in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/vite.esm.config.ts`
- [x] T006 [P] Create Vitest config with workspace alias parity in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/vitest.config.ts`
- [x] T007 [P] Create dev dashboard entry HTML for Vite dev mode in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/index.html`

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T008 Add source scaffolding and module boundaries in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/index.ts`
- [x] T009 Implement shared runtime config and instance factory around Web SDK in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/runtime/createOptimizationInstance.ts`
- [x] T010 Implement React context contract and error-guarded accessor base in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/context/OptimizationContext.tsx`
- [x] T011 Add `mocks` workspace dev dependency and test utility exports in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/package.json`
- [x] T012 Implement shared MSW test server setup using `mocks` package exports in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/test/mswServer.ts`
- [x] T013 Create capability mapping seed structure for parity tracking in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/contracts/capabilityMapping.ts`

## Phase 3: User Story 1 (P1) - Integrate React SDK in app root and consume capabilities in components

Goal: A frontend engineer can initialize the React SDK once at app root and consume Optimization
behavior from hooks/components in browser and SSR React flows.

Independent test criteria: A sample React app can mount the provider, call `useOptimization()`, and
execute core Web SDK-backed behavior in both client-rendered and server-rendered test paths.

- [x] T014 [US1] Implement `OptimizationProvider` with single-instance lifecycle in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/components/OptimizationProvider.tsx`
- [x] T015 [US1] Implement `useOptimization` hook with actionable out-of-provider errors in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/hooks/useOptimization.ts`
- [x] T016 [P] [US1] Implement essential helper component wrappers for common flows in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/components/`
- [x] T017 [US1] Export provider/hooks/helpers and typed public contract surface in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/index.ts`
- [x] T018 [US1] Add unit tests for provider/hook context and initialization guards in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/components/OptimizationProvider.test.tsx`
- [x] T019 [US1] Add SSR/client parity integration tests using shared `mocks` MSW helpers in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/integration/runtimeParity.test.tsx`

## Phase 4: User Story 2 (P2) - Migrate from direct Web SDK usage to React SDK with full capability parity

Goal: Teams can fully replace direct Web SDK integration in React apps and retain behavior parity
through documented capability mappings.

Independent test criteria: Migration example replaces direct Web SDK usage entirely with React SDK
APIs, and parity tests confirm equivalent outcomes for defined core flows.

- [x] T020 [US2] Implement parity adapters for React-facing access paths where shape differs from
      Web SDK in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/adapters/`
- [x] T021 [US2] Complete capability mapping table for all supported Web SDK capabilities in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/contracts/capabilityMapping.ts`
- [x] T022 [US2] Add migration-focused integration tests validating full replacement behavior in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/src/integration/migrationReplacement.test.tsx`
- [x] T023 [US2] Write migration guide and parity notes in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/README.md`

## Phase 5: User Story 3 (P3) - Maintainer validates quality, performance posture, and release readiness

Goal: Maintainers can run standard package quality gates and confirm dependency/performance
constraints and observability guidance are met.

Independent test criteria: Package passes build/typecheck/unit checks, has explicit dependency-cap
enforcement rationale, and includes standardized logs/metrics guidance.

- [x] T024 [US3] Add release validation scripts for build/typecheck/test parity in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/package.json`
- [x] T025 [P] [US3] Add bundle analysis/report generation for qualitative review in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/vite.esm.config.ts`
- [x] T026 [US3] Add dependency-policy check and exception documentation template in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/README.md`
- [x] T027 [US3] Document standardized logs/metrics guidance and tracing optionality in
      `/Users/charles.hudson/w/optimization/platforms/javascript/web-frameworks/react/README.md`

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T028 [P] Validate contract/spec/plan alignment and update SDK contract notes in
      `/Users/charles.hudson/w/optimization/specs/1-add-react-web-sdk/contracts/react-web-sdk-contract.md`
- [x] T029 [P] Update quickstart commands and examples to final package shape in
      `/Users/charles.hudson/w/optimization/specs/1-add-react-web-sdk/quickstart.md`
- [x] T030 Run final package verification (`build`, `typecheck`, `test:unit`) and capture outcomes
      in `/Users/charles.hudson/w/optimization/specs/1-add-react-web-sdk/plan.md`

## Dependencies

- Phase order dependency: Phase 1 -> Phase 2 -> Phase 3 (US1) -> Phase 4 (US2) -> Phase 5 (US3) ->
  Final Phase
- User story dependency graph:
  - US1 is MVP and has no story dependency beyond Foundational.
  - US2 depends on US1 runtime/provider/hook exports.
  - US3 depends on US1 and US2 implementation completeness for release validation.

## Parallel Execution Examples

- US1 parallel example:
  - Run T016 (helper components) in parallel with T018 (provider/hook unit tests) after T014-T015
    exist.
- US2 parallel example:
  - Run T021 (capability mapping) in parallel with T023 (migration docs) after T020 starts.
- US3 parallel example:
  - Run T025 (bundle analysis config) in parallel with T026 (dependency policy docs) after T024
    updates scripts.

## Implementation Strategy

- MVP first: Complete Phases 1-3 (through US1) to ship a usable React SDK integration surface.
- Increment 2: Add migration parity coverage and documentation (US2).
- Increment 3: Harden maintainer/release workflows and performance governance (US3).
- Finish with cross-cutting polish and final verification.
