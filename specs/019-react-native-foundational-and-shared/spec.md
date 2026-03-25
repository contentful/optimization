# Feature Specification: Optimization React Native Foundational and Shared Contracts

**Feature Branch**: `[019-react-native-foundational-and-shared]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initialize and Reuse a Single React Native SDK Instance (Priority: P1)

As a React Native integrator, I need SDK initialization to enforce one active runtime instance so
stateful signals, queues, and listeners are not duplicated.

**Why this priority**: Runtime initialization is the entry point for optimization and event-tracking
behavior.

**Independent Test**: Call `ContentfulOptimization.create(...)` repeatedly in one JS runtime and
verify singleton enforcement before and after `destroy()`.

**Acceptance Scenarios**:

1. **Given** no active React Native SDK instance, **When** `ContentfulOptimization.create(config)`
   is called, **Then** it resolves a new initialized `ContentfulOptimization` instance.
2. **Given** an active instance, **When** `ContentfulOptimization.create(config)` is called again,
   **Then** creation fails with the SDK already-initialized error.
3. **Given** an active instance is destroyed, **When** `ContentfulOptimization.create(config)` is
   called again, **Then** a replacement instance can be created.

---

### User Story 2 - Bridge App Lifecycle and Network State into Core Runtime Signals (Priority: P1)

As an SDK maintainer, I need React Native AppState and connectivity changes wired into core runtime
APIs so flush and online/offline behavior remains consistent.

**Why this priority**: Event delivery and queueing correctness depends on lifecycle and connectivity
signal wiring.

**Independent Test**: Simulate AppState and NetInfo transitions and verify `flush()` calls, `online`
updates, callback error handling, and listener cleanup behavior.

**Acceptance Scenarios**:

1. **Given** AppState changes to `background` or `inactive`, **When** the app-state listener runs,
   **Then** SDK `flush()` is invoked.
2. **Given** AppState changes to `active`, **When** the app-state listener runs, **Then** the flush
   callback is not invoked.
3. **Given** NetInfo emits state changes, **When** the online listener runs, **Then** SDK `online`
   is set from `isInternetReachable ?? isConnected ?? true`.
4. **Given** NetInfo is missing or has an invalid module shape, **When** online listener setup runs,
   **Then** a warning is logged and cleanup remains safe to call.
5. **Given** app-state or online callback logic throws/rejects, **When** listener callbacks run,
   **Then** errors are logged and execution continues.

---

### User Story 3 - Import a Stable Package Surface with Runtime Polyfills (Priority: P2)

As a package consumer, I need a predictable export surface and runtime setup behavior so the SDK can
be imported consistently across React Native toolchains.

**Why this priority**: Consumer integration and compatibility depend on stable package contracts.

**Independent Test**: Import root and subpath exports in ESM/CJS contexts and verify named exports,
constants fallbacks, and runtime polyfill side effects.

**Acceptance Scenarios**:

1. **Given** package root imports, **When** consumers import
   `@contentful/optimization-react-native`, **Then** the documented named React Native APIs are
   available (including `ContentfulOptimization`).
2. **Given** package root imports, **When** consumers attempt a root default import, **Then** no
   default root export contract is provided.
3. **Given** subpath imports (`./core-sdk`, `./logger`, `./constants`, `./api-client`,
   `./api-schemas`), **When** imported, **Then** each subpath resolves the documented module
   surface.
4. **Given** environments without `crypto.randomUUID`, **When** package entry executes, **Then** the
   React Native crypto polyfill provides `global.crypto.randomUUID`.
5. **Given** missing build-time metadata define replacement, **When** SDK metadata constants are
   read, **Then** fallback package name/version values are returned.

---

### Edge Cases

- `createOnlineChangeListener` cleanup may run before asynchronous NetInfo import resolves; late
  listener registration must be prevented.
- NetInfo callback/app-state callback failures must never crash the runtime.
- `destroy()` must only clear module-level active-instance tracking when called on the active
  instance.
- Runtime polyfill setup must remain safe for repeated imports (idempotent `randomUUID` assignment).
- `CoreStateful.destroy()` still runs on React Native instance teardown.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ContentfulOptimization.create(config)` MUST enforce one active React Native SDK
  instance per JS runtime.
- **FR-002**: `ContentfulOptimization.create(config)` MUST throw when called while an active React
  Native instance exists.
- **FR-003**: `ContentfulOptimization.create(config)` MUST await async config merge resolution
  before constructing the runtime.
