# Feature Specification: Contentful Optimization Web Automatic Entry Hover Tracking

**Feature Branch**: `[027-web-automatic-hover-tracking]`  
**Created**: 2026-03-03  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Track Entry Hovers with Dwell and Periodic Duration Updates (Priority: P1)

As a Web SDK consumer, I need entry hover events emitted automatically after a dwell threshold, then
updated periodically while hover continues, so entry hover tracking is collected without manual
event wiring.

**Why this priority**: Hover interaction tracking is a core automatic interaction type alongside
entry view and click tracking.

**Independent Test**: Start hover tracking, trigger natural hover enter/leave on tracked entries,
and assert `trackHover` dispatch timing plus duration updates.

**Acceptance Scenarios**:

1. **Given** an observed entry element, **When** hover remains active through dwell threshold,
   **Then** exactly one initial entry hover event (`component_hover`) is dispatched.
2. **Given** a hovered entry element after the first event, **When** each update interval elapses
   and hover is still active, **Then** one additional entry hover event (`component_hover`) is
   dispatched with an increased `hoverDurationMs`.
3. **Given** a hovered entry element that already emitted at least one hover event, **When** hover
   ends, **Then** one final entry hover event (`component_hover`) is dispatched for that hover
   cycle.
4. **Given** a hover cycle that ends before dwell threshold is reached, **When** hover stops,
   **Then** no entry hover event (`component_hover`) is dispatched.
5. **Given** a single hover cycle, **When** initial, periodic, and final events are emitted,
   **Then** all events reuse the same `hoverId`.

---

### User Story 2 - Reconcile Auto-Tracking with Manual and Attribute Overrides (Priority: P1)

As an SDK integrator, I need hover auto-tracking to work with manual overrides and per-element
dataset flags/options so hover behavior can be controlled without forking runtime logic.

**Why this priority**: Real integrations need element-level force-enable/disable and tuning while
preserving default auto-discovery behavior.

**Independent Test**: Apply `setAuto`, `enableElement`, `disableElement`, and `clearElement`
combinations with `data-ctfl-track-hovers` and interval attributes, then verify observation and
dispatch behavior.

**Acceptance Scenarios**:

1. **Given** an auto-tracked entry with `data-ctfl-track-hovers='false'`, **When** it is hovered,
   **Then** no hover event is dispatched.
2. **Given** global hover auto-tracking disabled and an auto-discovered entry with
   `data-ctfl-track-hovers='true'`, **When** it is hovered through dwell, **Then** one hover event
   is dispatched.
3. **Given** an auto-tracked entry and a manual disabled override, **When** it is hovered, **Then**
   no hover event is dispatched.
4. **Given** a manually enabled element override with explicit `data`, **When** it is hovered
   through dwell, **Then** dispatch payload resolution uses override `data`.
5. **Given** an auto-tracked entry with `data-ctfl-hover-duration-update-interval-ms`, **When** it
   remains hovered, **Then** periodic update cadence follows the parsed attribute value.

---

### User Story 3 - Preserve Deterministic Hover Lifecycle and Runtime Safety (Priority: P2)

As an SDK maintainer, I need deterministic hover lifecycle handling across page visibility changes,
in-flight callbacks, and teardown/orphan cleanup so hover tracking remains stable in dynamic DOM
conditions.

**Why this priority**: Hover timing and DOM lifecycle are sensitive to subtle race and cleanup
regressions.

**Independent Test**: Simulate hidden/visible transitions, in-flight callback windows, touch pointer
events, `unobserve`/`disconnect`, and orphaned states.

**Acceptance Scenarios**:

1. **Given** a hovered element accumulating dwell, **When** the page becomes hidden and later
   visible, **Then** dwell resumes from remaining time and does not fire while hidden.
2. **Given** an in-flight hover callback, **When** additional update boundaries occur, **Then**
   duplicate concurrent callback attempts are not started.
3. **Given** hover end occurs while callback is in flight after first emission, **When** the
   callback settles, **Then** a deferred final hover event is emitted once.
4. **Given** pointer events are supported and pointer type is touch, **When** `pointerenter`/leave
   occurs, **Then** no hover tracking cycle is started.
5. **Given** `unobserve` or `disconnect` is called, **When** timers/listeners are cleaned up,
   **Then** no further hover callbacks are emitted for those states.

