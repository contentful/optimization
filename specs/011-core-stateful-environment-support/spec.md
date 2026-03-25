# Feature Specification: Optimization Core Stateful Environment Support

**Feature Branch**: `[011-core-stateful-environment-support]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-24).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Manage One Stateful Runtime with Observable Signals (Priority: P1)

As a client-side SDK integrator, I need one singleton-scoped stateful core with observable consent,
profile, event, personalization-selection, and preview-bridge signals so runtime behavior stays
coherent across the app.

**Why this priority**: Stateful behavior depends on globally consistent shared signal state.

**Independent Test**: Create and destroy stateful instances, verify singleton lock behavior,
default-value application, reset behavior, and observable contracts.

**Acceptance Scenarios**:

1. **Given** one active `CoreStateful` instance, **When** a second instance is created before
   `destroy()`, **Then** creation fails with singleton-lock error.
2. **Given** `defaults` in config, **When** `CoreStateful` initializes, **Then**
   `consent`/`profile`/`changes`/`selectedOptimizations` defaults are applied to shared signals.
3. **Given** `core.states`, **When** state observables are read, **Then** the surface includes
   `consent`, `blockedEventStream`, `eventStream`, `flags`, `canOptimize`, `profile`,
   `selectedOptimizations`, `previewPanelAttached`, and `previewPanelOpen`.
4. **Given** repeated access to `core.states`, **When** the property is read multiple times,
   **Then** the same stable states object reference is returned.
5. **Given** `core.reset()` after preview panel signals were set, **When** reset completes, **Then**
   `blockedEvent`/`event`/`changes`/`profile`/`selectedOptimizations` are cleared while `consent`,
   `previewPanelAttached`, and `previewPanelOpen` remain unchanged.
6. **Given** a state observable, **When** `current`, `subscribe`, and `subscribeOnce` are used,
   **Then** values are deep-cloned snapshots and `subscribeOnce` emits only the first non-nullish
   value.

---

### User Story 2 - Enforce Consent Gating with Blocked Event Telemetry (Priority: P1)

As a privacy-focused integrator, I need stateful Core event methods to be guarded by consent and to
emit blocked diagnostics so blocked behavior is auditable.

**Why this priority**: Consent gating is required for compliant event behavior.

**Independent Test**: Invoke guarded methods with denied/undefined consent and verify blocked-event
callback and blocked-event stream behavior.

**Acceptance Scenarios**:

1. **Given** no consent and disallowed event types, **When** guarded methods are called, **Then**
   method execution is blocked and blocked-event diagnostics are emitted.
2. **Given** default allowed event types (`identify`, `page`, `screen`), **When** consent is
   missing, **Then** those event types are still allowed.
3. **Given** consent mapping for component methods, **When** `trackView`/`trackFlagView` are gated,
   **Then** allow-list checks use `'component'`; the shared mapping also maps `trackClick` to
   `'component_click'` and `trackHover` to `'component_hover'`.
4. **Given** throwing `onEventBlocked` callbacks, **When** blocked-event reporting runs, **Then**
   callback failures are swallowed and blocked-event signal publication continues.

---

### User Story 3 - Queue and Flush Reliably with Retry/Backoff/Circuit Controls (Priority: P2)

As a runtime maintainer, I need stateful Insights and Experience queues with retry/backoff and
offline handling so temporary failures do not immediately lose events.

**Why this priority**: Stateful reliability depends on bounded retry and deterministic queue
behavior.

**Independent Test**: Simulate offline mode and send failures; verify queue retention/drop behavior,
retry scheduling, circuit windows, and recovery callbacks.

**Acceptance Scenarios**:

1. **Given** Insights events and a current profile, **When** events are enqueued, **Then** queue
   storage is grouped by `profile.id` and the latest profile snapshot is retained per key.
2. **Given** Insights queue growth to threshold, **When** queued event count reaches `25`, **Then**
   flush is automatically triggered.
3. **Given** Experience events while offline, **When** queue exceeds `offlineMaxEvents` (default
   `100`), **Then** oldest events are dropped first and optional `onOfflineDrop` receives drop
   context.
4. **Given** flush failures (false response or thrown error), **When** retries run, **Then**
   backoff/circuit policy and callbacks (`onFlushFailure`, `onCircuitOpen`, `onFlushRecovered`)
   execute via `QueueFlushRuntime`.
5. **Given** online status changes to true, **When** reactive online effects run, **Then** pending
   retries are cleared and force-flush is attempted for both delivery paths.
6. **Given** immediate online Experience sends fail, **When** the send throws, **Then** the error
   propagates and the event is not backfilled into the offline queue.

---

### Edge Cases

- `destroy()` is idempotent and releases singleton ownership only for the owning instance.
- `registerPreviewPanel()` sets symbol-keyed bridge values (`signals`, `signalFns`) but does not
  toggle `previewPanelAttached`/`previewPanelOpen`.
- `canOptimize` is derived from `selectedOptimizations !== undefined`; an empty array still yields
  `true`.
- `CoreStateful.reset()` clears selected signal values only; it does not directly clear internal
  Insights queue maps or Experience offline queue sets.
- `CoreStateful.flush()` has no force option and always awaits Insights flush before Experience
  flush.
- Internal force flushes bypass offline/backoff/circuit gates, but not an already in-flight flush.
- Queue policy callbacks are best-effort; callback exceptions are swallowed and reported through
  runtime callback handlers.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `CoreStateful` construction MUST acquire runtime singleton ownership and reject
  concurrent stateful instances in the same runtime.
- **FR-002**: If `CoreStateful` constructor fails after acquiring singleton ownership, it MUST
  release the singleton lock before rethrowing.
- **FR-003**: `CoreStateful.destroy()` MUST be idempotent and MUST release singleton ownership for
  its owner token.
- **FR-004**: `CoreStateful` MUST accept a shared `queuePolicy` separate from unified `api`
  configuration and apply it to the appropriate internal delivery runtimes.
- **FR-005**: `CoreStateful` MUST initialize Core-owned stateful Insights and Experience delivery
  using shared `api`, `eventBuilder`, `interceptors`, and forwarded stateful config
  (`allowedEventTypes`, `onEventBlocked`, defaults, queue policy, and optional `getAnonymousId`).
- **FR-006**: `CoreStateful.states` MUST expose observables for `consent`, `blockedEventStream`,
  `eventStream`, `flags`, `canOptimize`, `profile`, `selectedOptimizations`, `previewPanelAttached`,
  and `previewPanelOpen`.
- **FR-007**: `CoreStateful.states` MUST remain a stable object reference for the instance lifetime.
- **FR-008**: `CoreStateful.consent(accept)` MUST set the shared consent signal to the provided
  boolean value.
- **FR-009**: `CoreStateful.reset()` MUST clear `blockedEvent`, `event`, `changes`, `profile`, and
  `selectedOptimizations` signals.
- **FR-010**: `CoreStateful.reset()` MUST NOT clear `consent`, `previewPanelAttached`, or
  `previewPanelOpen`.
- **FR-011**: `CoreStateful.flush()` MUST sequentially await Insights flush then Experience flush.
- **FR-012**: `CoreStateful.registerPreviewPanel()` MUST set
  `PREVIEW_PANEL_SIGNALS_SYMBOL -> signals` and `PREVIEW_PANEL_SIGNAL_FNS_SYMBOL -> signalFns` on
  the provided object.
- **FR-013**: `CoreStateful.registerPreviewPanel()` MUST NOT set or infer preview attached/open
  boolean signal state.
- **FR-014**: Stateful Core event methods MUST be guarded through `guardedBy` using `hasConsent` and
  `onBlockedByConsent`.
- **FR-015**: Consent checks MUST allow events when consent is true or mapped event type is in
  `allowedEventTypes`; default allowed types MUST remain `['identify', 'page', 'screen']` when
  unspecified.
- **FR-016**: Consent mapping MUST normalize `trackView` and `trackFlagView` to `'component'`,
  `trackClick` to `'component_click'`, and `trackHover` to `'component_hover'`.
- **FR-017**: Blocked event diagnostics MUST emit `reason`, `method`, and `args` and MUST NOT
  include a product taxonomy field.
- **FR-018**: Insights stateful queue MUST be keyed by `profile.id`, preserve latest profile
  snapshot per key, and skip enqueue when no current profile is available.
- **FR-019**: Insights stateful queue MUST auto-flush when total queued events reaches `25`.
- **FR-020**: Insights flush MUST treat both `false` API responses and thrown send errors as flush
  failures for retry runtime handling.
- **FR-021**: Shared `queuePolicy.flush` defaults MUST normalize to `baseBackoffMs=500`,
  `maxBackoffMs=30000`, `jitterRatio=0.2`, `maxConsecutiveFailures=8`, and `circuitOpenMs=120000`.
- **FR-022**: Experience stateful offline queue MUST default to `offlineMaxEvents: 100`, drop oldest
  events first when bounds are exceeded, and provide drop context to optional `onOfflineDrop`.
- **FR-023**: Experience offline `onOfflineDrop` callback failures MUST be swallowed.
- **FR-024**: Experience stateful online path MUST send events immediately and return
  `OptimizationData`; offline path MUST queue events and return `undefined`.
- **FR-025**: Experience online send failures MUST propagate and MUST NOT automatically enqueue
  failed online events in the offline queue.
- **FR-026**: Experience upsert profile resolution MUST prefer `getAnonymousId()` when it returns a
  truthy value, otherwise fallback to `profile.id` from shared signal state.
- **FR-027**: Experience state updates from responses MUST run through `interceptors.state` before
  updating signals.
- **FR-028**: Signal updates for `changes`, `profile`, and `selectedOptimizations` MUST be
  deep-equality aware and skip redundant assignments.
- **FR-029**: `QueueFlushRuntime.shouldSkip()` MUST always block in-flight flushes and, unless
  forced, MUST gate flushes for offline state, active backoff windows, and open circuits.
- **FR-030**: Queue flush runtime MUST invoke failure/circuit/recovered callbacks with queue and
  retry context payloads, schedule retries, and fault-tolerantly report callback exceptions through
  `onCallbackError` when configured.
- **FR-031**: Core state observables (`current`, `subscribe`, `subscribeOnce`) MUST deep-clone
  exposed values; `subscribeOnce` MUST emit only the first non-nullish value then auto-unsubscribe.

### Key Entities _(include if feature involves data)_

- **CoreStateful**: Runtime singleton coordinating stateful Insights and Experience delivery.
- **CoreStates**: Observable contract for consent, blocked/event streams, flags, profile,
  selected-personalization state, derived `canOptimize`, and preview panel signals.
- **Insights Queue**: Profile-grouped in-memory queue with auto-flush and retry/circuit controls.
- **Experience Offline Queue**: Ordered set of Experience events retained while offline.
- **QueueFlushRuntime**: Shared retry/backoff/circuit state machine used by stateful products.
- **Preview Panel Bridge**: Symbol-keyed attachment contract for sharing `signals` and `signalFns`
  with preview tooling.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Singleton lifecycle tests confirm one active `CoreStateful` instance per runtime until
  `destroy()` is called.
- **SC-002**: Consent-blocked calls are emitted through both `onEventBlocked` callback and
  `blockedEventStream` observable.
- **SC-003**: Insights and Experience queues demonstrate configured retry/backoff/circuit behavior
  and recover by clearing queued events after successful flush.
- **SC-004**: Offline Experience queue enforces max-size drop policy with accurate drop-context
  callback payloads.
- **SC-005**: Core state observable tests confirm full state coverage, reset preservation semantics,
  and deep-cloned `current`/`subscribe`/`subscribeOnce` behavior.
