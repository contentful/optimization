# Feature Specification: Contentful Optimization Web Foundational and Shared Contracts

**Feature Branch**: `[014-web-foundational-and-shared]`  
**Created**: 2026-02-27  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bootstrap a Browser-Wired ContentfulOptimization Runtime with Web Defaults (Priority: P1)

As a Web SDK integrator, I need one browser-oriented `ContentfulOptimization` runtime that merges
Web defaults with stateful core behavior so analytics and personalization are ready with minimal
setup.

**Why this priority**: Runtime bootstrap is the entry path for all Web SDK capabilities.

**Independent Test**: Construct `ContentfulOptimization` with minimal config and assert merged
defaults, stateful core construction, singleton guard behavior, and default allow-list behavior.

**Acceptance Scenarios**:

1. **Given** a config with `clientId`, **When** `ContentfulOptimization` is constructed, **Then**
   core receives merged Web defaults for analytics beacon handling, event-builder channel/library
   metadata, event-builder browser helpers, and anonymous ID lookup.
2. **Given** a browser runtime where `window.contentfulOptimization` already exists, **When** a new
   instance is created, **Then** construction fails with an "already initialized" error.
3. **Given** a browser runtime with no existing instance, **When** an instance is created, **Then**
   it is attached to `window.contentfulOptimization`.
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
   `online` is set through the online listener callback.
2. **Given** an initialized instance, **When** the page transitions to hidden/pagehide, **Then**
   `flush()` is invoked through the visibility listener callback.
3. **Given** a destroyed instance, **When** runtime listeners or entry-interaction trackers would
   normally execute, **Then** prior bindings and tracker resources are cleaned up and no longer
   active.
4. **Given** a destroyed instance, **When** a new `ContentfulOptimization` instance is created,
   **Then** initialization succeeds.

---

### User Story 3 - Consume a Stable Web Package Surface (Priority: P2)

As a package consumer, I need consistent entrypoints and constants so direct SDK usage and derived
integrations can rely on a stable public surface.

**Why this priority**: Packaging and exports determine interoperability for downstream users.

**Independent Test**: Import from package root and subpaths, and verify runtime/type entrypoints
plus constant fallbacks when build-time defines are absent.

**Acceptance Scenarios**:

1. **Given** package root imports, **When** importing `@contentful/optimization-web`, **Then** the
   default `ContentfulOptimization` export, event-builder helpers, selected constants, and beacon
   helper are available.
2. **Given** core and schema/client imports, **When** importing
   `@contentful/optimization-web/core-sdk`, `@contentful/optimization-web/api-client`, and
   `@contentful/optimization-web/api-schemas`, **Then** those contracts resolve from dedicated
   subpath exports.
3. **Given** missing build-time replacements, **When** constants are resolved, **Then** package name
   and version fall back to hardcoded defaults.
4. **Given** published artifacts, **When** consumers resolve package entry points, **Then** ESM/CJS
   runtime outputs, UMD bundles, and dual declaration outputs are available.

---

### Edge Cases

- Listener helpers degrade to no-op cleanup functions in non-DOM/SSR environments.
- Online listener emits an initial state and falls back to `true` when `navigator.onLine` is not a
  boolean.
- Visibility callbacks are best-effort: callback exceptions are logged and do not crash runtime.
- Online callbacks are best-effort: callback exceptions are logged and do not crash runtime.
- Visibility handling invokes hide callback at most once per hide cycle until reset by
  visible/pageshow.
- `destroy()` removes `window.contentfulOptimization` only when the global points to the current
  instance.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `OptimizationWebConfig` MUST extend `CoreStatefulConfig` with optional `app`, optional
  `autoTrackEntryInteraction`, and optional cookie attributes (`domain`, `expires`).
- **FR-002**: `ContentfulOptimization` construction MUST reject initialization when
  `window.contentfulOptimization` already exists in browser environments.
- **FR-003**: Web config merging MUST provide default analytics `beaconHandler`.
- **FR-004**: Web config merging MUST provide default event-builder values: `channel: 'web'`,
  `library.name`, `library.version`, `getLocale`, `getPageProperties`, and `getUserAgent`.