---

### Edge Cases

- Observer defaults are `dwellTimeMs: 1000` and `hoverDurationUpdateIntervalMs: 5000`.
- Per-element options support `dwellTimeMs`, `hoverDurationUpdateIntervalMs`, and callback `data`.
- Per-element attribute override supports `data-ctfl-hover-duration-update-interval-ms`; values must
  parse to finite non-negative numbers or be ignored.
- `setAuto(false)` disables observation for auto-discovered entries unless force-enabled by manual
  override or `data-ctfl-track-hovers='true'`.
- `disableElement` must suppress hover observation even when auto-tracking is enabled.
- `clearElement` must remove only manual override state and return element eligibility to
  attribute/auto rules.
- `data-ctfl-track-hovers` supports per-element hover override for auto-discovered entries where
  only case-insensitive `'true'` and `'false'` are recognized.
- Manual `enableElement`/`disableElement` overrides must take precedence over
  `data-ctfl-track-hovers`; after `clearElement`, eligibility falls back to `data-ctfl-track-hovers`
  first, then auto-tracking state.
- Touch pointer hover events (`pointerType='touch'`) are not considered natural hover and must be
  ignored.
- Pointer event listeners (`pointerenter`/`pointerleave`/`pointercancel`) are preferred when
  supported; otherwise mouse listeners (`mouseenter`/`mouseleave`) are used.
- `hoverId` must be generated per hover cycle, reused for all events in that cycle, and replaced on
  the next hover cycle.
- `hoverDurationMs` must be emitted as rounded non-negative milliseconds derived from accumulated
  hover time.
- If payload resolution fails (no valid entry metadata), hover dispatch must be skipped.
- Callback failures are logged and must not permanently disable subsequent periodic updates while
  the element remains hovered.
- `disconnect()` must clear timers, active state, visibility listeners, and orphan sweeper interval.
- Orphaned/detached element states must be swept periodically and on visibility transitions.
- Non-DOM environments must short-circuit listener registration safely.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `createEntryHoverDetector(core)` MUST produce an interaction detector with
  `start/stop/setAuto/onEntryAdded/onEntryRemoved/enableElement/disableElement/clearElement`
  handlers backed by `ElementHoverObserver`.
- **FR-002**: Detector `start(options)` MUST create a new `ElementHoverObserver` using provided
  start options and a callback that bridges to `core.trackHover`.
- **FR-003**: Detector `stop()` MUST disconnect the active `ElementHoverObserver` and clear
  auto-tracked, attribute-override, and manual-override element state.
- **FR-004**: Detector `setAuto(enabled)` MUST control whether auto-discovered entries are observed
  and MUST reconcile current candidate elements.
- **FR-005**: Detector `onEntryAdded(element)` MUST mark the element auto-tracked, resolve optional
  attribute override state (`ctflTrackHovers`, `ctflHoverDurationUpdateIntervalMs`), and reconcile
  observation.
- **FR-006**: Detector `onEntryRemoved(element)` MUST remove auto-tracked and attribute override
  state for that element and reconcile observation.
- **FR-007**: Detector `enableElement(element, options)` MUST set an enabled override with options
  and reconcile observation; when replacing an existing enabled override, it MUST unobserve before
  re-observing with new options.
- **FR-008**: Detector `disableElement(element)` MUST set a disabled override and reconcile to
  unobserve that element.
- **FR-009**: Detector `clearElement(element)` MUST remove manual override state and reconcile
  observation using attribute/auto rules.
- **FR-010**: Hover observation eligibility precedence MUST be manual enable/disable override first,
  then `ctflTrackHovers` dataset override, then `setAuto(enabled)` + auto-tracked membership.
- **FR-011**: Auto-tracking callback MUST resolve payload via
  `resolveTrackingPayload(info.data, element)` and MUST call `core.trackHover` only when payload
  resolution succeeds.
- **FR-012**: Hover dispatch payload MUST include `hoverId` from callback info and `hoverDurationMs`
  as `Math.max(0, Math.round(totalHoverMs))`.
- **FR-013**: `ElementHoverObserver` MUST initialize effective observer options with defaults for
  `dwellTimeMs` and `hoverDurationUpdateIntervalMs`, sanitizing to non-negative values.
