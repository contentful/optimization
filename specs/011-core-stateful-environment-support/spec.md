# Feature Specification: Optimization Core Stateful Environment Support

**Feature Branch**: `[011-core-stateful-environment-support]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-05).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Manage One Stateful Runtime with Observable State (Priority: P1)

As a client-side SDK integrator, I need one runtime-scoped stateful core instance with observable
consent/profile/event streams, derived personalization-availability state, and preview-panel state
so personalization and analytics state stays coherent across the app.

**Why this priority**: Stateful behavior depends on globally consistent shared state.

**Independent Test**: Create/destroy stateful instances and verify singleton lock behavior, state
defaults, and observable stream availability.

**Acceptance Scenarios**:

1. **Given** one active `CoreStateful` instance, **When** a second instance is created in the same
   runtime before destroy, **Then** initialization fails with singleton-lock error.
2. **Given** `defaults` config, **When** stateful core initializes, **Then**
   consent/profile/changes/personalizations defaults are applied to signals.
3. **Given** `core.states`, **When** states are read, **Then** observables for consent, blocked
   event stream, event stream, flags, can-personalize, profile, personalizations,
   preview-panel-attached, and preview-panel-open are exposed.
4. **Given** `core.reset()` is called after preview panel attach/open states were set, **When**
   reset completes, **Then** blocked/event/changes/profile/personalizations are cleared while
   consent and preview panel states are preserved.
5. **Given** a state observable, **When** `current`, `subscribe`, and `subscribeOnce` are used,
   **Then** snapshots are deep-cloned and `subscribeOnce` emits only the first non-nullish value.

---

### User Story 2 - Enforce Consent Gating with Blocked Event Telemetry (Priority: P1)

As a privacy-focused integrator, I need stateful event methods to be guarded by consent and report
blocked calls through callback and stream state so I can audit blocked behavior.

**Why this priority**: Consent gating is mandatory for compliant runtime behavior.

**Independent Test**: Invoke guarded methods under denied/undefined consent and verify blocked-event
callback payload and blocked-event stream emission.

**Acceptance Scenarios**:

1. **Given** no consent and disallowed event type, **When** a guarded analytics/personalization
   method is called, **Then** execution is blocked and blocked-event diagnostics are emitted.
2. **Given** allowed event types (`identify`, `page`, `screen` by default in core), **When** consent
   is missing, **Then** those event types still pass guard checks.
3. **Given** blocking diagnostics callback throws, **When** blocked event reporting occurs, **Then**
   callback failure is swallowed and blocked-event signal is still updated.

---

### User Story 3 - Queue and Flush Events with Retry, Backoff, and Offline Support (Priority: P2)

As a runtime maintainer, I need robust queueing and retry policies for analytics and personalization
stateful products so events can recover from temporary failures and offline periods.

**Why this priority**: Stateful reliability depends on resilient queue flushing and bounded failure
handling.

**Independent Test**: Simulate offline mode and send failures; verify queue retention/drop behavior,
retry scheduling, circuit opening, and recovery callbacks.

**Acceptance Scenarios**:

1. **Given** analytics events and an active profile, **When** events are queued and flush fails,
   **Then** retries follow configured backoff policy and queue remains until success.
2. **Given** personalization events while offline, **When** queue exceeds `maxEvents`, **Then**
   oldest events are dropped first and `onDrop` callback receives dropped payload context.
3. **Given** repeated flush failures reaching threshold, **When** retries are scheduled, **Then**
   circuit-open delay is applied before next allowed flush.
4. **Given** connectivity returns online, **When** online signal turns true, **Then** pending
   retries are cleared and force-flush is attempted.

---

### Edge Cases

- `destroy()` is idempotent and must safely release singleton ownership only once.
- `reset()` clears blocked/event/changes/profile/personalizations but intentionally preserves
  consent and preview panel attachment/open state.
- `flush({ force: true })` bypasses offline/backoff/circuit gates but not active in-flight flush.
- Analytics queueing without a current profile drops event enqueue attempt (warn only).
- Immediate online personalization send failures do not backfill the offline queue.
- Queue policy callbacks (`onDrop`, `onFlushFailure`, `onCircuitOpen`, `onFlushRecovered`) are
  best-effort and callback exceptions are swallowed.
- `subscribeOnce` emits only on the first non-nullish (`!= null`) value and auto-unsubscribes.
- Observable `current` values and subscription payloads are deep-cloned snapshots and must not
  mutate internal signal state when mutated by consumers.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `CoreStateful` MUST acquire runtime singleton ownership during construction and reject
  parallel stateful instances in the same runtime.
- **FR-002**: `CoreStateful.destroy()` MUST release singleton ownership for its instance and MUST be
  safe to call multiple times.
- **FR-003**: `CoreStateful` MUST split scoped `queuePolicy` fields from analytics/personalization
  config before constructing shared `ApiClient`.
- **FR-004**: `CoreStateful` MUST construct `AnalyticsStateful` and `PersonalizationStateful` using
  shared `api`, `builder`, `interceptors`, and stateful product config.
- **FR-005**: `CoreStateful` MUST expose `states` as observables for `consent`,
  `blockedEventStream`, `eventStream`, `flags`, `canPersonalize`, `profile`, `personalizations`,
  `previewPanelAttached`, and `previewPanelOpen`.
- **FR-006**: `CoreStateful.consent(accept)` MUST update consent signal state.
- **FR-007**: `CoreStateful.reset()` MUST clear blocked/event/changes/profile/personalizations and
  MUST NOT clear consent or preview panel attachment/open signals.
- **FR-008**: `CoreStateful.flush()` MUST flush analytics queue then personalization queue.
- **FR-009**: `CoreStateful.registerPreviewPanel()` MUST mutate the provided preview object with
  symbol-keyed mutable bridge values for `signals` and `signalFns` (no return-value contract).
- **FR-010**: Stateful products MUST implement consent checks through `guardedBy` using `hasConsent`
  and `onBlockedByConsent`.
- **FR-011**: Consent checks MUST allow events when consent is true or when event type appears in
  allowed-event list (default `['identify', 'page', 'screen']` in core).
- **FR-012**: Consent checks for `trackView` and `trackFlagView` MUST map method names to
  `'component'` for allow-list matching.
- **FR-013**: Analytics stateful queue MUST be grouped by `profile.id` and preserve latest profile
  snapshot per profile ID.
- **FR-014**: Analytics stateful queue MUST auto-flush when total queued events reaches `25`.
- **FR-015**: Analytics flush MUST treat both `false` responses and thrown send errors as failures
  for retry runtime handling.
- **FR-016**: Personalization stateful offline queue MUST default to `maxEvents: 100` and drop
  oldest events first when queue bounds are exceeded.
- **FR-017**: Personalization stateful `onDrop` callback MUST receive dropped events context and
  MUST be fault-tolerant (callback errors swallowed).
- **FR-018**: Personalization stateful online path MUST send events immediately via Experience
  upsert; offline path MUST queue events and return `undefined`.
- **FR-019**: Personalization stateful upsert MUST prefer `getAnonymousId()` over `profile.id` when
  resolving outgoing `profileId`.
- **FR-020**: Personalization stateful MUST run state interceptors before applying returned
  `changes/profile/personalizations` to signals.
- **FR-021**: State signal updates after Experience responses MUST be value-aware and avoid
  redundant assignments when payloads are deeply equal.
- **FR-022**: Queue flush runtime MUST skip flushes when in-flight and, unless forced, when offline,
  backoff window is active, or circuit window is open.
- **FR-023**: Queue flush runtime MUST apply normalized retry policy defaults: `baseBackoffMs=500`,
  `maxBackoffMs=30000`, `jitterRatio=0.2`, `maxConsecutiveFailures=8`, `circuitOpenMs=120000`.
- **FR-024**: Queue flush runtime MUST invoke failure/circuit/recovered callbacks with queue and
  retry context payloads and MUST schedule retry attempts accordingly.
- **FR-025**: `CoreStateful.states` observables MUST expose `current`, `subscribe`, and
  `subscribeOnce`; `current` and emitted callback payloads MUST be deep-cloned snapshots; and
  `subscribeOnce` MUST emit only the first non-nullish value before auto-unsubscribing.

### Key Entities _(include if feature involves data)_

- **CoreStateful**: Runtime singleton coordinating stateful analytics/personalization products.
- **CoreStates**: Observable contract for consent, blocked events, emitted events, flags, profile,
  can-personalize status, selected personalizations, preview panel attach/open state, and cloned
  snapshot access semantics (`current`/`subscribe`/`subscribeOnce`).
- **AnalyticsStateful Queue**: Profile-grouped in-memory event map with flush/backoff/circuit
  policy.
- **Personalization Offline Queue**: Ordered set of Experience events retained while offline.
- **QueueFlushRuntime**: Shared retry/backoff/circuit state machine used by stateful products.
- **Queue Policy Contexts**: Failure/recovery/drop callback payload contracts for telemetry.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Singleton lifecycle tests confirm only one active stateful instance per runtime until
  `destroy()` is called.
- **SC-002**: Consent-blocked calls are emitted via both callback and blocked-event observable
  stream.
- **SC-003**: Analytics and personalization queue policies demonstrate retry/backoff/circuit
  behavior and recover by clearing queued events after successful flush.
- **SC-004**: Offline personalization queue enforces max-size drop policy with accurate drop-context
  callback payloads.
- **SC-005**: State observable tests confirm full `core.states` coverage (including `canPersonalize`
  and preview panel states), reset-preserved preview state, and cloned
  `current`/`subscribe`/`subscribeOnce` behavior.
