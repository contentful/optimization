# Feature Specification: Optimization Core Foundational and Shared Contracts

**Feature Branch**: `[009-core-foundational-and-shared]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-05).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bootstrap a Shared Core Runtime (Priority: P1)

As an SDK integrator, I need one core base runtime that consistently wires API client, event
builder, logging, and lifecycle interceptors so product implementations start from identical shared
infrastructure.

**Why this priority**: Every stateful and stateless product depends on this composition boundary.

**Independent Test**: Instantiate a `CoreBase` descendent and verify shared API config forwarding,
event-builder defaults, and interceptor availability.

**Acceptance Scenarios**:

1. **Given** a core config with `clientId` and optional scoped API config, **When** a core instance
   is created, **Then** one `ApiClient` is created with shared/global properties plus isolated
   `analytics` and `personalization` overrides.
2. **Given** no explicit `eventBuilder` config, **When** the core is created, **Then** event builder
   defaults use `channel: 'server'` and library metadata derived from core package constants.
3. **Given** a created core instance, **When** lifecycle hooks are accessed, **Then** separate
   `event` and `state` interceptor managers are available.

---

### User Story 2 - Use a Unified Core Facade (Priority: P1)

As a product SDK developer, I need one top-level facade for personalization resolution and event
emission methods so consumers can call core methods without reaching into product internals.

**Why this priority**: The top-level core facade is the primary public integration surface.

**Independent Test**: Call core facade methods and assert delegation to the expected product methods
and return behavior.

**Acceptance Scenarios**:

1. **Given** a core instance, **When** `identify/page/screen/track` are called, **Then** each method
   delegates to personalization and returns the delegated result.
2. **Given** `trackView` payload with `sticky: true`, **When** the method is called, **Then** the
   call delegates to personalization component tracking.
3. **Given** `trackView` payload with `sticky` omitted/false, **When** the method is called,
   **Then** the call delegates to analytics component tracking.
4. **Given** `trackFlagView` payload, **When** the method is called, **Then** it delegates to
   analytics flag tracking.

---

### User Story 3 - Extend Runtime Behavior Safely (Priority: P2)

As a maintainer extending core behavior, I need shared guard/interceptor/blocked-event primitives so
I can add behavior safely without forking base flow logic.

**Why this priority**: Extensibility points are required by downstream platform SDKs and preview
tooling.

**Independent Test**: Register interceptors, run guarded methods, and verify blocked-event callback
and signal behavior under both success and failure callbacks.

**Acceptance Scenarios**:

1. **Given** registered interceptors, **When** `run` is invoked, **Then** interceptors execute in
   insertion order, each interceptor receives a deep-cloned payload snapshot, and a transformed
   value is returned.
2. **Given** a blocked call and a throwing `onEventBlocked` callback, **When** blocked event
   reporting runs, **Then** callback errors are swallowed and blocked event signal still updates.
3. **Given** package root imports, **When** consumers import from `@contentful/optimization-core`,
   **Then** core classes, product modules, interceptors/decorators, API client contracts, and logger
   exports are available.

---

### Edge Cases

- Analytics and personalization API base URLs must remain isolated when only one side is overridden.
- Shared fetch options must flow to API client config without being dropped.
- `trackView` routing is sticky-aware and does not automatically dual-send on sticky calls.
- `InterceptorManager.run` must snapshot registered interceptors so in-flight add/remove does not
  alter current execution order.
- `InterceptorManager.run` must deep-clone values before each interceptor invocation so caller-held
  input references and prior-step references are mutation-isolated.
- `guardedBy` must preserve async method shape by returning `Promise<undefined>` for blocked async
  calls.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `CoreBase` MUST accept `clientId`, optional `environment`, optional `fetchOptions`,
  optional scoped `analytics`, optional scoped `personalization`, optional `eventBuilder`, and
  optional `logLevel`.
- **FR-002**: `CoreBase` MUST create a shared `ApiClient` using top-level global API properties plus
  scoped `analytics`/`personalization` config objects.
- **FR-003**: `CoreBase` MUST initialize an `EventBuilder` from supplied config or default to
  `channel: 'server'` and library metadata from core constants.
- **FR-004**: `CoreBase` MUST expose lifecycle interceptors with separate managers for `event` and
  `state`.
- **FR-005**: `CoreBase.getCustomFlag` MUST delegate to personalization flag resolution.
- **FR-006**: `CoreBase.personalizeEntry` MUST delegate to personalization entry resolution.
- **FR-007**: `CoreBase.getMergeTagValue` MUST delegate to personalization merge-tag resolution.
- **FR-008**: `CoreBase.identify`, `page`, `screen`, and `track` MUST delegate to personalization
  methods and return delegated results.
- **FR-009**: `CoreBase.trackView` MUST delegate to personalization when `payload.sticky` is truthy;
  otherwise it MUST delegate to analytics.
- **FR-010**: `CoreBase.trackFlagView` MUST delegate to analytics flag tracking.
- **FR-011**: `ProductBase` MUST default `allowedEventTypes` to `['identify', 'page', 'screen']`
  when unspecified.
- **FR-012**: `ProductBase.reportBlockedEvent` MUST publish blocked event payloads to both optional
  callback and shared blocked-event signal.
- **FR-013**: `ProductBase.reportBlockedEvent` MUST swallow callback exceptions and continue blocked
  event publication.
- **FR-014**: `InterceptorManager` MUST support add/remove/clear/count and sequential sync+async
  execution via `run`.
- **FR-015**: `InterceptorManager.run` MUST execute a snapshot of registered interceptors captured
  at invocation time.
- **FR-016**: `guardedBy` MUST enforce a synchronous predicate and optionally execute a synchronous
  `onBlocked` hook when calls are blocked.
- **FR-017**: Package root exports MUST include core classes, analytics/personalization modules,
  decorators, interceptors, signals utilities, API client/schema contracts, and logger exports.
- **FR-018**: Package build output MUST include ESM (`.mjs`), CJS (`.cjs`), and dual declaration
  artifacts (`.d.mts`/`.d.cts`).
- **FR-019**: `InterceptorManager.run` MUST deep-clone the current accumulator value before each
  interceptor invocation to isolate caller-owned references and interceptor-step mutations.

### Key Entities _(include if feature involves data)_

- **CoreBase**: Shared runtime composition boundary for API, builder, logging, and facade methods.
- **ProductBase**: Shared product primitive for allowed-event configuration and blocked-event
  reporting.
- **Lifecycle Interceptors**: `event` and `state` interceptor managers that mutate data in-flight.
- **BlockedEvent**: Diagnostics payload with `reason`, `product`, `method`, and original arguments.
- **Shared Package Surface**: Root export contract consumed by downstream platform SDKs.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Core initialization tests confirm config preservation, default builder metadata, and
  isolated scoped API client settings.
- **SC-002**: Facade delegation tests confirm sticky component routing and analytics/personalization
  method dispatch behavior.
- **SC-003**: Interceptor and guard tests confirm deterministic execution ordering, snapshot
  semantics, deep-clone mutation isolation, and blocked-call return behavior.
- **SC-004**: Build artifacts provide dual runtime module formats and dual declaration formats.
