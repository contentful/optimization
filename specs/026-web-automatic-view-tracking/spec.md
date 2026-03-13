# Feature Specification: Contentful Optimization Web Automatic Component View Tracking

**Feature Branch**: `[026-web-automatic-view-tracking]`  
**Created**: 2026-02-27  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Track Entry Component Views After Visibility Dwell (Priority: P1)

As a Web SDK consumer, I need component view events emitted automatically after tracked entry
elements remain visible long enough so component view analytics are collected without manual event
calls.

**Why this priority**: Automatic view tracking is a primary built-in interaction type for Web SDK
integrations.

**Independent Test**: Start the view detector, trigger intersections that satisfy dwell constraints,
keep elements visible for periodic updates, then end visibility and assert initial/periodic/final
`trackView` payload dispatch.

**Acceptance Scenarios**:

1. **Given** an auto-tracked entry element meeting intersection and dwell thresholds, **When** dwell
   completes, **Then** exactly one initial component view event is dispatched.
2. **Given** a visible entry element after the first event, **When** each update interval elapses
   and visibility remains above threshold, **Then** one additional component view event is
   dispatched with an increased `viewDurationMs`.
3. **Given** a visible entry element that already emitted at least one view event, **When** it
   leaves threshold visibility, **Then** one final component view event is dispatched for that
   visibility cycle.
4. **Given** a visibility cycle that ends before dwell threshold is reached, **When** threshold
   visibility stops, **Then** no component view event is dispatched for that cycle.
5. **Given** a single visibility cycle, **When** initial, periodic, and final events are emitted,
   **Then** all events reuse the same `viewId`.
6. **Given** a tracked entry payload with `sticky: true`, **When** the first successful
   `core.trackView` call for an element returns personalization data, **Then** later emissions for
   that element omit `sticky`.
7. **Given** a tracked entry payload with `sticky: true`, **When** `core.trackView` returns
   `undefined` or rejects for an element, **Then** later emissions for that element continue sending
   `sticky` until a successful personalization response is returned.
8. **Given** two tracked elements with the same component metadata and `sticky: true`, **When** each
   element emits its first sticky view event, **Then** both emissions include `sticky`
   independently.

---

### User Story 2 - Support Auto/Override Reconciliation with Configurable Dwell Options (Priority: P1)

As an SDK integrator, I need observer-level options and per-element overrides that reconcile with
global auto-tracking so view detection can be tuned without losing element-level control.

**Why this priority**: Dwell thresholds and viewport rules differ across products and experiences.

**Independent Test**: Configure observer-level options and per-element overrides, toggle auto mode,
and verify observed-element behavior plus callback metadata.

**Acceptance Scenarios**:

1. **Given** observer-level options for dwell and visible ratio, **When** an element intersects
   below threshold, **Then** no callback is fired until threshold conditions are met.
2. **Given** a per-element dwell override, **When** the element becomes visible, **Then** callback
   timing follows the per-element dwell value rather than observer default.
3. **Given** a per-element or dataset-driven view-duration update interval override, **When** the
   element remains visible, **Then** periodic callback timing follows that override.
4. **Given** per-element `data`, **When** callback is invoked, **Then** callback info includes that
   `data` alongside `totalVisibleMs`, `viewId`, and `attempts`.
5. **Given** an auto-tracked element with `data-ctfl-track-views='false'`, **When** intersections
   satisfy dwell conditions, **Then** no component view event is dispatched.
6. **Given** global view auto-tracking is disabled and an auto-discovered entry has
   `data-ctfl-track-views='true'`, **When** dwell conditions are met, **Then** one component view
   event is dispatched.

---

### User Story 3 - Maintain Deterministic View Lifecycle Under Visibility and Teardown Events (Priority: P2)

As a runtime maintainer, I need deterministic pause/resume, in-flight coalescing, and teardown
cleanup so view tracking remains stable under tab visibility changes and dynamic DOM lifecycle.

**Why this priority**: Intersection and page visibility behavior is timing-sensitive and prone to
subtle regressions.

**Independent Test**: Simulate hide/show cycles, callback in-flight windows, callback failures,
unobserve/disconnect calls, and orphan element cleanup sweeps.

**Acceptance Scenarios**:

1. **Given** an element accumulating dwell time when visible, **When** the page becomes hidden and
   later visible, **Then** dwell resumes from remaining time and triggers once.
