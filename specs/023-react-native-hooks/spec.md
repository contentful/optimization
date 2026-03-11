# Feature Specification: Optimization React Native Hooks

**Feature Branch**: `[023-react-native-hooks]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Track Component Views from Viewport Visibility (Priority: P1)

As an SDK consumer, I need a hook that tracks when a Contentful entry stays sufficiently visible for
a configured dwell time so component view analytics can be emitted automatically with accumulated
duration tracking.

**Why this priority**: Automatic visibility-based component tracking is core package behavior.

**Independent Test**: Attach `useViewportTracking` to a view, simulate layout + viewport updates,
and verify `trackComponentView` dispatch when threshold and dwell requirements are met, including
periodic updates while visible and a final event on visibility end.

**Acceptance Scenarios**:

1. **Given** an entry becomes visible above threshold, **When** it remains visible for `viewTimeMs`,
   **Then** an initial `trackComponentView` event is dispatched with accumulated `viewDurationMs`.
2. **Given** an entry remains visible after the initial event, **When** each
   `viewDurationUpdateIntervalMs` elapses, **Then** one additional component view event is
   dispatched with an increased `viewDurationMs`.
3. **Given** an entry that already emitted at least one view event, **When** it leaves threshold
   visibility, **Then** one final component view event is dispatched for that visibility cycle.
4. **Given** a visibility cycle that ends before dwell threshold is reached, **When** threshold
   visibility stops, **Then** no component view event is dispatched for that cycle.
5. **Given** a single visibility cycle, **When** initial, periodic, and final events are emitted,
   **Then** all events reuse the same `componentViewId`.
6. **Given** an entry becomes invisible before dwell timeout completes, **When** visibility drops,
   **Then** pending timer is cancelled and cycle state is reset.
7. **Given** component unmount during an active visibility cycle with at least one emitted event,
   **When** cleanup runs, **Then** a final event is emitted and active timers are cleared.

---

### User Story 2 - Resolve Visibility Across Scroll and Non-Scroll Layouts (Priority: P1)

As a component maintainer, I need viewport calculations to work both inside and outside
`OptimizationScrollProvider` so tracking can run in scrollable and fixed layouts.

**Why this priority**: Tracking must adapt to different screen structures without extra logic.

**Independent Test**: Run `useViewportTracking` with and without `OptimizationScrollProvider`
context and verify viewport calculations and metadata extraction.

**Acceptance Scenarios**:

1. **Given** `OptimizationScrollProvider` context exists, **When** visibility checks run, **Then**
   calculations use context `scrollY` and `viewportHeight`.
2. **Given** no scroll context, **When** visibility checks run, **Then** calculations use screen
   dimensions and update on dimension changes.
3. **Given** personalization metadata is provided, **When** tracking metadata is derived, **Then**
   `componentId`, `experienceId`, and `variantIndex` reflect personalization mapping.

---

### User Story 2b - Maintain Deterministic View Lifecycle Under App State Changes (Priority: P1)

As a mobile app developer, I need view tracking to pause/resume correctly when the app moves to the
background and foreground so duration measurements remain accurate.

**Why this priority**: Mobile apps frequently background; duration accuracy depends on correct
pause/resume behavior.

**Independent Test**: Simulate AppState transitions during active visibility cycles and verify
accumulation pauses, final events fire on background, and accumulation resumes on foreground.

**Acceptance Scenarios**:

1. **Given** a visible component accumulating dwell time, **When** the app moves to background,
   **Then** accumulation pauses and a final event is emitted if at least one event was already sent.
2. **Given** an app that returns to foreground, **When** the component is still visible, **Then**
   accumulation resumes from where it left off.
3. **Given** an app that backgrounds before the dwell threshold is reached, **When** background
   occurs, **Then** no event is emitted and the cycle state is reset.

---

### User Story 3 - Track Screens Automatically or Manually (Priority: P2)

As a screen developer, I need a hook that can auto-track screen views on mount and also expose
manual tracking so I can align screen events with lifecycle/data loading constraints.

**Why this priority**: Screen analytics flexibility is required across navigation patterns.

**Independent Test**: Use `useScreenTracking` with both `trackOnMount=true` and `false`, invoke
`trackScreen`, and verify success/error return behavior.

**Acceptance Scenarios**:

1. **Given** `trackOnMount=true`, **When** hook mounts and has not tracked yet, **Then** it triggers
   one automatic screen event.
2. **Given** `trackOnMount=false`, **When** `trackScreen()` is called, **Then** SDK `screen(...)` is
   invoked with current name/properties.
3. **Given** SDK screen call throws, **When** `trackScreen()` resolves, **Then** it logs an error
   and returns `undefined`.

---

### Edge Cases

- Visibility checks should no-op until both element layout dimensions and non-zero viewport height
  are available.
- Dimension listener cleanup must run on unmount.
- `useViewportTracking` emits multiple view events within a single visibility cycle: one initial
  event after the dwell threshold, periodic updates at `viewDurationUpdateIntervalMs`, and one final
  event when visibility ends.
- Across repeated visible/invisible cycles, each cycle generates a fresh `componentViewId`.
- `componentViewId` is generated per visibility cycle, reused for all events in that cycle, and
  replaced on the next visibility cycle.
- `viewDurationMs` is emitted as rounded non-negative milliseconds derived from accumulated visible
  time, not the configured dwell threshold.
- Dwell accumulation resets when a visibility cycle ends (no cross-cycle accumulation).
- AppState transitions to `background` or `inactive` MUST pause time accumulation and emit a final
  event if at least one event was already emitted in the current cycle.
- AppState transition to `active` MUST resume accumulation if the component is still visible.
- On unmount during an active cycle with at least one emitted event, a final event MUST be emitted.
- `useViewportTracking.isVisible` is ref-backed and does not itself trigger re-render updates.
- `useScreenTracking` stores `name`/`properties` in refs for stable callback identity.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `useViewportTracking` MUST require an `entry` input and MAY accept optional
  `personalization`, `threshold`, `viewTimeMs`, and `viewDurationUpdateIntervalMs`.
- **FR-002**: `useViewportTracking` MUST default `threshold` to `0.8`, `viewTimeMs` to `2000`, and
  `viewDurationUpdateIntervalMs` to `5000`.
- **FR-003**: `useViewportTracking` MUST derive tracking metadata from entry/personalization data.
- **FR-004**: With personalization input, metadata extraction MUST attempt to resolve `componentId`
  from `personalization.variants` mapping and fall back to `entry.sys.id` when unmatched.
- **FR-005**: Without personalization input, metadata extraction MUST set
  `componentId=entry.sys.id`, `experienceId=undefined`, and `variantIndex=0`.
- **FR-006**: `useViewportTracking` MUST read `scrollY`/`viewportHeight` from `useScrollContext()`
  when available.
- **FR-007**: Without scroll context, `useViewportTracking` MUST use window height from
  `Dimensions.get('window')` and subscribe to dimension change events.
- **FR-008**: `useViewportTracking` MUST expose an `onLayout` handler that stores element layout
  dimensions and triggers immediate visibility evaluation.
- **FR-009**: Visibility evaluation MUST compute intersection ratio between element bounds and
  viewport bounds.
- **FR-010**: On transition from invisible to visible-above-threshold, hook MUST start a new
  visibility cycle with a fresh `componentViewId` and begin accumulating visible time.
- **FR-011**: On transition from visible to below-threshold, hook MUST cancel pending fire timer and
  emit a final event if at least one event was already emitted in the cycle. If no events were
  emitted, the cycle MUST be reset silently.
- **FR-012**: When accumulated visible time reaches the dwell threshold (`viewTimeMs`), hook MUST
  call `optimization.trackComponentView` with derived metadata including real accumulated
  `viewDurationMs`.
- **FR-012a**: After the initial event, hook MUST continue scheduling periodic events at
  `viewDurationUpdateIntervalMs` intervals while the component remains visible.
- **FR-012b**: The next-fire schedule MUST follow:
  `requiredMs = viewTimeMs + attempts * viewDurationUpdateIntervalMs`.
- **FR-013**: `useViewportTracking` MUST re-check visibility whenever scroll position or viewport
  height changes.
- **FR-014**: `useViewportTracking` MUST clear active timers on unmount and emit a final event if
  the component is mid-cycle with at least one event already emitted.
- **FR-014a**: `useViewportTracking` MUST listen to `AppState` changes. On `background`/`inactive`,
  it MUST pause accumulation and emit a final event if applicable. On `active`, it MUST resume
  accumulation if the component is still visible.
- **FR-015**: `useViewportTracking` MUST return `{ isVisible, onLayout }`.
- **FR-016**: `useScreenTracking` MUST accept `{ name, properties?, trackOnMount? }` options.
- **FR-017**: `useScreenTracking` MUST default `properties` to an empty object.
- **FR-018**: `useScreenTracking` MUST default `trackOnMount` to `true`.
- **FR-019**: `useScreenTracking.trackScreen()` MUST call
  `optimization.screen({ name, properties })`.
- **FR-020**: `trackScreen()` MUST return optimization data on success and `undefined` on failure.
- **FR-021**: `trackScreen()` failures MUST be logged.
- **FR-022**: `useScreenTracking` MUST avoid duplicate auto-tracking within the same mount cycle by
  using an internal "has tracked" guard.

### Key Entities _(include if feature involves data)_

- **Viewport Tracking Metadata**: `{ componentId, experienceId?, variantIndex }` payload for
  component-view analytics.
- **Viewport Geometry State**: Element layout + viewport bounds used to compute visibility ratio.
- **View Cycle State**: Per-cycle mutable state including `componentViewId`, `visibleSince`
  timestamp, `accumulatedMs` total visible duration, and `attempts` event emission count.
- **Screen Tracking Contract**: Hook return API and behavior for automatic/manual screen events.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Visibility tests confirm initial `trackComponentView` fires only after threshold and
  accumulated dwell criteria are met with real `viewDurationMs`.
- **SC-001a**: Periodic event tests confirm additional events fire at `viewDurationUpdateIntervalMs`
  intervals while visible, with increasing `viewDurationMs`.
- **SC-001b**: Final event tests confirm one final event fires when visibility ends after at least
  one event was emitted, and no event fires when visibility ends before dwell threshold.
- **SC-001c**: `componentViewId` tests confirm stability within a cycle and uniqueness across
  cycles.
- **SC-002**: Scroll/non-scroll tests confirm viewport calculations remain correct in both layout
  modes.
- **SC-003**: Cleanup tests confirm timers and dimension listeners are removed on unmount and a
  final event is emitted when applicable.
- **SC-003a**: AppState tests confirm pause/resume behavior and final event emission on background.
- **SC-004**: Screen tracking tests confirm auto/manual behavior and failure-path return semantics.