- **FR-014**: `observe(element, options)` MUST create per-element state once, attach hover
  listeners, store WeakRef/strong-ref fallback references, and update per-element options/data on
  subsequent `observe` calls.
- **FR-015**: Hover listener wiring MUST use pointer listeners when Pointer Events are available and
  MUST otherwise use mouse listeners.
- **FR-016**: Hover cycle start MUST be ignored for non-natural pointer events
  (`pointerType='touch'`).
- **FR-017**: Hover start for a new cycle MUST reset accumulated timing state, clear pending final
  state, assign a new UUID `hoverId`, and schedule dwell when page visibility is active.
- **FR-018**: Fire scheduling MUST compute remaining time from
  `dwellTimeMs + attempts * hoverDurationUpdateIntervalMs`, trigger immediately when remaining time
  is `<= 0`, and otherwise schedule a timeout for the remaining duration.
- **FR-019**: Callback execution MUST be coalesced per element (`inFlight` guard), increment
  `attempts`, and invoke callback info `{ totalHoverMs, hoverId, attempts, data }`.
- **FR-020**: While hover remains active and visible after first emission, observer MUST continue
  scheduling periodic callbacks at the configured hover update interval.
- **FR-021**: Hover end before first callback attempt MUST reset cycle state without dispatching a
  final event.
- **FR-022**: Hover end after first callback attempt MUST emit one final callback immediately, or
  defer that final callback until the in-flight attempt settles.
- **FR-023**: Page visibility changes to hidden MUST pause active hover timing and clear pending
  fire timers; visibility changes to visible MUST resume eligible hover cycles from remaining time.
- **FR-024**: Callback settle behavior MUST reset ended hover cycles and continue scheduling for
  still-hovered cycles; callback failures MUST be logged and MUST NOT permanently stop future
  periodic attempts while hover remains active.
- **FR-025**: `unobserve(element)` MUST detach hover listeners, clear pending timers, mark state
  done, remove active tracking state, and stop orphan sweeping when no active states remain.
- **FR-026**: `disconnect()` MUST detach listeners for all active states, clear timers, mark states
  done, clear active state tracking, remove visibility listener, and stop orphan sweeping.
- **FR-027**: Orphan sweeping MUST run on interval while active states exist, detect dropped
  references/disconnected elements, finalize those states, and stop sweeping when no active states
  remain.
- **FR-028**: `onEntryAdded(element)` MUST interpret `dataset.ctflTrackHovers` where only
  case-insensitive `'true'` and `'false'` are valid overrides.
- **FR-029**: Auto-tracked entry attribute option parsing for
  `dataset.ctflHoverDurationUpdateIntervalMs` MUST accept only finite non-negative numeric values.

### Key Entities _(include if feature involves data)_

- **Entry Hover Detector**: Interaction detector that reconciles auto-tracked entries, manual
  overrides, and attribute overrides into `ElementHoverObserver` observe/unobserve operations.
- **ElementHoverObserver**: Hover dwell runtime that handles enter/leave lifecycle, periodic update
  scheduling, visibility pause/resume, and orphan cleanup.
- **ElementHoverCallbackInfo**: Callback metadata (`totalHoverMs`, `hoverId`, `attempts`, `data`)
  describing a hover attempt.
- **Hover Tracking Payload**: Normalized entry-tracking payload emitted to `trackHover` with
  `hoverId` and `hoverDurationMs`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Hover tracking tests confirm qualifying hover cycles emit one initial event after
  dwell, periodic duration updates at configured intervals, and one final update on hover end.
- **SC-002**: Identifier tests confirm each hover cycle uses a stable `hoverId` across emitted
  updates and assigns a new ID for the next cycle.
- **SC-003**: Override tests confirm `setAuto`, `enableElement`, `disableElement`, and
  `clearElement` reconcile as expected with `data-ctfl-track-hovers` and manual options.
- **SC-004**: Option tests confirm observer-level and per-element hover update intervals control
  periodic callback timing, including `data-ctfl-hover-duration-update-interval-ms`.
- **SC-005**: Lifecycle tests confirm hidden-page pause/resume behavior, in-flight callback
  coalescing, touch-pointer suppression, and teardown/orphan cleanup prevent leaks and duplicate
  emissions.