2. **Given** an in-flight callback attempt, **When** additional qualifying intersections occur,
   **Then** duplicate concurrent callback attempts are not started.
3. **Given** visibility ends while callback is in flight after first emission, **When** the callback
   settles, **Then** one deferred final view event is emitted once.
4. **Given** callback failure or element disconnect/drop, **When** lifecycle settles, **Then** state
   is finalized and element tracking is cleaned up without retry loops.

---

### Edge Cases

- Observer defaults are `dwellTimeMs: 1000`, `minVisibleRatio: 0.1`, `root: null`, and
  `rootMargin: '0px'`.
- Per-element options support `dwellTimeMs`, `viewDurationUpdateIntervalMs`, and callback `data`;
  per-element `minVisibleRatio` is intentionally unsupported.
- Per-element attribute override supports `data-ctfl-view-duration-update-interval-ms`; values must
  parse to finite non-negative numbers or be ignored.
- `setAuto(false)` disables observation for auto-discovered elements unless force-enabled by manual
  override or `data-ctfl-track-views='true'`.
- `disableElement` suppresses observation for that element even when auto-tracking is enabled.
- `clearElement` returns the element to attribute/automatic observation rules.
- `data-ctfl-track-views` supports per-element view override for auto-discovered entries where only
  case-insensitive `'true'` and `'false'` are recognized.
- Manual `enableElement`/`disableElement` overrides take precedence over `data-ctfl-track-views`;
  after `clearElement`, observation eligibility falls back to `data-ctfl-track-views` first, then
  auto-tracking state.
- Dwell accumulation resets when an element exits threshold visibility (no cross-cycle
  accumulation), while still allowing one final view callback for cycles that already emitted.
- `viewId` is generated per visibility cycle, reused for all events in that cycle, and replaced on
  the next visibility cycle.
- `viewDurationMs` is emitted as rounded non-negative milliseconds derived from accumulated visible
  time.
- Sticky dedupe is scoped per observed element and is marked successful only when
  `core.trackView(...)` resolves with personalization data.
- Callback failures are logged and do not permanently disable subsequent periodic updates while an
  element remains visible.
- `disconnect()` removes timers, active state, and page visibility listeners.
- Orphaned/detached element state is swept periodically and on relevant lifecycle transitions.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `createEntryViewDetector(core)` MUST produce an interaction detector with
  `start/stop/setAuto/onEntryAdded/onEntryRemoved/enableElement/disableElement/clearElement`
  handlers backed by `ElementViewObserver`.
- **FR-002**: Detector `start(options)` MUST create a new `ElementViewObserver` using provided start
  options and a callback that bridges to `core.trackView`.
- **FR-003**: Detector `stop()` MUST disconnect the active `ElementViewObserver` and clear detector
  auto-tracked element, attribute-override, and manual-override state.
- **FR-004**: Detector `setAuto(enabled)` MUST control whether auto-discovered entry elements are
  currently observed and MUST reconcile current observed state.
- **FR-005**: Detector `onEntryAdded(element)` MUST register the element as auto-tracked, resolve
  optional attribute override state, and reconcile observation eligibility.
- **FR-006**: Detector `onEntryRemoved(element)` MUST unregister auto-tracked status, clear
  attribute-override state for that element, and reconcile observation eligibility.
- **FR-007**: Detector `enableElement(element, options)` MUST set an enabled override for the
  element and observe using per-element options when eligible.
- **FR-008**: Detector `disableElement(element)` MUST set a disabled override and unobserve the
  element.
- **FR-009**: Detector `clearElement(element)` MUST remove any manual override and reconcile
  observation eligibility from attribute and auto-tracking state.
- **FR-010**: Auto-tracking callback MUST resolve payload via
  `resolveTrackingPayload(info.data, element)` and MUST call `core.trackView` only when payload
  resolution succeeds, while preserving element context for sticky dedupe behavior.
- **FR-011**: `ElementViewObserver` MUST initialize effective observer options with defaults and
  construct an `IntersectionObserver` with threshold `[0]` when `minVisibleRatio` is `0`, otherwise
  `[0, minVisibleRatio]`.
- **FR-012**: `observe(element, options)` MUST create per-element state once, apply per-element
  dwell/data options at creation, store state with WeakRef fallback support, and begin observing the
  element.
