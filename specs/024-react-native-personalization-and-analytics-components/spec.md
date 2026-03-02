# Feature Specification: Optimization React Native Personalization and Analytics Components

**Feature Branch**: `[024-react-native-personalization-and-analytics-components]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Render Personalized Entries and Track Their Views (Priority: P1)

As an app developer, I need a component that resolves personalized entry variants and tracks
component views so personalized content rendering and analytics are coupled by default.

**Why this priority**: Personalization rendering is a primary value path of the package.

**Independent Test**: Render `Personalization` with a baseline entry, drive personalization state
updates, and verify resolved entry rendering plus viewport tracking integration.

**Acceptance Scenarios**:

1. **Given** a baseline entry with matching personalization data, **When** component resolves,
   **Then** render prop receives resolved variant entry.
2. **Given** no applicable personalization, **When** component resolves, **Then** render prop
   receives baseline entry.
3. **Given** resolved entry is visible per tracking thresholds, **When** dwell criteria are met,
   **Then** component view tracking is dispatched through viewport hook integration.

---

### User Story 2 - Control Live-Update vs Locking Behavior for Personalization (Priority: P1)

As a product owner, I need predictable control over whether personalized components update live or
lock to first resolved value so UI stability can be tuned per screen and preview workflows.

**Why this priority**: Live-update policy directly affects runtime UX and preview workflows.

**Independent Test**: Exercise combinations of preview-panel visibility, global liveUpdates, and
per-component `liveUpdates` prop; verify update vs lock behavior.

**Acceptance Scenarios**:

1. **Given** preview panel is visible, **When** personalization state updates, **Then** component
   uses live updates regardless of other settings.
2. **Given** preview panel is hidden and component `liveUpdates` is defined, **When** state updates,
   **Then** component-level setting overrides global setting.
3. **Given** live updates are disabled, **When** first non-undefined personalizations value is
   received, **Then** component locks to that value and ignores subsequent updates.

---

### User Story 3 - Track Non-Personalized Components and Navigation Screens (Priority: P2)

As an analytics integrator, I need dedicated helpers for non-personalized entry tracking and
navigation-driven screen tracking so I can instrument both component and screen events with minimal
boilerplate.

**Why this priority**: Analytics parity requires both component-level and navigation-level coverage.

**Independent Test**: Render `Analytics` and `OptimizationNavigationContainer`, simulate visibility
and route changes, and verify expected tracking payloads.

**Acceptance Scenarios**:

1. **Given** an `Analytics` component with entry data, **When** visibility thresholds are met,
   **Then** component view tracking fires with baseline metadata.
2. **Given** navigation container becomes ready with current route, **When** ready callback runs,
   **Then** initial screen event is tracked.
3. **Given** route changes to a different name, **When** state change callback runs, **Then** a new
   screen event is tracked and user callback is invoked afterwards.

---

### Edge Cases

- `Personalization` subscribes to personalization state updates and must unsubscribe on unmount.
- When live updates are disabled, components must ignore updates until first non-undefined
  personalizations value is captured, then remain locked.
- `Analytics` and `Personalization` rely on `useViewportTracking`; usage outside provider boundaries
  inherits provider-related hook constraints.
- `OptimizationNavigationContainer` includes route params only when `includeParams=true` and params
  are provided.
- Route params are JSON-coerced through `JSON.parse(JSON.stringify(...))` + schema parsing and may
  throw for non-serializable payloads.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `Personalization` MUST accept `baselineEntry`, render-prop `children`, and optional
  tracking/live-update props.
- **FR-002**: `Personalization` MUST compute `shouldLiveUpdate` using this priority order:
  preview-panel visibility, component `liveUpdates` prop, global live updates context, default
  `false`.
- **FR-003**: `Personalization` MUST subscribe to `optimization.states.personalizations`.
- **FR-004**: When `shouldLiveUpdate` is true, subscription updates MUST always replace local
  personalization state.
- **FR-005**: When `shouldLiveUpdate` is false, component MUST lock on first non-undefined
  personalization value and ignore later updates.
- **FR-006**: `Personalization` MUST unsubscribe from personalization state updates on unmount.
- **FR-007**: `Personalization` MUST resolve display content via
  `optimization.personalization.personalizeEntry(baselineEntry, lockedPersonalizations)`.
- **FR-008**: `Personalization` MUST pass resolved entry and resolved personalization metadata to
  `useViewportTracking`.
- **FR-009**: `Personalization` MUST render `children(resolvedEntry)` inside a wrapper `View`
  carrying `onLayout`, optional `style`, and optional `testID`.
- **FR-010**: `Analytics` MUST accept a non-personalized `entry`, `children`, and optional tracking
  props.
- **FR-011**: `Analytics` MUST invoke `useViewportTracking` with `{ entry, threshold, viewTimeMs }`
  (without personalization metadata).
- **FR-012**: `Analytics` MUST render `children` inside a wrapper `View` carrying `onLayout`,
  optional `style`, and optional `testID`.
- **FR-013**: `OptimizationNavigationContainer` MUST use a render-prop child API that provides
  `ref`, `onReady`, and `onStateChange` handlers.
- **FR-014**: On `onReady`, container MUST track the current route if available and then invoke user
  `onReady` callback.
- **FR-015**: On `onStateChange`, container MUST track only when current route name differs from
  previously tracked route name.
- **FR-016**: On each state change, container MUST update stored current route name.
- **FR-017**: `OptimizationNavigationContainer` MUST invoke user `onStateChange` callback after
  internal tracking logic.
- **FR-018**: `OptimizationNavigationContainer` MUST default `includeParams` to `false`.
- **FR-019**: When `includeParams=true` and route params exist, screen tracking MUST include
  `properties.params` as JSON-safe data.
- **FR-020**: Screen tracking payload from navigation container MUST call `optimization.screen` with
  `{ name, properties, screen: { name } }`.

### Key Entities _(include if feature involves data)_

- **Personalization Component State**: Local locked/live personalization snapshot used for entry
  resolution.
- **Resolved Personalization Output**: `{ entry, personalization }` tuple from
  `personalizeEntry(...)` consumed by rendering and tracking.
- **Analytics Component Contract**: Non-personalized entry wrapper for viewport-triggered component
  view analytics.
- **Navigation Tracking State**: Previous/current route name refs used to suppress duplicate screen
  events.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Personalization tests confirm resolved entry rendering and subscription cleanup.
- **SC-002**: Live-updates tests confirm precedence behavior (preview > component prop > global >
  default lock).
- **SC-003**: Analytics component tests confirm viewport-based tracking wiring for non-personalized
  entries.
- **SC-004**: Navigation tests confirm initial screen tracking, route-change tracking order, and
  duplicate suppression by route name comparison.