- **FR-004**: `ContentfulOptimization` MUST extend `CoreStateful`.
- **FR-005**: Construction MUST register online/offline handling via
  `createOnlineChangeListener((isOnline) => { this.online = isOnline })`.
- **FR-006**: Construction MUST register AppState handling via
  `createAppStateChangeListener(async () => { await this.flush() })`.
- **FR-007**: `createOnlineChangeListener` MUST dynamically import `@react-native-community/netinfo`
  and validate that `default.addEventListener` exists.
- **FR-008**: Online-state resolution MUST use `isInternetReachable ?? isConnected ?? true`.
- **FR-009**: If NetInfo loading/validation fails, online-listener setup MUST log a warning and
  return a safe cleanup function.
- **FR-010**: Online-listener cleanup MUST prevent late subscription if called before async module
  loading completes.
- **FR-011**: AppState and online callback failures (sync or async) MUST be logged and swallowed.
- **FR-012**: `ContentfulOptimization.destroy()` MUST invoke online-listener and app-state listener
  cleanup handlers.
- **FR-013**: `ContentfulOptimization.destroy()` MUST clear module-level active instance tracking
  only when `activeOptimizationInstance === this`.
- **FR-014**: `ContentfulOptimization.destroy()` MUST call `CoreStateful.destroy()`.
- **FR-015**: Package root exports MUST provide named exports for current React Native APIs,
  including `OptimizationProvider`, `OptimizationRoot`, `OptimizedEntry`,
  `OptimizationScrollProvider`, `useScrollContext`, `LiveUpdatesProvider`, `useLiveUpdates`,
  `useOptimization`, `useInteractionTracking`, `useViewportTracking`, `useTapTracking`,
  `useScreenTracking`, `useScreenTrackingCallback`, `OptimizationNavigationContainer`,
  `OptimizationPreviewPanel`, `PreviewPanelOverlay`, `ContentfulOptimization`, and
  `OptimizationConfig`.
- **FR-016**: Package root MUST expose `OptimizationConfig` as an alias of `CoreStatefulConfig`.
- **FR-017**: Package root MUST export `ContentfulOptimization` as a named export (no root default
  export contract).
- **FR-018**: Package subpath exports MUST resolve `./core-sdk`, `./logger`, `./constants`,
  `./api-client`, and `./api-schemas`.
- **FR-019**: `./core-sdk` MUST re-export `@contentful/optimization-core`.
- **FR-020**: `OPTIMIZATION_REACT_NATIVE_SDK_NAME` MUST use build-time replacement when available,
  otherwise `'@contentful/optimization-react-native'`.
- **FR-021**: `OPTIMIZATION_REACT_NATIVE_SDK_VERSION` MUST use build-time replacement when
  available, otherwise `'0.0.0'`.
- **FR-022**: Package entry MUST import React Native runtime setup modules (`./images` and
  `./polyfills/crypto`).
- **FR-023**: React Native crypto polyfill setup MUST load iterator helpers and ensure
  `global.crypto` exists.
- **FR-024**: React Native crypto polyfill setup MUST assign `global.crypto.randomUUID` when missing
  and mirror `crypto` onto `globalThis.crypto` when absent.
- **FR-025**: Build artifacts MUST provide ESM (`*.mjs`), CJS (`*.cjs`), and dual declaration
  outputs (`*.d.mts`, `*.d.cts`) for the package entrypoints.
- **FR-026**: Build configuration MUST auto-externalize dependency/peer/optional packages.

### Key Entities _(include if feature involves data)_

- **ContentfulOptimization (React Native Runtime)**: Stateful SDK runtime with mobile lifecycle and
  connectivity wiring.
- **Listener Integration Contracts**: AppState and NetInfo adapters that bridge React Native signals
  to `CoreStateful` runtime behavior.
- **Package Export Surface**: Root and subpath module contracts consumed by app code.
- **Runtime Polyfill Contract**: React Native import-time setup for iterator helpers and
  `crypto.randomUUID`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Singleton lifecycle tests confirm one active instance, duplicate-create failure, and
  successful recreation after `destroy()`.
- **SC-002**: AppState and NetInfo tests confirm `flush()` and `online` updates, callback
  fault-tolerance, and safe cleanup behavior.
- **SC-003**: Import-surface tests confirm current root named exports, subpath exports, and no root
  default-export dependency.
- **SC-004**: Constant/polyfill tests confirm metadata fallback values and runtime `randomUUID`
  availability.
