# Feature Specification: Optimization React Native Hooks

**Feature Branch**: `[023-react-native-hooks]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Emit View Events from Viewport Visibility Cycles (Priority: P1)

As an SDK consumer, I need `useViewportTracking` to emit component view events when a Contentful
entry is visible long enough and to continue updating duration while visible.

**Why this priority**: Visibility-driven component analytics is a core behavior path.

**Independent Test**: Attach `useViewportTracking` to a view, simulate layout/viewport updates, and
verify initial, periodic, and final event behavior.

**Acceptance Scenarios**:

1. **Given** an entry becomes visible above threshold, **When** accumulated visible time reaches
   `viewTimeMs`, **Then** one `trackView` event is emitted with accumulated `viewDurationMs`.
2. **Given** the entry remains visible after initial emission, **When** each
   `viewDurationUpdateIntervalMs` elapses, **Then** additional `trackView` events are emitted with
   increased `viewDurationMs`.
3. **Given** at least one event was emitted in the current visibility cycle, **When** visibility
   drops below threshold, **Then** one final `trackView` event is emitted and cycle state resets.
4. **Given** visibility ends before first dwell threshold is met, **When** cycle ends, **Then** no
   `trackView` event is emitted for that cycle.
5. **Given** one visibility cycle, **When** multiple events are emitted, **Then** all events use the
   same `viewId`.
6. **Given** visibility transitions into a new cycle, **When** a new cycle starts, **Then** a fresh
   `viewId` is generated.
7. **Given** sticky personalization metadata, **When** `trackView` returns personalization data for
   a rendered hook instance, **Then** later emissions for that same instance omit `sticky`.
8. **Given** sticky personalization metadata, **When** a `trackView` attempt resolves `undefined` or
   throws, **Then** later emissions for that same instance continue sending `sticky` until a
   successful personalization response is returned.
9. **Given** two rendered hook instances with the same tracking metadata, **When** each instance
   emits its first sticky view event, **Then** each event includes `sticky` independently.

---

### User Story 2 - Resolve Visibility Across Scroll Context, Screen Dimensions, and App State (Priority: P1)

As a component maintainer, I need visibility checks to work inside/outside scroll context and to
handle app background/foreground transitions safely.

**Why this priority**: Mobile viewport conditions vary across layouts and app lifecycle transitions.

**Independent Test**: Run `useViewportTracking` with/without `OptimizationScrollProvider`, simulate
AppState transitions, and verify visibility-cycle behavior.

**Acceptance Scenarios**:

1. **Given** scroll context exists, **When** checks run, **Then** `scrollY` and `viewportHeight`
   come from context values.
2. **Given** no scroll context, **When** checks run, **Then** viewport height comes from
   `Dimensions.get('window').height` and updates via dimension change subscription.
3. **Given** app moves to `background` or `inactive`, **When** the hook handles AppState change,
   **Then** active timers are cleared, accumulation is paused, and final event emission occurs only
   if at least one event was already sent in the current cycle.
4. **Given** app returns to `active`, **When** dimensions are known, **Then** visibility is
   re-evaluated and a new cycle may start if currently visible.
5. **Given** tracking is disabled (`enabled=false`), **When** visibility changes, **Then** no view
   events are emitted.

---

### User Story 3 - Track Taps and Screens with Hook-Based APIs (Priority: P2)

As an analytics integrator, I need hooks for component tap tracking and screen tracking (auto,
manual, and callback-based) so I can instrument interactions with minimal boilerplate.

**Why this priority**: Hook-level analytics primitives are required by higher-level components.

**Independent Test**: Exercise `useTapTracking`, `useScreenTracking`, and
`useScreenTrackingCallback` with success/error and enable/disable paths.

**Acceptance Scenarios**:

1. **Given** `useTapTracking` is enabled and touch movement is below threshold, **When** touch end
   occurs, **Then** `trackClick` is invoked and optional `onTap(entry)` callback runs.
2. **Given** tap tracking is disabled, **When** hook is used, **Then** `onTouchStart` and
   `onTouchEnd` handlers are `undefined`.
3. **Given** `useScreenTracking` with default options, **When** hook mounts, **Then** one automatic
   screen event is attempted.
4. **Given** `useScreenTracking` manual usage (`trackOnMount=false`), **When** `trackScreen()` is
   called, **Then** SDK `screen({ name, properties, screen: { name } })` is invoked.
5. **Given** SDK `screen(...)` throws in `trackScreen()`, **When** promise resolves, **Then** hook
   logs the error and returns `undefined`.
6. **Given** `useScreenTrackingCallback`, **When** returned callback is invoked, **Then** SDK
   `screen({ name, properties, screen: { name } })` is fired-and-forgotten.

---

### Edge Cases

- Visibility checks no-op until both layout dimensions exist and viewport height is non-zero.
- `isVisible` is ref-backed and returned as a non-reactive snapshot (`useViewportTracking` does not
  trigger rerenders on visibility changes).
- `viewDurationMs` is emitted as rounded, non-negative, accumulated visible time.
- Sticky view emission is guarded per hook instance so only one sticky `trackView` request is
  in-flight at a time.
- Sticky dedupe state is keyed by tracking identity (`componentId`, `experienceId`, `variantIndex`,
  `sticky`) and resets when that identity changes.
- `enabled=false` prevents cycle start/event emission but does not remove hook setup.
- `useTapTracking` classifies taps by movement distance `< 10` points.
- `useTapTracking` clears touch-start state on touch end regardless of outcome.
- `useScreenTracking` uses refs for `optimization`, `name`, and `properties` to keep callback
  identity stable.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `useViewportTracking` MUST require `entry` and MAY accept `personalization`,
  `threshold`, `viewTimeMs`, `enabled`, and `viewDurationUpdateIntervalMs`.
- **FR-002**: `useViewportTracking` MUST default `threshold=0.8`, `viewTimeMs=2000`, `enabled=true`,
  and `viewDurationUpdateIntervalMs=5000`.
- **FR-003**: `useViewportTracking` MUST derive metadata via `extractTrackingMetadata`.
- **FR-004**: With personalization, metadata extraction MUST resolve `componentId` from
  `personalization.variants` mapping to resolved entry ID, falling back to `entry.sys.id`; and MUST
  include `experienceId`/`variantIndex`/`sticky` from personalization.
- **FR-005**: Without personalization, metadata extraction MUST resolve
  `{ componentId: entry.sys.id, experienceId: undefined, variantIndex: 0, sticky: undefined }`.
- **FR-006**: `useViewportTracking` MUST subscribe to dimension changes and maintain fallback screen
  height.
- **FR-007**: When scroll context exists, visibility checks MUST use context `scrollY` and
  `viewportHeight`; otherwise MUST use `scrollY=0` and fallback screen height.
- **FR-008**: `useViewportTracking` MUST expose `onLayout` that stores `{ y, height }` and triggers
  immediate visibility evaluation.
- **FR-009**: Visibility evaluation MUST compute visible intersection ratio from element bounds and
  viewport bounds.
- **FR-010**: On invisible-to-visible transition with tracking enabled, hook MUST reset cycle state,
  assign a new `viewId`, set `visibleSince`, and schedule next fire.
- **FR-011**: Next-fire scheduling MUST use
  `requiredMs = viewTimeMs + attempts * viewDurationUpdateIntervalMs`.
- **FR-012**: Event emission MUST flush elapsed visible time, increment attempts, and call
  `optimization.trackView` with `componentId`, `viewId`, `experienceId`, `variantIndex`, rounded
  non-negative `viewDurationMs`, and `sticky` when sticky metadata is present and no successful
  sticky response has been observed for the current tracking identity.
- **FR-013**: On visible-to-invisible transition, hook MUST clear timer, pause accumulation, emit a
  final event only when attempts > 0, and reset cycle state.
- **FR-014**: Hook MUST re-check visibility whenever `scrollY` or `viewportHeight` dependencies
  change.
- **FR-015**: Hook MUST listen to AppState changes.
- **FR-016**: On AppState `background`/`inactive`, hook MUST clear timer and pause accumulation;
  when attempts > 0, hook MUST emit a final event, reset cycle state, and clear visibility flag.
- **FR-017**: On AppState `active` with known layout dimensions, hook MUST force a visibility
  re-check.
- **FR-018**: On unmount, hook MUST clear timers and emit a final event when current cycle has
  attempts > 0, then reset cycle state.
- **FR-019**: `useViewportTracking` MUST return `{ isVisible, onLayout }` where `isVisible` is the
  current ref-backed snapshot.
- **FR-020**: When a visibility cycle would start while `enabled=false`, `useViewportTracking` MUST
  skip cycle start and MUST NOT schedule `trackView` events for that transition.
- **FR-021**: `useTapTracking` MUST accept `entry`, optional `personalization`, `enabled`, and
  optional `onTap`.
- **FR-022**: `useTapTracking` MUST return undefined handlers when disabled.
- **FR-023**: `useTapTracking` MUST store `pageX/pageY` on touch start.
- **FR-024**: On touch end with a stored start point, `useTapTracking` MUST compute movement
  distance, clear stored start state, and treat distance `< 10` as a tap.
- **FR-025**: On detected tap, `useTapTracking` MUST call `optimization.trackClick` with
  `{ componentId, experienceId, variantIndex }` derived from entry/personalization metadata.
- **FR-026**: On detected tap and provided callback, `useTapTracking` MUST invoke `onTap(entry)`.
- **FR-027**: `useScreenTracking` MUST accept `{ name, properties?, trackOnMount? }`.
- **FR-028**: `useScreenTracking` MUST default `properties` to `{}` and `trackOnMount` to `true`.
- **FR-029**: `useScreenTracking.trackScreen()` MUST call
  `optimization.screen({ name, properties, screen: { name } })`.
- **FR-030**: `trackScreen()` MUST return optimization data on success.
- **FR-031**: `trackScreen()` MUST catch failures, log an error, and return `undefined`.
- **FR-032**: `useScreenTracking` MUST auto-trigger `trackScreen()` once per mount when
  `trackOnMount=true` and not yet tracked.
- **FR-033**: `useScreenTracking` MUST reset internal `hasTracked` flag when `name` changes.
- **FR-034**: `useScreenTrackingCallback` MUST return a stable callback
  `(name, properties?) => void`.
- **FR-035**: `useScreenTrackingCallback` MUST call
  `optimization.screen({ name, properties: properties ?? {}, screen: { name } })` without returning
  SDK result to caller.
- **FR-036**: For sticky metadata, `useViewportTracking` MUST treat a sticky attempt as successful
  only when `optimization.trackView` resolves with a defined value; `undefined` or failed attempts
  MUST remain eligible for sticky retry.
- **FR-037**: Sticky dedupe state MUST be scoped per rendered hook instance and MUST reset when the
  tracking identity (`componentId`, `experienceId`, `variantIndex`, `sticky`) changes.

### Key Entities _(include if feature involves data)_

- **Viewport Tracking Metadata**: `{ componentId, experienceId?, variantIndex, sticky? }` used for
  `trackView` and `trackClick` payloads.
- **View Cycle State**: Mutable cycle state (`viewId`, `visibleSince`, `accumulatedMs`, `attempts`)
  used for dwell and duration tracking.
- **Tap Gesture State**: Touch start coordinates used to classify tap vs drag/scroll movement.
- **Screen Tracking Contract**: Hook APIs for automatic/manual/dynamic screen event emission.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Viewport tests confirm initial/periodic/final event lifecycle, dwell behavior, and
  `viewId` stability within cycles.
- **SC-002**: Visibility-source tests confirm scroll-context and non-scroll fallback calculations,
  plus AppState transition handling.
- **SC-003**: Disabled-mode tests confirm `useViewportTracking(enabled=false)` emits no view events.
- **SC-004**: Tap tests confirm distance-threshold classification, metadata payload correctness, and
  disabled handler behavior.
- **SC-005**: Screen-hook tests confirm auto/manual tracking behavior and error-path return
  semantics.
- **SC-006**: Callback-hook tests confirm dynamic screen tracking callback payload format.
- **SC-007**: Sticky-view tests confirm per-instance sticky dedupe on successful personalization,
  sticky retry for undefined/failed responses, and identity-based dedupe reset.
