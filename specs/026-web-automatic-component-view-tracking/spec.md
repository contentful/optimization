# Feature Specification: Optimization Web Automatic Component View Tracking

**Feature Branch**: `[026-web-automatic-component-view-tracking]`  
**Created**: 2026-02-27  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in `@contentful/optimization-web`
package and derive SpecKit-compatible specifications."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Track Entry Component Views After Visibility Dwell (Priority: P1)

As a Web SDK consumer, I need component view events emitted automatically after tracked entry
elements remain visible long enough so component view analytics are collected without manual event
calls.

**Why this priority**: Automatic view tracking is a primary built-in interaction type for Web SDK
integrations.

**Independent Test**: Start the view detector, trigger intersections that satisfy dwell constraints,
and assert `trackComponentView` payload dispatch.

**Acceptance Scenarios**:

1. **Given** an auto-tracked entry element meeting intersection and dwell thresholds, **When** dwell
   completes, **Then** exactly one component view event is dispatched.
2. **Given** a manually observed element with explicit entry data, **When** dwell completes,
   **Then** explicit data is used to dispatch one component view event.
3. **Given** an element manually unobserved before dwell completion, **When** intersections
   continue, **Then** no component view event is dispatched.

---

### User Story 2 - Support Configurable Observer and Per-Element Dwell Options (Priority: P1)

As an SDK integrator, I need observer-level and per-element dwell configuration so view detection
can be tuned for application-specific UX timing.

**Why this priority**: Dwell thresholds and viewport rules differ across products and experiences.

**Independent Test**: Configure observer-level options and per-element overrides, then verify
callback timing and callback metadata.

**Acceptance Scenarios**:

1. **Given** observer-level options for dwell and visible ratio, **When** an element intersects
   below threshold, **Then** no callback is fired until threshold conditions are met.
2. **Given** a per-element dwell override, **When** the element becomes visible, **Then** callback
   timing follows the per-element dwell value rather than observer default.
3. **Given** per-element `data`, **When** callback is invoked, **Then** callback info includes that
   `data` alongside `totalVisibleMs` and `attempts`.

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
3. **Given** callback failure or element disconnect/drop, **When** lifecycle settles, **Then** state
   is finalized and element tracking is cleaned up without retry loops.

---

### Edge Cases

- Observer defaults are `dwellTimeMs: 1000`, `minVisibleRatio: 0.1`, `root: null`, and
  `rootMargin: '0px'`.
- Per-element options support `dwellTimeMs` and `data`; per-element `minVisibleRatio` is
  intentionally unsupported.
- Dwell accumulation resets when an element exits threshold visibility (no cross-cycle
  accumulation).
- Callback completion (success or failure) finalizes element state and auto-unobserves the element.
- `disconnect()` must remove all timers, active state, and page visibility listeners.
- Orphaned/detached element state must be swept periodically and on relevant lifecycle transitions.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `createEntryViewDetector(core)` MUST produce an interaction detector with
  `start/stop/onEntryAdded/onEntryRemoved/trackElement/untrackElement` handlers backed by
  `ElementViewObserver`.
- **FR-002**: Detector `start(options)` MUST create a new `ElementViewObserver` using provided start
  options and a callback that bridges to `core.trackComponentView`.
- **FR-003**: Detector `stop()` MUST disconnect the active `ElementViewObserver` and clear detector
  observer state.
- **FR-004**: Detector `onEntryAdded(element)` MUST auto-observe the element when the observer is
  active.
- **FR-005**: Detector `onEntryRemoved(element)` MUST unobserve the element when the observer is
  active.
- **FR-006**: Detector `trackElement(element, options)` MUST manually observe the element with
  per-element options; `untrackElement(element)` MUST manually unobserve it.
- **FR-007**: Auto-tracking callback MUST resolve payload via
  `resolveComponentTrackingPayload(info.data, element)` and MUST call `core.trackComponentView` only
  when payload resolution succeeds.
- **FR-008**: `ElementViewObserver` MUST initialize effective observer options with defaults and
  construct an `IntersectionObserver` with threshold `[0]` when `minVisibleRatio` is `0`, otherwise
  `[0, minVisibleRatio]`.
- **FR-009**: `observe(element, options)` MUST create per-element state once, apply per-element
  dwell override/data, store state with WeakRef fallback support, and begin observing the element.
- **FR-010**: `unobserve(element)` MUST clear pending timers, mark the element state as done, remove
  state from active tracking, and stop sweeper when no active states remain.
- **FR-011**: Intersections meeting visibility threshold MUST start or continue a visibility cycle;
  intersections outside threshold MUST reset cycle dwell and attempt counters.
- **FR-012**: Dwell scheduling MUST trigger callback immediately when remaining dwell time is `<= 0`
  and otherwise schedule callback for the remaining dwell duration.
- **FR-013**: Page visibility changes to hidden MUST pause active visibility cycles and clear
  pending fire timers; visibility changes to visible MUST resume eligible cycles from remaining
  dwell time.
- **FR-014**: Callback execution MUST be coalesced per element (`inFlight` guard), increment
  `attempts`, and pass callback info `{ totalVisibleMs, attempts, data }`.
- **FR-015**: Callback settle behavior (success or failure) MUST finalize the element and trigger
  auto-unobserve; failed callbacks MUST NOT schedule retries.
- **FR-016**: `disconnect()` MUST disconnect the intersection observer, clear timers and active
  states, remove visibility listeners, and stop the orphan sweeper interval.
- **FR-017**: Orphan sweeping MUST detect dropped references and disconnected elements, finalize
  those states, and stop sweeping when no active states remain.

### Key Entities _(include if feature involves data)_

- **Entry View Detector**: Interaction detector that maps registry events and manual controls to
  `ElementViewObserver` operations.
- **ElementViewObserver**: Intersection/dwell runtime maintaining per-element visibility state.
- **ElementViewCallbackInfo**: Callback metadata (`totalVisibleMs`, `attempts`, `data`) describing a
  view attempt.
- **View Tracking Payload**: Normalized component payload emitted to `trackComponentView`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: View tracking tests confirm qualifying entry intersections emit exactly one component
  view event per observed element.
- **SC-002**: Option tests confirm observer-level settings and per-element dwell overrides control
  callback timing as configured.
- **SC-003**: Lifecycle tests confirm pause/resume behavior across page visibility changes and
  prevent duplicate concurrent callback attempts.
- **SC-004**: Cleanup tests confirm unobserve/disconnect/orphan sweep paths release state and
  prevent further callback execution.