- **FR-013**: `unobserve(element)` MUST clear pending timers, mark state done, remove state from
  active tracking, and stop sweeper when no active states remain.
- **FR-014**: Intersections meeting visibility threshold MUST start or continue a visibility cycle;
  intersections outside threshold MUST end the current visibility cycle and clear active timers.
- **FR-015**: Dwell scheduling MUST trigger callback immediately when remaining dwell time is `<= 0`
  and otherwise schedule callback for the remaining dwell duration.
- **FR-016**: Page visibility changes to hidden MUST pause active visibility cycles and clear
  pending fire timers; visibility changes to visible MUST resume eligible cycles from remaining
  dwell time.
- **FR-017**: Callback execution MUST be coalesced per element (`inFlight` guard), increment
  `attempts`, and pass callback info `{ totalVisibleMs, viewId, attempts, data }`.
- **FR-018**: While visibility remains active after first emission, observer MUST continue
  scheduling periodic callbacks at the configured view update interval.
- **FR-019**: Visibility end before first callback attempt MUST reset cycle state without emitting a
  final event.
- **FR-020**: Visibility end after first callback attempt MUST emit one final callback immediately,
  or defer that final callback until the in-flight attempt settles.
- **FR-021**: Callback settle behavior MUST reset ended visibility cycles and continue scheduling
  for still-visible cycles; callback failures MUST be logged and MUST NOT permanently stop future
  periodic attempts while visibility remains active.
- **FR-022**: `disconnect()` MUST disconnect the intersection observer, clear timers and active
  states, remove visibility listeners, and stop the orphan sweeper interval.
- **FR-023**: Orphan sweeping MUST detect dropped references and disconnected elements, finalize
  those states, and stop sweeping when no active states remain.
- **FR-024**: `onEntryAdded(element)` MUST resolve optional attribute overrides from
  `dataset.ctflTrackViews` (boolean override semantics) and
  `dataset.ctflViewDurationUpdateIntervalMs` (finite non-negative numeric parsing).
- **FR-025**: Observation eligibility precedence MUST be manual enable/disable override first, then
  attribute override (`ctflTrackViews`), then `setAuto(enabled)` + auto-tracked membership.
- **FR-026**: `clearElement(element)` MUST clear only manual override state and MUST continue to
  honor attribute override state (including `ctflTrackViews` and parsed
  `ctflViewDurationUpdateIntervalMs`) for auto-discovered elements.
- **FR-027**: When resolved tracking payload includes `sticky: true`, detector callbacks MUST send
  `sticky: true` until the first `core.trackView` call for that element resolves with a defined
  personalization result.
- **FR-028**: After sticky success is recorded for an element, subsequent callbacks for that element
  MUST omit `sticky` while continuing to emit analytics view events.
- **FR-029**: Sticky dedupe MUST be keyed by element identity, so separately rendered elements with
  identical component metadata are treated as distinct sticky targets.

### Key Entities _(include if feature involves data)_

- **Entry View Detector**: Interaction detector that maps registry events and element overrides to
  `ElementViewObserver` operations.
- **ElementViewObserver**: Intersection/dwell runtime maintaining per-element visibility state.
- **ElementViewCallbackInfo**: Callback metadata (`totalVisibleMs`, `viewId`, `attempts`, `data`)
  describing a view attempt.
- **View Tracking Payload**: Normalized component payload emitted to `trackView`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: View tracking tests confirm qualifying visibility cycles emit one initial view event
  after dwell, periodic duration updates while visible, and one final update on visibility end.
- **SC-002**: Option tests confirm observer-level settings plus per-element and dataset interval
  overrides control callback timing as configured.
- **SC-003**: Reconciliation tests confirm `setAuto`, `enableElement`, `disableElement`, and
  `clearElement` produce expected observation behavior.
- **SC-004**: Lifecycle tests confirm pause/resume behavior across page visibility changes, prevent
  duplicate concurrent callback attempts, emit deferred final callbacks after in-flight settle, and
  release state on unobserve/disconnect/orphan sweep.
- **SC-005**: View override tests confirm `data-ctfl-track-views='false'` suppresses observation and
  `data-ctfl-track-views='true'` can force-enable observation when global auto mode is off.
- **SC-006**: Sticky-view tests confirm sticky is emitted until first successful personalization
  response per element, retried after undefined/failed responses, and deduped independently across
  separately rendered elements.
