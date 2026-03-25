# Feature Specification: Optimization Core Stateless Environment Support

**Feature Branch**: `[010-core-stateless-environment-support]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-24).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initialize Stateless Core Runtime (Priority: P1)

As a server-side SDK author, I need a stateless core that owns direct Insights and Experience
delivery with shared API/event-builder/interceptor dependencies so I can execute in Node/SSR without
stateful runtime ownership concerns.

**Why this priority**: Stateless composition is the baseline requirement for server and function
environments.

**Independent Test**: Construct `CoreStateless` and verify direct runtime wiring, config type
constraints, and absence of stateful-only APIs.

**Acceptance Scenarios**:

1. **Given** valid `CoreStatelessConfig`, **When** `CoreStateless` is created, **Then** it
   initializes direct stateless Insights and Experience delivery using shared `api`, `eventBuilder`,
   and `interceptors`.
2. **Given** stateless API config typing, **When** callers provide `api`, **Then** the type surface
   excludes `beaconHandler`.
3. **Given** stateless event builder typing, **When** callers provide `eventBuilder`, **Then** the
   type surface excludes `getLocale`, `getPageProperties`, and `getUserAgent`.
4. **Given** a `CoreStateless` instance, **When** stateless APIs are inspected, **Then** stateful
   APIs (`states`, `consent`, `reset`, `flush`, `registerPreviewPanel`) are not part of the runtime
   surface.

---

### User Story 2 - Send Personalization Events Immediately (Priority: P1)

As an integrator in a stateless host, I need Experience-bound methods to build, validate, intercept,
and send events immediately through Experience API upsert so no local queue/state coordination is
required.

**Why this priority**: Stateless Experience delivery depends on direct request-response behavior.

**Independent Test**: Call `identify/page/screen/track/trackView` with and without `profile.id` and
verify one upsert per call with schema-validated event payload.

**Acceptance Scenarios**:

1. **Given** valid identify/page/screen/track/sticky-view payloads, **When** corresponding
   `CoreStateless` methods run through the Experience path, **Then** each method builds the correct
   event type, validates it, and performs one `upsertProfile` call.
2. **Given** event interceptors, **When** stateless Experience delivery sends events, **Then**
   interceptor output is validated as `ExperienceEvent` before submission.
3. **Given** optional partial profile input, **When** upsert payload is built, **Then** `profileId`
   uses `profile?.id` when present and is omitted when absent.

---

### User Story 3 - Send Stateless Insights as Single Batches (Priority: P2)

As an integrator in stateless environments, I need component and flag interactions sent as
single-item Insights batches so delivery remains deterministic and easy to reason about.

**Why this priority**: Stateless Insights correctness relies on strict one-call mapping.

**Independent Test**: Call `trackView`, `trackClick`, `trackHover`, and `trackFlagView`; verify
builder output, interceptor application, schema parsing, and one-batch send payload shape.

**Acceptance Scenarios**:

1. **Given** component interaction payloads, **When** `trackView`, `trackClick`, or `trackHover`
   runs, **Then** one corresponding event is validated and sent as a single
   `BatchInsightsEventArray` item.
2. **Given** flag-view payload, **When** `trackFlagView` runs, **Then** event type remains
   `'component'` and `componentType` is `'Variable'` before sending.
3. **Given** optional partial profile payload, **When** an Insights batch payload is built, **Then**
   outgoing shape is `[{ profile?: PartialProfile, events: [event] }]`.
4. **Given** core facade usage, **When** `CoreBase.trackView` is called, **Then** sticky payloads
   route to both Experience and Insights while non-sticky payloads route to Insights only.

---

### Edge Cases

- Stateless runtimes do not use consent guards, singleton locking, or queue retry/backoff runtime.
- Stateless Experience upserts do not use anonymous-ID fallback; outgoing `profileId` is derived
  only from `profile?.id`.
- `CoreBase.trackFlagView`, `trackClick`, and `trackHover` always dispatch through Insights.
- Stateless resolver helpers (`getFlag`, `resolveOptimizedEntry`, `getMergeTagValue`) require
  explicit input values; no stateful signal defaults are applied.
- Stateless `getFlag` does not auto-emit `trackFlagView`; flag-view emission is explicit in
  stateless environments.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `CoreStateless` MUST extend `CoreBase` and own direct stateless Insights and
  Experience delivery with shared `api`, `eventBuilder`, and `interceptors`.
- **FR-002**: `CoreStatelessConfig.api` MUST omit `beaconHandler` from its type surface.
- **FR-003**: `CoreStatelessConfig.eventBuilder` MUST omit `getLocale`, `getPageProperties`, and
  `getUserAgent` from its type surface.
- **FR-004**: `CoreStateless.identify` MUST build identify events, validate with `IdentifyEvent`,
  and send through one Experience `upsertProfile` call.
- **FR-005**: `CoreStateless.page` MUST build page events, validate with `PageViewEvent`, and send
  through one Experience `upsertProfile` call.
- **FR-006**: `CoreStateless.screen` MUST build screen events, validate with `ScreenViewEvent`, and
  send through one Experience `upsertProfile` call.
- **FR-007**: `CoreStateless.track` MUST build track events, validate with `TrackEvent`, and send
  through one Experience `upsertProfile` call.
- **FR-008**: `CoreStateless.trackView` MUST build sticky view events for the Experience path,
  validate with `ViewEvent`, and send through one Experience `upsertProfile` call.
- **FR-009**: `CoreStateless` MUST run event interceptors before validating as `ExperienceEvent` and
  sending on the Experience path.
- **FR-010**: Stateless Experience upsert payload MUST use
  `{ profileId: profile?.id, events: [validEvent] }`.
- **FR-011**: `CoreStateless.trackView` MUST build Insights view events, run event interceptors,
  validate as `InsightsEvent`, and send one-item batches.
- **FR-012**: `CoreStateless.trackClick` MUST build click events, run event interceptors, validate
  as `InsightsEvent`, and send one-item batches.
- **FR-013**: `CoreStateless.trackHover` MUST build hover events, run event interceptors, validate
  as `InsightsEvent`, and send one-item batches.
- **FR-014**: `CoreStateless.trackFlagView` MUST build flag-view events via `buildFlagView`, run
  event interceptors, validate as `InsightsEvent`, and send one-item batches.
- **FR-015**: Stateless Insights outgoing batch payload MUST validate against
  `BatchInsightsEventArray` and use shape `[{ profile?: PartialProfile, events: [event] }]`.
- **FR-016**: Core stateless facade methods MUST route as follows: `identify/page/screen/track` to
  Experience; `trackView` to Insights for all payloads and additionally to Experience when `sticky`
  is truthy; `trackClick/trackHover/trackFlagView` to Insights.
- **FR-017**: `CoreStateless` MUST expose resolver helpers (`getFlag`, `resolveOptimizedEntry`,
  `getMergeTagValue`) without requiring mutable runtime state.
- **FR-018**: `CoreStateless` MUST remain stateless-only and MUST NOT introduce stateful singleton,
  consent-state controller, preview bridge, or queue-policy control surfaces.

### Key Entities _(include if feature involves data)_

- **CoreStateless**: Stateless runtime composed from shared core infrastructure and direct delivery
  helpers.
- **TrackView/TrackClick/TrackHover Args**: Component interaction payload shapes with optional
  partial profile data in stateless APIs.
- **Stateless Experience Upsert Payload**: `{ profileId?: string, events: ExperienceEventArray }`
  sent per Experience-bound call.
- **Stateless Insights Batch Payload**: `[{ profile?: PartialProfile, events: [InsightsEvent] }]`
  sent per Insights-bound call.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Stateless core initialization yields direct Insights and Experience delivery wired to
  shared API, builder, and interceptor instances.
- **SC-002**: Each stateless Experience-bound method produces exactly one Experience API upsert call
  with one validated event.
- **SC-003**: Stateless Insights methods (`trackView`, `trackClick`, `trackHover`, `trackFlagView`)
  each produce one Insights send call with one validated batch item.
- **SC-004**: Stateless usage does not require consent signals, queue policies, singleton lock
  management, or preview-panel bridge registration.
