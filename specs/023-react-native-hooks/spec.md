# Feature Specification: Optimization React Native Hooks

**Feature Branch**: `[023-react-native-hooks]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in
`@contentful/optimization-react-native` package and derive SpecKit-compatible specifications that
could have guided its development."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Track Component Views from Viewport Visibility (Priority: P1)

As an SDK consumer, I need a hook that tracks when a Contentful entry stays sufficiently visible for
a configured dwell time so component view analytics can be emitted automatically.

**Why this priority**: Automatic visibility-based component tracking is core package behavior.

**Independent Test**: Attach `useViewportTracking` to a view, simulate layout + viewport updates,
and verify `trackComponentView` dispatch when threshold and dwell requirements are met.

**Acceptance Scenarios**:

1. **Given** an entry becomes visible above threshold, **When** it remains visible for `viewTimeMs`,
   **Then** `analytics.trackComponentView` is called with derived tracking metadata.
2. **Given** an entry becomes invisible before dwell timeout completes, **When** visibility drops,
   **Then** pending timer is cancelled.
3. **Given** component unmount, **When** cleanup runs, **Then** active timers are cleared.

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
- `useViewportTracking` may emit multiple view events across repeated visible/invisible cycles
  because it is transition-based, not permanently one-shot.
- `useViewportTracking.isVisible` is ref-backed and does not itself trigger re-render updates.
- `useScreenTracking` stores `name`/`properties` in refs for stable callback identity.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `useViewportTracking` MUST require an `entry` input and MAY accept optional
  `personalization`, `threshold`, and `viewTimeMs`.
- **FR-002**: `useViewportTracking` MUST default `threshold` to `0.8` and `viewTimeMs` to `2000`.
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
- **FR-010**: On transition from invisible to visible-above-threshold, hook MUST start a dwell
  timer.
- **FR-011**: On transition from visible to below-threshold, hook MUST cancel pending dwell timer.
- **FR-012**: When dwell timer completes and element remains visible, hook MUST call
  `optimization.analytics.trackComponentView` with derived metadata.
- **FR-013**: `useViewportTracking` MUST re-check visibility whenever scroll position or viewport
  height changes.
- **FR-014**: `useViewportTracking` MUST clear active timers on unmount.
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
- **Dwell Timer State**: Timeout state controlling delayed tracking dispatch.
- **Screen Tracking Contract**: Hook return API and behavior for automatic/manual screen events.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Visibility tests confirm `trackComponentView` fires only after threshold and dwell
  criteria are met.
- **SC-002**: Scroll/non-scroll tests confirm viewport calculations remain correct in both layout
  modes.
- **SC-003**: Cleanup tests confirm timers and dimension listeners are removed on unmount.
- **SC-004**: Screen tracking tests confirm auto/manual behavior and failure-path return semantics.
