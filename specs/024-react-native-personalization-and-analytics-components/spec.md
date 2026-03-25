# Feature Specification: Optimization React Native Personalization and Analytics Components

**Feature Branch**: `[024-react-native-personalization-and-analytics-components]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resolve Optimized Content and Attach Interaction Tracking (Priority: P1)

As an app developer, I need `Personalization` to resolve baseline/variant content and attach view
and tap tracking handlers so rendering and analytics stay synchronized.

**Why this priority**: Optimized rendering and interaction tracking are the primary SDK value path.

**Independent Test**: Render `Personalization`, simulate personalization-state emissions, and verify
resolved entry output plus tracking-hook inputs.

**Acceptance Scenarios**:

1. **Given** a baseline entry and selected optimizations, **When** render resolves, **Then**
   `children` receives `contentfulOptimization.resolveOptimizedEntry(...).entry`.
2. **Given** no applicable personalization, **When** render resolves, **Then** baseline entry is
   rendered.
3. **Given** resolved entry/personalization metadata, **When** hooks are wired, **Then**
   `useViewportTracking` and `useTapTracking` receive resolved entry plus resolved personalization
   metadata.
4. **Given** wrapper props (`style`, `testID`), **When** component renders, **Then** wrapper `View`
   includes those props and tracking handlers (`onLayout`, touch handlers).

---

### User Story 2 - Control Personalization Live Updates with Preview and Override Precedence (Priority: P1)

As a product owner, I need deterministic live-update precedence so UI can either update live or lock
predictably based on preview visibility, global settings, and per-component overrides.

**Why this priority**: Predictable update/lock behavior is required for both production and preview
workflows.

**Independent Test**: Exercise combinations of `previewPanelVisible`, component `liveUpdates`,
global `liveUpdates`, and personalization-state emissions.

**Acceptance Scenarios**:

1. **Given** preview panel is visible, **When** personalization state emits updates, **Then**
   component uses live-update behavior regardless of other settings.
2. **Given** preview panel hidden and component `liveUpdates` provided, **When** updates emit,
   **Then** component-level value overrides global live-updates context.
3. **Given** live updates are disabled, **When** first non-`undefined` optimizations value arrives,
   **Then** component locks to that value and ignores later updates.
4. **Given** live updates are enabled, **When** optimizations stream emits, **Then** component state
   is replaced on every emission.
5. **Given** component unmount, **When** teardown runs, **Then** personalization subscription is
   unsubscribed.

---

### User Story 3 - Track Non-Optimized Content and Navigation Screens (Priority: P2)

As an analytics integrator, I need `Analytics` and `OptimizationNavigationContainer` to provide
low-boilerplate component and screen tracking.

**Why this priority**: Integrations need consistent component-level and navigation-level analytics
coverage.

**Independent Test**: Render `Analytics` and `OptimizationNavigationContainer`, simulate interaction
and route transitions, and verify payload behavior.

**Acceptance Scenarios**:

1. **Given** `Analytics` receives an entry, **When** tracking hooks are wired, **Then** view/tap
   tracking uses the baseline entry (no personalization metadata).
2. **Given** navigation container becomes ready with a current route, **When** `onReady` runs,
   **Then** one screen event is tracked before user `onReady` callback executes.
3. **Given** navigation state changes route name, **When** `onStateChange` runs, **Then** a new
   screen event is tracked and user `onStateChange` callback runs afterwards.
4. **Given** route name does not change, **When** `onStateChange` runs, **Then** no duplicate screen
   event is tracked.
5. **Given** `includeParams=true` and route params exist, **When** screen event properties are
   built, **Then** params are JSON-coerced and validated before inclusion.

---

### Edge Cases

- `trackViews` and `trackTaps` per-component props override `InteractionTrackingContext` defaults.
- `onTap` implicitly enables tap tracking unless `trackTaps` is explicitly `false`.
- `Personalization` locks only after first non-`undefined` optimizations value when live updates are
  off.
- Navigation param serialization uses `JSON.parse(JSON.stringify(params))` plus `z.json().parse` and
  can throw for invalid/non-serializable params.
- `OptimizationNavigationContainer` always includes `properties.name` in tracked screen properties.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `Personalization` MUST accept `baselineEntry`, render-prop `children`, and optional
  tracking/live-update/styling props.
- **FR-002**: `Personalization` MUST compute `shouldLiveUpdate` as:
  `previewPanelVisible === true || (liveUpdates ?? globalLiveUpdates ?? false)`.
- **FR-003**: `Personalization` MUST subscribe to
  `contentfulOptimization.states.selectedOptimizations`.
- **FR-004**: `Personalization` MUST unsubscribe from selected-optimizations subscription on
  unmount.
- **FR-005**: When `shouldLiveUpdate` is true, `Personalization` MUST replace local personalization
  state on each emission.
- **FR-006**: When `shouldLiveUpdate` is false, `Personalization` MUST lock on first non-undefined
  emission and ignore later emissions while locked.
- **FR-007**: When `shouldLiveUpdate` flips to true, `Personalization` MUST clear lock flag for
  subsequent live updates.
- **FR-008**: `Personalization` MUST resolve content with
  `contentfulOptimization.resolveOptimizedEntry(baselineEntry, lockedPersonalizations)`.
- **FR-009**: `Personalization` MUST resolve view tracking enablement as
  `trackViews ?? interactionTracking.views`.
- **FR-010**: `Personalization` MUST resolve tap tracking enablement as
  `trackTaps === false ? false : (trackTaps ?? onTap) ? true : interactionTracking.taps`.
- **FR-011**: `Personalization` MUST pass resolved entry/personalization plus tracking options to
  `useViewportTracking` and `useTapTracking`.
- **FR-012**: `Personalization` MUST render `children(resolvedEntry)` inside a wrapper `View` with
  `onLayout`, optional `style`, optional `testID`, and tap handlers.
- **FR-013**: `Analytics` MUST accept `entry`, `children`, and optional tracking/styling props.
- **FR-014**: `Analytics` MUST resolve view tracking enablement as
  `trackViews ?? interactionTracking.views`.
- **FR-015**: `Analytics` MUST resolve tap tracking enablement as
  `trackTaps === false ? false : (trackTaps ?? onTap) ? true : interactionTracking.taps`.
- **FR-016**: `Analytics` MUST call `useViewportTracking` with
  `{ entry, threshold, viewTimeMs, viewDurationUpdateIntervalMs, enabled }`.
- **FR-017**: `Analytics` MUST call `useTapTracking` with `{ entry, enabled, onTap }`.
- **FR-018**: `Analytics` MUST render children inside a wrapper `View` with `onLayout`, optional
  `style`, optional `testID`, and tap handlers.
- **FR-019**: `OptimizationNavigationContainer` MUST use render-prop children that receive
  `{ ref, onReady, onStateChange }` handlers.
- **FR-020**: `OptimizationNavigationContainer` MUST default `includeParams` to `false`.
- **FR-021**: On `onReady`, if a current route exists, container MUST set `routeNameRef`, track the
  current route, and then invoke user `onReady` callback.
- **FR-022**: On `onStateChange`, container MUST compare previous/current route names and track only
  when names differ.
- **FR-023**: On `onStateChange`, container MUST update `routeNameRef` to current route name when a
  current route exists.
- **FR-024**: User `onStateChange` callback MUST run after container tracking logic.
- **FR-025**: Navigation screen-tracking properties MUST always include `{ name: screenName }`.
- **FR-026**: When `includeParams=true` and params exist, navigation tracking MUST include
  `properties.params` from JSON-safe coercion/validation (`paramsToJson`).
- **FR-027**: `paramsToJson` serialization/validation errors MUST propagate (not swallowed) by
  navigation handlers.

### Key Entities _(include if feature involves data)_

- **Personalization Local State**: `lockedPersonalizations` plus lock-flag state controlling live vs
  locked behavior.
- **Resolved Personalization Output**: `ResolvedData` (`entry`, `personalization`) produced by
  `resolveOptimizedEntry(...)`.
- **Analytics Wrapper Contract**: Baseline-entry wrapper with view/tap tracking hook wiring.
- **Navigation Tracking State**: `routeNameRef` plus route properties used to suppress duplicate
  screen events.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Personalization tests confirm variant resolution, render-prop output, and subscription
  lifecycle behavior.
- **SC-002**: Live-update precedence tests confirm
  `preview visible > component prop > global context > default false` behavior.
- **SC-003**: Interaction enablement tests confirm `trackViews`/`trackTaps`/`onTap` precedence over
  context defaults.
- **SC-004**: Analytics tests confirm baseline-entry view/tap tracking wiring and wrapper behavior.
- **SC-005**: Navigation tests confirm on-ready tracking order, route-change tracking suppression,
  and callback ordering.
- **SC-006**: Param-inclusion tests confirm `includeParams` default/override behavior and JSON-safe
  param serialization requirements.
