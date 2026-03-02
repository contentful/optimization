# Feature Specification: Optimization Web Foundational and Shared Contracts

**Feature Branch**: `[014-web-foundational-and-shared]`  
**Created**: 2026-02-27  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bootstrap a Browser-Wired Runtime with Web Defaults (Priority: P1)

As a Web SDK integrator, I need one browser-oriented Optimization runtime that merges Web defaults
with core stateful behavior so analytics and personalization are ready with minimal setup.

**Why this priority**: Runtime bootstrap is the entry path for all Web SDK capabilities.

**Independent Test**: Construct `Optimization` with minimal config and assert merged defaults,
stateful core construction, and singleton guard behavior.

**Acceptance Scenarios**:

1. **Given** a config with `clientId`, **When** `Optimization` is constructed, **Then** core
   receives merged Web defaults for analytics beacon handler, event builder metadata, and anonymous
   ID getter.
2. **Given** a browser runtime where `window.optimization` already exists, **When** a new instance
   is created, **Then** construction fails with an "already initialized" error.
3. **Given** a browser runtime with no existing instance, **When** an instance is created, **Then**
   it is attached to `window.optimization`.
4. **Given** no `allowedEventTypes` override, **When** Web config is merged, **Then**
   `allowedEventTypes` defaults to `['identify', 'page']`; and **Given** caller-provided
   `allowedEventTypes`, **Then** caller values override that Web default.

---

### User Story 2 - Wire Lifecycle and Tracking Runtime Teardown Safely (Priority: P1)

As a maintainer, I need online/offline and page-visibility listeners plus tracked-entry interaction
runtime teardown so delivery behavior remains resilient and cleanup is deterministic.

**Why this priority**: Lifecycle wiring and teardown directly affect runtime safety and reliability.

**Independent Test**: Trigger online/offline and hidden/pagehide transitions, verify updates to
`online` and `flush()`, and verify `destroy()` releases listener and entry-interaction resources.

**Acceptance Scenarios**:

1. **Given** an initialized Web SDK instance, **When** browser online state changes, **Then**
   `online` is set to `true|false` through the online listener callback.
2. **Given** an initialized instance, **When** the page transitions to hidden/pagehide, **Then**
   `flush()` is invoked via visibility listener callback.
3. **Given** a destroyed instance, **When** runtime listeners or entry-interaction trackers would
   normally execute, **Then** prior bindings and tracker resources are cleaned up and no longer
   active.

---

### User Story 3 - Consume a Stable Web Package Surface (Priority: P2)

As a package consumer, I need consistent exports and constants so direct SDK usage and derived
integrations can rely on a stable public surface.

**Why this priority**: Packaging and exports determine interoperability for all downstream users.

**Independent Test**: Import from package root and verify core re-exports, Web utilities, default
export, and fallback constant behavior when build-time defines are absent.

**Acceptance Scenarios**:

1. **Given** package root imports, **When** importing `@contentful/optimization-web`, **Then** core
   exports plus Web utilities for event builder helpers, global constants, beacon handler, and
   `LocalStore` are available.
2. **Given** missing build-time replacements, **When** constants are resolved, **Then** package name
   and version fall back to hardcoded defaults.
3. **Given** published artifacts, **When** consumers resolve package entry points, **Then** ESM/CJS
   runtime outputs, UMD bundle, and dual declaration outputs are available.

---

### Edge Cases

- Listener helpers must degrade to no-op cleanup functions in non-DOM/SSR environments.
- Visibility callbacks must be best-effort: callback exceptions are logged and do not crash runtime.
- Online callbacks must be best-effort: callback exceptions are logged and do not crash runtime.
- Visibility handling must invoke hide callback at most once per hide cycle until reset by
  visible/pageshow.
- `destroy()` must remove `window.optimization` only when the global points to the current instance.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `OptimizationWebConfig` MUST extend `CoreStatefulConfig` with optional `app`, optional
  `autoTrackEntryInteraction`, and optional cookie attributes (`domain`, `expires`).
- **FR-002**: `Optimization` construction MUST reject initialization when `window.optimization`
  already exists in browser environments.
- **FR-003**: Web config merging MUST provide default analytics `beaconHandler`.
- **FR-004**: Web config merging MUST provide default event-builder values: `channel: 'web'`,
  `library.name`, `library.version`, `getLocale`, `getPageProperties`, and `getUserAgent`.
- **FR-005**: Web config merging MUST provide default state values from `LocalStore` for `consent`,
  `changes`, `profile`, and `personalizations` when not explicitly supplied.
- **FR-006**: Web config merging MUST provide default `getAnonymousId` that reads from
  `LocalStore.anonymousId`.
- **FR-007**: Web config merging MUST default runtime log level to `'debug'` when `LocalStore.debug`
  is true; otherwise it MUST preserve provided `logLevel`.
- **FR-008**: `Optimization` MUST extend `CoreStateful` and initialize parent state with merged
  config.
- **FR-009**: `Optimization` construction MUST initialize `EntryInteractionRuntime` using the
  `autoTrackEntryInteraction` config and expose its `tracking` API on the instance.
- **FR-010**: `Optimization` MUST register an online/offline listener that maps browser state to
  `online = isOnline`.
- **FR-011**: `Optimization` MUST register a visibility listener that flushes queued events on
  hide/pagehide.
- **FR-012**: `Optimization` construction MUST assign `window.optimization` to the created instance
  when absent in browser environments.
- **FR-013**: `Optimization.destroy()` MUST destroy entry interaction runtime resources and execute
  cleanup handlers for online and visibility listeners.
- **FR-014**: `Optimization.destroy()` MUST remove the global singleton reference only when
  `window.optimization === this`.
- **FR-015**: Package root exports MUST include all `@contentful/optimization-core` exports plus
  Web-specific exports for event builder helpers, global constants, beacon handler, and
  `LocalStore`.
- **FR-016**: Default export of package root MUST be `Optimization`.
- **FR-017**: `OPTIMIZATION_WEB_SDK_NAME` MUST default to `'@contentful/optimization-web'` when
  build-time package-name replacement is unavailable.
- **FR-018**: `OPTIMIZATION_WEB_SDK_VERSION` MUST default to `'0.0.0'` when build-time version
  replacement is unavailable.
- **FR-019**: Package build outputs MUST include ESM, CJS, UMD, and dual declaration artifacts.
- **FR-020**: Web config merging MUST default `allowedEventTypes` to `['identify', 'page']` when
  caller configuration omits it.
- **FR-021**: Caller-provided `allowedEventTypes` MUST override the Web default allow-list.

### Key Entities _(include if feature involves data)_

- **Optimization**: Browser-wired SDK class extending stateful core behavior.
- **OptimizationWebConfig**: Web runtime configuration contract with core plus Web-specific options.
- **Entry Interaction Runtime**: Shared runtime that manages automatic entry interaction tracking
  resources and public tracking controls.
- **Lifecycle Listeners**: Online/offline and visibility/pagehide hooks that drive runtime behavior.
- **Package Surface**: Root exports and constants consumed by downstream SDK integrations.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Initialization tests confirm merged Web defaults are passed into the stateful core.
- **SC-002**: Singleton tests confirm duplicate browser initialization fails until prior instance is
  destroyed.
- **SC-003**: Lifecycle tests confirm online/visibility transitions invoke SDK handlers and teardown
  removes listeners and entry interaction runtime resources.
- **SC-004**: Import/build checks confirm package root exports and runtime/type artifacts are
  present.
- **SC-005**: Merge-config tests confirm Web defaults `allowedEventTypes` to `['identify', 'page']`
  and preserves caller-provided `allowedEventTypes`.
