# Feature Specification: Optimization React Native Foundational and Shared Contracts

**Feature Branch**: `[019-react-native-foundational-and-shared]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in
`@contentful/optimization-react-native` package and derive SpecKit-compatible specifications that
could have guided its development."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bootstrap a Single Mobile Runtime Instance (Priority: P1)

As a React Native integrator, I need one canonical SDK instance per JS runtime so configuration,
signals, and listeners are initialized once and reused safely.

**Why this priority**: SDK bootstrap is the entry point for all personalization and analytics
behavior.

**Independent Test**: Call `Optimization.create(...)` twice in one runtime and verify first creation
succeeds while second creation fails until the first instance is destroyed.

**Acceptance Scenarios**:

1. **Given** no active SDK instance, **When** `Optimization.create(config)` is called, **Then** a
   new initialized `Optimization` instance is returned.
2. **Given** an active SDK instance, **When** `Optimization.create(config)` is called again,
   **Then** creation fails with an "already initialized" error.
3. **Given** a destroyed active instance, **When** `Optimization.create(config)` is called, **Then**
   a replacement instance can be created.

---

### User Story 2 - Wire Mobile Lifecycle and Connectivity Signals (Priority: P1)

As a maintainer, I need app-state and network listeners wired to SDK lifecycle APIs so queueing and
flushing behavior remain resilient as connectivity and app focus change.

**Why this priority**: Event reliability depends on online/offline transitions and background
flushes.

**Independent Test**: Simulate AppState and NetInfo transitions and verify updates to `online` via
setter assignment, `flush()`, callback error handling, and cleanup behavior.

**Acceptance Scenarios**:

1. **Given** the app transitions to `background` or `inactive`, **When** the AppState listener
   fires, **Then** SDK `flush()` is invoked.
2. **Given** NetInfo emits connectivity state changes, **When** the listener receives updates,
   **Then** SDK `online` is set with `online = isOnline` using internet reachability fallback logic.
3. **Given** listener callbacks throw or reject, **When** listeners run, **Then** errors are logged
   and runtime execution continues.

---

### User Story 3 - Consume a Stable Package Surface and Runtime Setup (Priority: P2)

As a package consumer, I need a stable export surface, build artifacts, constants, and runtime
polyfills so the SDK can be imported consistently across React Native toolchains.

**Why this priority**: Compatibility and developer adoption depend on predictable packaging.

**Independent Test**: Import package root in ESM/CJS and verify exported APIs, fallback constants,
and runtime polyfill side effects.

**Acceptance Scenarios**:

1. **Given** package root imports, **When** consumers import
   `@contentful/optimization-react-native`, **Then** core exports plus React Native-specific
   classes/components/hooks are available.
2. **Given** build-time constant replacement is unavailable, **When** SDK name/version constants are
   read, **Then** fallback values are returned.
3. **Given** environments without `crypto.randomUUID`, **When** package entry executes, **Then** the
   polyfill provides a `randomUUID` implementation.

---

### Edge Cases

- NetInfo module loading can fail (missing dependency or invalid shape); listener setup must degrade
  to warning + no-op cleanup.
- Cleanup can be called before asynchronous NetInfo import resolves; late subscription must be
  prevented.
- AppState and NetInfo callback exceptions must never crash the runtime.
- `destroy()` must clear singleton ownership only when called on the active instance.
- Global `crypto` polyfill setup must be idempotent across repeated imports.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `Optimization.create(config)` MUST enforce a single active SDK instance per JS
  runtime.
- **FR-002**: `Optimization.create(config)` MUST throw when an active instance already exists.
- **FR-003**: `Optimization.create(config)` MUST asynchronously resolve merged configuration before
  constructing the runtime.
- **FR-004**: `Optimization` MUST extend `CoreStateful`.
- **FR-005**: Construction MUST register an online/offline listener that maps connectivity state to
  `online = isOnline`.
- **FR-006**: Construction MUST register an AppState listener that invokes `flush()` on `background`
  and `inactive` transitions.
- **FR-007**: `createOnlineChangeListener` MUST dynamically import `@react-native-community/netinfo`
  and validate module shape before subscription.
- **FR-008**: `createOnlineChangeListener` MUST determine connectivity using
  `isInternetReachable ?? isConnected ?? true`.
- **FR-009**: If NetInfo cannot be loaded or validated, `createOnlineChangeListener` MUST log a
  warning and return a safe cleanup function.
- **FR-010**: Online listener callback failures (sync or async) MUST be logged and swallowed.
- **FR-011**: AppState listener callback failures (sync or async) MUST be logged and swallowed.
- **FR-012**: `Optimization.destroy()` MUST invoke cleanup handlers for both online and AppState
  listeners.
- **FR-013**: `Optimization.destroy()` MUST clear singleton tracking only when
  `activeOptimizationInstance === this`.
- **FR-014**: `Optimization.destroy()` MUST delegate to `CoreStateful.destroy()`.
- **FR-015**: Package root exports MUST include all `@contentful/optimization-core` exports plus
  React Native APIs (`OptimizationProvider`, `OptimizationRoot`, `Personalization`, `Analytics`,
  `OptimizationScrollProvider`, context hooks, tracking hooks, navigation container, and preview
  exports).
- **FR-016**: Package default export MUST be the `Optimization` class.
- **FR-017**: `OPTIMIZATION_REACT_NATIVE_SDK_NAME` MUST resolve from build-time replacement when
  available, otherwise `'@contentful/optimization-react-native'`.
- **FR-018**: `OPTIMIZATION_REACT_NATIVE_SDK_VERSION` MUST resolve from build-time replacement when
  available, otherwise `'0.0.0'`.
- **FR-019**: Package entry MUST load runtime setup modules for image typing declarations and crypto
  polyfills.
- **FR-020**: Crypto polyfill MUST ensure `global.crypto` exists and provide `crypto.randomUUID`
  when missing.
- **FR-021**: Package build outputs MUST expose ESM (`index.mjs`), CJS (`index.cjs`), and dual
  declaration artifacts (`index.d.mts`, `index.d.cts`).
- **FR-022**: Build configuration MUST treat React/React Native runtime dependencies as externals.

### Key Entities _(include if feature involves data)_

- **Optimization (React Native)**: Stateful SDK runtime with mobile lifecycle wiring.
- **Lifecycle Listener Contracts**: Online and AppState handlers that bridge device state to SDK
  behavior.
- **Package Surface**: Public exports, constants, and bundle artifacts consumed by integrators.
- **Runtime Polyfills**: Import-time compatibility setup for iterator helpers and
  `crypto.randomUUID`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Runtime initialization tests confirm singleton enforcement and re-creation after
  destruction.
- **SC-002**: Listener tests confirm online/AppState transitions invoke SDK handlers and cleanup
  prevents later callbacks.
- **SC-003**: Fault-injection tests confirm NetInfo absence and callback failures do not crash SDK
  execution.
- **SC-004**: Import/build checks confirm root exports, default export, constants fallback behavior,
  and runtime/type artifacts are present.
