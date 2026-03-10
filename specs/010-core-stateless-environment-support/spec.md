# Feature Specification: Optimization Core Stateless Environment Support

**Feature Branch**: `[010-core-stateless-environment-support]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initialize Core for Stateless Runtimes (Priority: P1)

As a server-side SDK author, I need a stateless core that wires stateless analytics and
personalization products with shared API and event-builder dependencies so I can run in Node/SSR
without local runtime state.

**Why this priority**: Stateless composition is the base requirement for server and function
environments.

**Independent Test**: Create `CoreStateless` and verify product construction, config typing
constraints, and absence of stateful-only behavior.

**Acceptance Scenarios**:

1. **Given** a `CoreStateless` config with `clientId`, **When** the instance is created, **Then**
   stateless analytics and personalization products are constructed with shared
   API/builder/interceptors.
2. **Given** stateless event builder overrides, **When** config is typed, **Then** stateful-only
   getter options are not part of stateless event-builder config.
3. **Given** stateless analytics config, **When** config is typed, **Then** `beaconHandler` is not
   part of stateless analytics config.

---

### User Story 2 - Send Personalization Events Immediately (Priority: P1)

As an integrator in a stateless host, I need personalization events to be built, validated,
intercepted, and sent immediately via Experience API upsert so no internal queue/state coordination
is required.

**Why this priority**: Stateless behavior relies on direct request-response processing.

**Independent Test**: Call `identify/page/screen/track/trackView` with and without `profile.id` and
verify one upsert call per method with schema-validated single-event payload.

**Acceptance Scenarios**:

1. **Given** valid identify payload, **When** `identify` is called, **Then** one validated identify
   event is sent through `upsertProfile`.
2. **Given** valid page/screen/track payloads, **When** each method is called, **Then** each emits
   one validated event through `upsertProfile`.
3. **Given** optional `profile.id`, **When** an event is upserted, **Then** that value is used as
   `profileId`; otherwise `profileId` is omitted.

---

### User Story 3 - Send Analytics View Events as Single Batches (Priority: P2)

As an analytics integrator in stateless environments, I need component/flag view events to be sent
as one-event Insights batches so analytics delivery remains simple and deterministic.

**Why this priority**: Stateless analytics transport correctness depends on strict one-call mapping.

**Independent Test**: Call `trackView` and `trackFlagView`, then verify built event type,
interceptor application, schema parsing, and one-batch send shape.

**Acceptance Scenarios**:

1. **Given** component view payload, **When** `trackView` is called, **Then** one `ViewEvent` is
   validated and sent in a single-item `BatchInsightsEventArray`.
2. **Given** flag view payload, **When** `trackFlagView` is called, **Then** event type remains
   component and `componentType` is derived from flag builder output before sending.
3. **Given** optional partial profile payload, **When** batch payload is built, **Then** batch
   includes optional profile alongside one event.

---

### Edge Cases

- Stateless products do not maintain consent/profile/changes/personalizations signals internally.
- In stateless core, omitted `changes` in `getCustomFlag` returns unresolved flag values
  (`undefined` per key lookup).
- In stateless core, omitted selected personalizations in `personalizeEntry` returns baseline entry.
- In stateless core, omitted profile in `getMergeTagValue` resolves merge-tag fallback behavior.
- Stateless analytics methods await Insights send call but do not add queue/backoff/circuit
  behavior.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `CoreStateless` MUST extend `CoreBase` and instantiate `AnalyticsStateless` and
  `PersonalizationStateless` with shared `api`, `builder`, and `interceptors`.
- **FR-002**: `CoreStatelessConfig.analytics` MUST omit `beaconHandler`.
- **FR-003**: `CoreStatelessConfig.eventBuilder` MUST omit `getLocale`, `getPageProperties`, and
  `getUserAgent`.
- **FR-004**: `PersonalizationStateless.identify` MUST build identify events with `EventBuilder`,
  validate with `IdentifyEvent`, and send through one `upsertProfile` call.
- **FR-005**: `PersonalizationStateless.page` MUST build page-view events, validate with
  `PageViewEvent`, and send through one `upsertProfile` call.
- **FR-006**: `PersonalizationStateless.screen` MUST build screen-view events, validate with
  `ScreenViewEvent`, and send through one `upsertProfile` call.
- **FR-007**: `PersonalizationStateless.track` MUST build track events, validate with `TrackEvent`,
  and send through one `upsertProfile` call.
- **FR-008**: `PersonalizationStateless.trackView` MUST build view events, validate with
  `ViewEvent`, and send through one `upsertProfile` call.
- **FR-009**: `PersonalizationStateless` MUST run event interceptors before sending personalization
  events.
- **FR-010**: `PersonalizationStateless.upsertProfile` payload MUST include `events: [intercepted]`
  and optional `profileId: profile?.id`.
- **FR-011**: `AnalyticsStateless.trackView` MUST build view events, run event interceptors,
  validate with `ViewEvent`, and send as one-item Insights batch.
- **FR-012**: `AnalyticsStateless.trackFlagView` MUST build flag-view events, run event
  interceptors, validate with `ViewEvent`, and send as one-item Insights batch.
- **FR-013**: `AnalyticsStateless.sendBatchEvent` MUST validate outgoing payload with
  `BatchInsightsEventArray`.
- **FR-014**: Stateless analytics batch payload MUST use shape
  `[{ profile?: PartialProfile, events: [event] }]`.
- **FR-015**: Stateless core MUST expose shared resolution methods (`getCustomFlag`,
  `personalizeEntry`, `getMergeTagValue`) without requiring internal mutable state.
- **FR-016**: Stateless core MUST avoid stateful-only APIs and stateful singleton ownership
  semantics.

### Key Entities _(include if feature involves data)_

- **CoreStateless**: Stateless runtime composed from shared core infrastructure.
- **PersonalizationStateless**: Immediate Experience API upsert product for
  identify/page/screen/track/component events.
- **AnalyticsStateless**: Immediate Insights batch sender for component/flag view events.
- **TrackViewArgs**: Component/flag view payload with optional partial profile for stateless
  analytics.
- **Stateless Upsert Payload**: `{ profileId?: string, events: ExperienceEventArray }` sent per
  call.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Stateless core initialization yields both stateless products wired to shared API and
  builder instances.
- **SC-002**: Each stateless personalization method results in exactly one Experience API upsert
  call with a single validated event.
- **SC-003**: Stateless analytics component/flag methods each result in one Insights send call with
  a single validated batch item.
- **SC-004**: Stateless usage does not require consent/state observables, queue policies, or preview
  panel signal registration.
