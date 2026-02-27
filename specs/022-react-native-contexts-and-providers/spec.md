# Feature Specification: Optimization React Native Contexts and Providers

**Feature Branch**: `[022-react-native-contexts-and-providers]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in
`@contentful/optimization-react-native` package and derive SpecKit-compatible specifications that
could have guided its development."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Access the SDK Instance Through React Context (Priority: P1)

As a component author, I need reliable access to the active SDK instance via context so child
components and hooks can call personalization and analytics APIs without prop drilling.

**Why this priority**: Most package APIs depend on context-resolved SDK access.

**Independent Test**: Render components with and without `OptimizationProvider` and verify
`useOptimization` returns instance inside provider and throws outside provider.

**Acceptance Scenarios**:

1. **Given** an `OptimizationProvider` with `instance`, **When** `useOptimization()` is called in
   descendants, **Then** the provided instance is returned.
2. **Given** no `OptimizationProvider`, **When** `useOptimization()` is called, **Then** an error is
   thrown with setup guidance.
3. **Given** provider mount, **When** initialization occurs, **Then** provider initialization is
   logged.

---

### User Story 2 - Provide Shared Scroll and Live-Updates Runtime Signals (Priority: P1)

As a tracking-component maintainer, I need scroll and live-updates context values exposed across the
component tree so visibility tracking and personalization update behavior are coordinated.

**Why this priority**: Scroll/live-update context directly drives tracking and rendering behavior.

**Independent Test**: Render within `OptimizationScrollProvider` and `LiveUpdatesProvider`, simulate
layout and scroll events, and verify context values and forwarding callbacks.

**Acceptance Scenarios**:

1. **Given** `OptimizationScrollProvider` receives layout/scroll events, **When** handlers execute,
   **Then** `scrollY` and `viewportHeight` context values are updated.
2. **Given** caller passes `onLayout`/`onScroll` to `OptimizationScrollProvider`, **When** provider
   handlers run, **Then** caller handlers are invoked.
3. **Given** `LiveUpdatesProvider`, **When** consumers call `useLiveUpdates()`, **Then** they
   receive `globalLiveUpdates`, `previewPanelVisible`, and `setPreviewPanelVisible`.

---

### User Story 3 - Compose a Recommended Root Tree with Optional Preview Overlay (Priority: P2)

As an app integrator, I need a single top-level wrapper that combines providers and optional preview
panel wiring so setup stays consistent and minimal.

**Why this priority**: Root composition reduces setup errors and enables preview-driven behavior.

**Independent Test**: Render `OptimizationRoot` with and without preview panel config and verify
provider hierarchy plus preview visibility synchronization.

**Acceptance Scenarios**:

1. **Given** `OptimizationRoot` without preview panel, **When** rendered, **Then** children are
   wrapped by `OptimizationProvider` and `LiveUpdatesProvider` only.
2. **Given** `OptimizationRoot` with `previewPanel.enabled=true`, **When** rendered, **Then**
   children are wrapped in `PreviewPanelOverlay` with forwarded panel props.
3. **Given** preview panel opens or closes, **When** overlay visibility changes, **Then**
   `LiveUpdatesContext.previewPanelVisible` is synchronized.

---

### Edge Cases

- `useScrollContext()` and `useLiveUpdates()` may return `null` outside providers and must be safe
  for optional consumption.
- `OptimizationScrollProvider` must initialize viewport tracking on layout so children can track
  before first scroll event.
- `OptimizationRoot.liveUpdates` defaults to `false` when omitted.
- Preview overlay should preserve override state across modal open/close cycles via dedicated
  override provider.
- `usePreviewOverrides()` must throw when used outside its provider boundary.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `OptimizationContext` MUST store `{ instance: Optimization }` or `null` by default.
- **FR-002**: `useOptimization()` MUST throw when context is missing.
- **FR-003**: `OptimizationProvider` MUST provide the passed `instance` via `OptimizationContext`.
- **FR-004**: `OptimizationProvider` MUST log provider initialization on mount.
- **FR-005**: `ScrollContext` MUST expose `scrollY` and `viewportHeight` values.
- **FR-006**: `useScrollContext()` MUST return `ScrollContext` value or `null` outside provider.
- **FR-007**: `OptimizationScrollProvider` MUST render a `ScrollView` wrapped by
  `ScrollContext.Provider`.
- **FR-008**: `OptimizationScrollProvider` layout handling MUST initialize viewport height from
  first layout event when current value is zero.
- **FR-009**: `OptimizationScrollProvider` scroll handling MUST update `scrollY` and
  `viewportHeight` from native scroll event payload.
- **FR-010**: `OptimizationScrollProvider` MUST forward caller-provided `onLayout` and `onScroll`
  callbacks.
- **FR-011**: `OptimizationScrollProvider` MUST set `scrollEventThrottle={16}` on the underlying
  `ScrollView`.
- **FR-012**: `LiveUpdatesContext` MUST expose `globalLiveUpdates`, `previewPanelVisible`, and
  `setPreviewPanelVisible`.
- **FR-013**: `LiveUpdatesProvider` MUST default `globalLiveUpdates` to `false` when omitted.
- **FR-014**: `LiveUpdatesProvider` MUST maintain `previewPanelVisible` state internally.
- **FR-015**: `useLiveUpdates()` MUST return `LiveUpdatesContext` value or `null` outside provider.
- **FR-016**: `OptimizationRoot` MUST wrap children with `OptimizationProvider` and
  `LiveUpdatesProvider`.
- **FR-017**: `OptimizationRoot` MUST default `liveUpdates` to `false`.
- **FR-018**: When `previewPanel.enabled` is true, `OptimizationRoot` MUST render
  `PreviewPanelOverlay` and forward preview props (`contentfulClient`, `fabPosition`,
  `onVisibilityChange`, `showHeader`).
- **FR-019**: When `previewPanel` is absent or disabled, `OptimizationRoot` MUST render children
  without preview overlay.
- **FR-020**: `PreviewPanelOverlay` MUST synchronize open/close state to
  `LiveUpdatesContext.setPreviewPanelVisible`.
- **FR-021**: `PreviewPanelOverlay` MUST host children inside `PreviewOverrideProvider` so override
  state survives modal visibility changes.
- **FR-022**: `usePreviewOverrides()` MUST throw when accessed outside `PreviewOverrideProvider`.

### Key Entities _(include if feature involves data)_

- **OptimizationContext**: React context contract for SDK instance propagation.
- **ScrollContext**: Shared viewport metrics (`scrollY`, `viewportHeight`) for visibility tracking.
- **LiveUpdatesContext**: Global and preview-driven live-update control state.
- **OptimizationRoot Composition**: Canonical provider tree with optional preview overlay.
- **PreviewOverrideContext**: Override state container used by preview panel internals.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Context-access tests confirm `useOptimization` succeeds inside provider and fails with
  clear guidance outside provider.
- **SC-002**: Scroll provider tests confirm context updates from layout/scroll events and user
  callbacks are preserved.
- **SC-003**: Root composition tests confirm provider hierarchy and conditional preview overlay
  behavior.
- **SC-004**: Preview visibility tests confirm overlay open/close updates `previewPanelVisible` in
  live-updates context.