- **FR-005**: Web config merging MUST provide default state values from `LocalStore` for `consent`,
  `changes`, `profile`, and `selectedPersonalizations` (mapped via `defaults.personalizations`) when
  not explicitly supplied.
- **FR-006**: Web config merging MUST provide default `getAnonymousId` that reads from
  `LocalStore.anonymousId`.
- **FR-007**: Web config merging MUST set runtime log level to `'debug'` when `LocalStore.debug` is
  true; otherwise it MUST pass through the caller-provided `logLevel`.
- **FR-008**: `ContentfulOptimization` MUST extend `CoreStateful` and initialize parent state with
  merged config.
- **FR-009**: `ContentfulOptimization` construction MUST initialize `EntryInteractionRuntime` using
  the `autoTrackEntryInteraction` config and expose its `tracking` API on the instance.
- **FR-010**: `ContentfulOptimization` MUST register an online/offline listener that maps browser
  state to `online = isOnline`.
- **FR-011**: `ContentfulOptimization` MUST register a visibility listener that flushes queued
  events on hide/pagehide.
- **FR-012**: `ContentfulOptimization` construction MUST assign `window.contentfulOptimization` to
  the created instance when absent in browser environments.
- **FR-013**: `ContentfulOptimization.destroy()` MUST destroy entry-interaction runtime resources
  and execute cleanup handlers for online and visibility listeners.
- **FR-014**: `ContentfulOptimization.destroy()` MUST remove the global singleton reference only
  when `window.contentfulOptimization === this`.
- **FR-015**: Package root default export MUST be `ContentfulOptimization`.
- **FR-016**: Package root named exports MUST include Web event-builder helpers, exported Web
  constants (`CAN_ADD_LISTENERS`, `ENTRY_SELECTOR`, `HAS_MUTATION_OBSERVER`,
  `OPTIMIZATION_WEB_SDK_NAME`, `OPTIMIZATION_WEB_SDK_VERSION`), beacon handler helpers, and named
  exports from `ContentfulOptimization.ts` (for example `OptimizationWebConfig` and
  `OptimizationTrackingApi`).
- **FR-017**: Core and transitive API exports MUST be available from subpath entrypoints:
  `@contentful/optimization-web/core-sdk`, `@contentful/optimization-web/api-client`, and
  `@contentful/optimization-web/api-schemas`.
- **FR-018**: `OPTIMIZATION_WEB_SDK_NAME` MUST default to `'@contentful/optimization-web'` when
  build-time package-name replacement is unavailable.
- **FR-019**: `OPTIMIZATION_WEB_SDK_VERSION` MUST default to `'0.0.0'` when build-time version
  replacement is unavailable.
- **FR-020**: Web config merging MUST default `allowedEventTypes` to `['identify', 'page']` when
  caller configuration omits it.
- **FR-021**: Caller-provided `allowedEventTypes` MUST override the Web default allow-list.
- **FR-022**: Package build outputs MUST include ESM, CJS, UMD, and dual declaration artifacts for
  exported entrypoints.

### Key Entities _(include if feature involves data)_

- **ContentfulOptimization**: Browser-wired SDK class extending stateful core behavior.
- **OptimizationWebConfig**: Web runtime configuration contract with core plus Web-specific options.
- **Entry Interaction Runtime**: Shared runtime that manages automatic entry interaction tracking
  resources and public tracking controls.
- **Lifecycle Listeners**: Online/offline and visibility/pagehide hooks that drive runtime behavior.
- **Package Surface**: Root and subpath exports consumed by downstream SDK integrations.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Initialization tests confirm merged Web defaults and allowed-event-type behavior are
  applied in constructed runtime state.
- **SC-002**: Runtime tests confirm interaction tracking API wiring and post-destroy
  re-initialization behavior.
- **SC-003**: Listener tests confirm online/visibility transitions invoke handler callbacks and
  cleanup removes bound listeners.
- **SC-004**: Export/build checks confirm package root and subpath entrypoints resolve expected
  runtime/type artifacts.
- **SC-005**: Constant resolution checks confirm fallback package metadata is available when
  build-time replacement values are absent.
