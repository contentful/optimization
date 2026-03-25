# Feature Specification: Optimization React Native Optimized Entry and Navigation Tracking

**Feature Branch**: `[024-react-native-optimized-entry-and-navigation-tracking]` **Created**:
2026-02-26 **Status**: Current (Pre-release) **Input**: Repository behavior review for the current
pre-release implementation (validated 2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resolve Optimized Content and Attach Interaction Tracking (Priority: P1)

As an app developer, I need `OptimizedEntry` to resolve baseline or variant content and attach view
and tap tracking handlers so rendering and entry tracking stay synchronized.

**Why this priority**: Optimized rendering and interaction tracking are the primary SDK value path.

**Independent Test**: Render `OptimizedEntry`, simulate selected-optimization state emissions, and
verify resolved entry output plus tracking-hook inputs.

**Acceptance Scenarios**:

1. **Given** an optimized entry and selected optimizations, **When** render resolves, **Then**
   `children` receives `contentfulOptimization.resolveOptimizedEntry(...).entry`.
2. **Given** a non-optimized entry or no applicable selection, **When** render resolves, **Then**
   the baseline entry is rendered unchanged.
3. **Given** resolved entry and `selectedOptimization` metadata, **When** hooks are wired, **Then**
   `useViewportTracking` and `useTapTracking` receive resolved entry plus resolved selection
   metadata.
4. **Given** wrapper props (`style`, `testID`), **When** component renders, **Then** wrapper `View`
   includes those props and tracking handlers (`onLayout`, touch handlers).

---

### User Story 2 - Control Optimized Entry Live Updates with Preview and Override Precedence (Priority: P1)

As a product owner, I need deterministic live-update precedence so optimized entries can either
update live or lock predictably based on preview visibility, global settings, and per-entry
overrides.

**Why this priority**: Predictable update and lock behavior is required for both production and
preview workflows.

**Independent Test**: Exercise combinations of `previewPanelVisible`, component `liveUpdates`,
global `liveUpdates`, and selected-optimization state emissions.

**Acceptance Scenarios**:

1. **Given** preview panel is visible, **When** selected optimizations emit updates, **Then**
   component uses live-update behavior regardless of other settings.
2. **Given** preview panel hidden and component `liveUpdates` provided, **When** updates emit,
   **Then** component-level value overrides global live-updates context.
3. **Given** live updates are disabled, **When** first non-`undefined` selected optimizations value
   arrives, **Then** component locks to that value and ignores later updates.
4. **Given** live updates are enabled, **When** selected optimizations emit, **Then** component
   state is replaced on every emission.
5. **Given** a non-optimized entry, **When** component mounts, **Then** no `selectedOptimizations`
   subscription is created.

---

### User Story 3 - Track Navigation Screens with Minimal Boilerplate (Priority: P2)

As a React Native integrator, I need `OptimizationNavigationContainer` to provide low-boilerplate
screen tracking around React Navigation.

**Why this priority**: Integrations need consistent screen tracking without direct navigation-SDK
coupling in the optimization package.

**Independent Test**: Render `OptimizationNavigationContainer`, simulate readiness and route
transitions, and verify payload behavior plus callback ordering.

**Acceptance Scenarios**:

1. **Given** navigation container becomes ready with a current route, **When** `onReady` runs,
   **Then** one screen event is tracked before user `onReady` callback executes.
2. **Given** navigation state changes route name, **When** `onStateChange` runs, **Then** a new
   screen event is tracked and user `onStateChange` callback runs afterwards.
3. **Given** route name does not change, **When** `onStateChange` runs, **Then** no duplicate screen
   event is tracked.
4. **Given** `includeParams=true` and route params exist, **When** screen event properties are
   built, **Then** params are JSON-coerced and validated before inclusion.

---

### Edge Cases

- `trackViews` and `trackTaps` per-entry props override `InteractionTrackingContext` defaults.
- `onTap` implicitly enables tap tracking unless `trackTaps` is explicitly provided.
- `OptimizedEntry` locks only after the first non-`undefined` selected optimizations value when live
  updates are off.
- `OptimizedEntry` always resolves `liveUpdates` as preview-panel visibility first, then component
  override, then global context, then `false`.
- Navigation param serialization uses `JSON.parse(JSON.stringify(params))` plus `z.json().parse` and
  can throw for invalid or non-serializable params.
- `OptimizationNavigationContainer` always includes `properties.name` in tracked screen properties.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `OptimizedEntry` MUST accept `entry`, `children`, and optional
  tracking/live-update/styling props.
- **FR-002**: `OptimizedEntry` MUST detect whether `entry` is optimized via `isOptimizedEntry`.
- **FR-003**: `OptimizedEntry` MUST compute `shouldLiveUpdate` as
  `previewPanelVisible === true || (liveUpdates ?? globalLiveUpdates ?? false)`.
- **FR-004**: For optimized entries, `OptimizedEntry` MUST subscribe to
  `contentfulOptimization.states.selectedOptimizations`.
- **FR-005**: `OptimizedEntry` MUST unsubscribe from the selected-optimizations subscription on
  unmount.
- **FR-006**: When `shouldLiveUpdate` is true, `OptimizedEntry` MUST replace local locked selection
  state on each emission.
- **FR-007**: When `shouldLiveUpdate` is false, `OptimizedEntry` MUST lock on the first
  non-`undefined` emission and ignore later emissions while locked.
- **FR-008**: When `shouldLiveUpdate` flips to true, `OptimizedEntry` MUST clear the lock flag for
  subsequent live updates.
- **FR-009**: For optimized entries, `OptimizedEntry` MUST resolve content with
  `contentfulOptimization.resolveOptimizedEntry(entry, lockedSelectedOptimizations)`.
- **FR-010**: For non-optimized entries, `OptimizedEntry` MUST resolve content as `{ entry }`
  without variant resolution.
- **FR-011**: `OptimizedEntry` MUST resolve view tracking enablement as
  `trackViews ?? interactionTracking.views`.
- **FR-012**: `OptimizedEntry` MUST resolve tap tracking enablement as:
  `trackTaps !== undefined ? trackTaps : onTap ? true : interactionTracking.taps`.
- **FR-013**: `OptimizedEntry` MUST pass resolved entry and `selectedOptimization` plus tracking
  options to `useViewportTracking` and `useTapTracking`.
- **FR-014**: `OptimizedEntry` MUST render a wrapper `View` with `onLayout`, optional `style`,
  optional `testID`, and touch handlers from `useTapTracking`.
- **FR-015**: `OptimizedEntry` MUST render static children as-is, or invoke render-prop children
  with the resolved entry.
- **FR-016**: `OptimizationNavigationContainer` MUST use render-prop children that receive
  `{ ref, onReady, onStateChange }` handlers.
- **FR-017**: `OptimizationNavigationContainer` MUST default `includeParams` to `false`.
- **FR-018**: On `onReady`, if a current route exists, container MUST set `routeNameRef`, track the
  current route, and then invoke user `onReady` callback.
- **FR-019**: On `onStateChange`, container MUST compare previous and current route names and track
  only when names differ.
- **FR-020**: On `onStateChange`, container MUST update `routeNameRef` to current route name when a
  current route exists.
- **FR-021**: User `onStateChange` callback MUST run after container tracking logic.
- **FR-022**: Navigation screen-tracking properties MUST always include `{ name: screenName }`.
- **FR-023**: When `includeParams=true` and params exist, navigation tracking MUST include
  `properties.params` from JSON-safe coercion and validation (`paramsToJson`).
- **FR-024**: `paramsToJson` serialization and validation errors MUST propagate rather than being
  swallowed by navigation handlers.

### Key Entities _(include if feature involves data)_

- **Optimized Entry Local State**: `lockedSelectedOptimizations` plus lock-flag state controlling
  live versus locked behavior.
- **Resolved Optimization Output**: `ResolvedData` (`entry`, `selectedOptimization`) produced by
  `resolveOptimizedEntry(...)`.
- **Entry Tracking Wrapper Contract**: `OptimizedEntry` wrapper with view and tap tracking hook
  wiring.
- **Navigation Tracking State**: `routeNameRef` plus route properties used to suppress duplicate
  screen events.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `OptimizedEntry` tests confirm variant resolution, render-prop output, and
  subscription lifecycle behavior.
- **SC-002**: Live-update precedence tests confirm
  `preview visible > component prop > global context > default false` behavior.
- **SC-003**: Interaction enablement tests confirm `trackViews`/`trackTaps`/`onTap` precedence over
  context defaults.
- **SC-004**: Baseline-entry tests confirm non-optimized entries still wire view and tap tracking
  without selection metadata.
- **SC-005**: Navigation tests confirm on-ready tracking order, route-change tracking suppression,
  and callback ordering.
- **SC-006**: Param-inclusion tests confirm `includeParams` default and override behavior plus
  JSON-safe param serialization requirements.
