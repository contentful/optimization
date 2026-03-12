# Feature Specification: Optimization Core Foundational and Shared Contracts

**Feature Branch**: `[009-core-foundational-and-shared]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bootstrap Shared Core Infrastructure (Priority: P1)

As an SDK integrator, I need one shared core wiring layer that composes API access, event
construction, lifecycle interceptors, and logger sink setup so both stateless and stateful products
start from the same runtime contract.

**Why this priority**: This composition boundary underpins all higher-level SDK behavior.

**Independent Test**: Instantiate a `CoreBase` descendant and assert API config forwarding,
EventBuilder defaults, and interceptor availability.

**Acceptance Scenarios**:

1. **Given** `CoreConfig` with `clientId` and optional global/scoped API options, **When** a core
   runtime is created, **Then** one `ApiClient` is constructed with forwarded global
   (`clientId`/`environment`/`fetchOptions`) and isolated scoped (`analytics`/`personalization`)
   config.
2. **Given** omitted `eventBuilder` config, **When** core initializes, **Then** `EventBuilder`
   defaults to `channel: 'server'` and library metadata from
   `OPTIMIZATION_CORE_SDK_NAME`/`OPTIMIZATION_CORE_SDK_VERSION`.
3. **Given** any core config, **When** runtime initializes, **Then** lifecycle interceptors expose
   separate `event` and `state` managers.
4. **Given** optional `logLevel`, **When** runtime initializes, **Then** a `ConsoleLogSink` is
   registered for the shared logger with that minimum level.

---

### User Story 2 - Use the Unified Core Facade (Priority: P1)

As a product SDK developer, I need one facade with resolver helpers and event methods so callers can
use personalization and analytics behavior without reaching into product internals.

**Why this priority**: The core facade is the main integration surface used by downstream SDKs.

**Independent Test**: Invoke resolver and event methods on a core instance and validate delegation
and return behavior.

**Acceptance Scenarios**:

1. **Given** resolver input data, **When** `getFlag`, `personalizeEntry`, and `getMergeTagValue` are
   called, **Then** each method delegates to personalization resolvers without changing result
   shape.
2. **Given** identify/page/screen/track payloads, **When** `identify`, `page`, `screen`, and `track`
   are called, **Then** each delegates to personalization and returns its async result.
3. **Given** `trackView` payload with `sticky: true`, **When** the method is called, **Then** it
   delegates to personalization and analytics, and returns the personalization result.
4. **Given** `trackView` payload with `sticky` omitted or `false`, **When** the method is called,
   **Then** it delegates to analytics and resolves with `undefined`.
5. **Given** analytics interaction payloads, **When** `trackClick`, `trackHover`, or `trackFlagView`
   is called, **Then** each method delegates to analytics.

---

### User Story 3 - Extend Behavior Safely and Consume Public Surfaces (Priority: P2)

As a maintainer, I need shared interception/guard primitives and predictable package interfaces so I
can extend behavior safely and expose the correct import surfaces.

**Why this priority**: Extensibility and package-surface correctness drive downstream SDK stability.

**Independent Test**: Register interceptors and guard hooks, emit blocked events, and verify root
and subpath exports.

**Acceptance Scenarios**:

1. **Given** registered interceptors, **When** `InterceptorManager.run` executes, **Then** it uses
   invocation-time interceptor snapshots, executes in insertion order, and deep-clones accumulator
   input before each interceptor call.
2. **Given** blocked event reporting with a throwing `onEventBlocked` callback, **When**
   `reportBlockedEvent` runs, **Then** callback errors are swallowed and the shared `blockedEvent`
   signal is still updated.
3. **Given** a method wrapped with `guardedBy`, **When** predicate blocks execution, **Then**
   optional `onBlocked` runs synchronously and blocked calls return `undefined` for sync methods or
   `Promise<undefined>` for async methods.
4. **Given** package consumption, **When** importing from `@contentful/optimization-core`, **Then**
   root exports include core runtime modules, analytics/personalization modules, decorator and
   interceptor utilities, signals helpers, constants, and symbols; logger/API client/API schema
   surfaces are consumed through dedicated subpaths.

---

### Edge Cases

- Analytics and personalization API base URLs remain isolated when only one scoped override is set.
- Top-level `fetchOptions` are forwarded to shared API client config.
- `CoreBase.trackView` always sends analytics view events; when `sticky` is truthy, it also sends
  personalization view events.
- `InterceptorManager.run` returns the original input reference when no interceptors are registered.
- `guardedBy` throws `TypeError` at call time when the configured predicate key is not callable.
- Core root export surface has no package default export and does not expose logger/API client/API
  schema modules at root.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `CoreConfig` MUST support global API properties (`clientId`, `environment`,
  `fetchOptions`), optional scoped `analytics` and `personalization` API config, optional
  `eventBuilder`, and optional `logLevel`.
- **FR-002**: `CoreBase` MUST create one shared `ApiClient` with global API properties and scoped
  analytics/personalization config objects.
- **FR-003**: `CoreBase` MUST register a `ConsoleLogSink` using the configured `logLevel`.
- **FR-004**: `CoreBase` MUST initialize `EventBuilder` from provided config or default to
  `channel: 'server'` and core package library metadata constants.
- **FR-005**: `CoreBase` MUST expose lifecycle interceptors with separate managers for `event` and
  `state`.
- **FR-006**: `CoreBase` MUST expose resolver accessors (`flagsResolver`, `mergeTagValueResolver`,
  `personalizedEntryResolver`) delegated from personalization.
- **FR-007**: `CoreBase` resolver helpers (`getFlag`, `personalizeEntry`, `getMergeTagValue`) MUST
  delegate to personalization methods without reshaping outputs.
- **FR-008**: `CoreBase.identify`, `page`, `screen`, and `track` MUST delegate to personalization
  and return delegated async results.
- **FR-009**: `CoreBase.trackView` MUST delegate to analytics for all payloads and MUST additionally
  delegate to personalization when `payload.sticky` is truthy; it MUST return personalization data
  for sticky payloads and `undefined` otherwise.
- **FR-010**: `CoreBase.trackClick`, `trackHover`, and `trackFlagView` MUST delegate to analytics.
- **FR-011**: `ProductBase` MUST default `allowedEventTypes` to `['identify', 'page', 'screen']`
  when unspecified.
- **FR-012**: `ProductBase.reportBlockedEvent` MUST invoke optional `onEventBlocked`, swallow
  callback failures, and publish the blocked payload to the shared blocked-event signal.
- **FR-013**: `InterceptorManager` MUST support add/remove/clear/count and sequential sync+async
  execution through `run`.
- **FR-014**: `InterceptorManager.run` MUST use an invocation-time snapshot of registered
  interceptors and deep-clone the current accumulator before each interceptor invocation.
- **FR-015**: `guardedBy` MUST use a synchronous predicate, support optional synchronous `onBlocked`
  callback or instance-method key hooks, and preserve sync/async return shape when blocked.
- **FR-016**: Root exports from `@contentful/optimization-core` MUST include signals utilities,
  analytics/personalization modules, decorator/interceptor utilities, constants, symbols,
  `CoreStateful`, and `CoreStateless`.
- **FR-017**: Logger/API client/API schema contracts MUST be consumed via dedicated subpath
  entrypoints (`@contentful/optimization-core/logger`, `/api-client`, `/api-schemas`) rather than
  root exports.
- **FR-018**: `OPTIMIZATION_CORE_SDK_NAME` and `OPTIMIZATION_CORE_SDK_VERSION` MUST use build-time
  define values when they are strings, otherwise fallback to `'@contentful/optimization-core'` and
  `'0.0.0'` respectively.
- **FR-019**: Package build output MUST include ESM/CJS runtime artifacts plus dual declaration
  artifacts for configured entrypoints.

### Key Entities _(include if feature involves data)_

- **CoreBase**: Internal shared runtime composition layer for API, builder, logging, interceptors,
  and facade delegation.
- **ProductBase**: Shared product primitive for allowed-event configuration and blocked-event
  reporting.
- **Lifecycle Interceptors**: `event` and `state` interceptor managers used to transform outgoing
  events and optimization state.
- **BlockedEvent**: Diagnostics payload (`reason`, `product`, `method`, `args`) emitted when guarded
  calls are blocked.
- **Core Package Surfaces**: Root module plus dedicated logger/API client/API schema subpath
  entrypoints.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Core initialization behavior validates API config forwarding, builder defaults, and
  interceptor availability.
- **SC-002**: Facade method tests validate resolver delegation and event-routing behavior, including
  sticky `trackView` handling.
- **SC-003**: Guard/interceptor tests validate snapshot execution semantics, deep-clone isolation,
  and blocked-call return behavior.
- **SC-004**: Package interface verification confirms root exports and dedicated subpath entrypoints
  match runtime distribution artifacts.
