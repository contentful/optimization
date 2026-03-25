# Feature Specification: Optimization React Native Contexts and Providers

**Feature Branch**: `[022-react-native-contexts-and-providers]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initialize SDK via Provider and Access It Through Context (Priority: P1)

As a component author, I need `OptimizationProvider` to initialize the SDK and expose it via
`useOptimization()` so descendants can call SDK APIs without prop drilling.

**Why this priority**: Most SDK hooks/components depend on context-resolved SDK access.

**Independent Test**: Render `OptimizationProvider` with config props, verify initialization gating,
`useOptimization()` behavior, and cleanup on unmount.

**Acceptance Scenarios**:

1. **Given** `OptimizationProvider` with valid config props, **When** async initialization resolves,
   **Then** descendants can read the `ContentfulOptimization` instance via `useOptimization()`.
2. **Given** provider initialization is pending, **When** provider renders, **Then** it returns
   `null` (loading gate).
3. **Given** provider initialization fails, **When** create rejects, **Then** provider logs the
   failure and continues rendering `null`.
4. **Given** `useOptimization()` is called outside provider, **When** hook executes, **Then** it
   throws setup guidance.
5. **Given** provider unmounts before async create resolves, **When** create later resolves,
   **Then** the created SDK instance is immediately destroyed.

---

### User Story 2 - Share Scroll, Live-Update, and Interaction-Tracking Context Across the Tree (Priority: P1)

As a component maintainer, I need shared context providers for viewport signals, live-update state,
and interaction-tracking defaults so tracking behavior is consistent across components.

**Why this priority**: `OptimizedEntry` and the tracking hooks consume these contexts directly.

**Independent Test**: Render providers with and without overrides, simulate scroll/layout events,
and verify resolved context values.

**Acceptance Scenarios**:

1. **Given** `OptimizationScrollProvider`, **When** layout and scroll events fire, **Then**
   `scrollY` and `viewportHeight` context values update.
2. **Given** user-supplied `onLayout` and `onScroll`, **When** provider handlers run, **Then** user
   callbacks are invoked after internal updates.
3. **Given** `LiveUpdatesProvider` without explicit prop, **When** mounted, **Then**
   `globalLiveUpdates` defaults to `false` and `previewPanelVisible` is managed internally.
4. **Given** `InteractionTrackingProvider` receives partial `trackEntryInteraction`, **When**
   context is resolved, **Then** omitted values default to `{ views: true, taps: false }`.

---

### User Story 3 - Compose a Canonical Root Tree with Optional Preview Overlay (Priority: P2)

As an app integrator, I need one top-level wrapper that composes initialization plus shared
providers and optional preview panel overlay wiring.

**Why this priority**: Canonical composition reduces setup errors and keeps behavior consistent.

**Independent Test**: Render `OptimizationRoot` with/without preview config and verify provider
order, preview overlay behavior, and preview visibility synchronization.

**Acceptance Scenarios**:

1. **Given** `OptimizationRoot` without preview panel, **When** rendered, **Then** children are
   wrapped by `OptimizationProvider`, `LiveUpdatesProvider`, and `InteractionTrackingProvider`.
2. **Given** `previewPanel.enabled=true`, **When** `OptimizationRoot` renders, **Then**
   `PreviewPanelOverlay` is rendered with forwarded preview props.
3. **Given** preview modal open/close state changes in `PreviewPanelOverlay`, **When** visibility
   changes, **Then** `LiveUpdatesContext.previewPanelVisible` is synchronized.
4. **Given** preview overlay usage, **When** `usePreviewOverrides()` is called outside
   `PreviewOverrideProvider`, **Then** it throws.

---

### Edge Cases

- `OptimizationProvider` captures config on first render; later prop changes are ignored unless the
  component is remounted.
- `OptimizationProvider` context value includes `isReady` and `initError`, but the provider only
  renders context after an instance exists.
- `useScrollContext()` and `useLiveUpdates()` return `null` outside their providers.
- `useInteractionTracking()` always returns a resolved object because its context has defaults.
- `OptimizationRoot.liveUpdates` defaults to `false`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `OptimizationContext` default value MUST be `null`.
- **FR-002**: `OptimizationContext` provider value MUST include `{ instance, isReady, initError }`.
- **FR-003**: `useOptimization()` MUST throw when used outside `OptimizationProvider`.
- **FR-004**: `useOptimization()` MUST throw when context exists but `instance` is `null`.
- **FR-005**: `OptimizationProvider` MUST capture first-render config via `useRef` and use that
  captured config for initialization.
- **FR-006**: `OptimizationProvider` MUST call `ContentfulOptimization.create(capturedConfig)` on
  mount.
- **FR-007**: `OptimizationProvider` MUST render `null` until an SDK instance is available.
- **FR-008**: On successful initialization, `OptimizationProvider` MUST log provider initialized and
  expose the instance via context.
- **FR-009**: On initialization failure, `OptimizationProvider` MUST log the error and store
  `initError` state.
- **FR-010**: If provider unmounts before async init resolves, resolved SDK instance MUST be
  destroyed immediately.
- **FR-011**: On provider unmount with an active instance, `instance.destroy()` MUST be called.
- **FR-012**: `ScrollContext` MUST expose `scrollY` and `viewportHeight`.
- **FR-013**: `useScrollContext()` MUST return scroll context value or `null` outside provider.
- **FR-014**: `OptimizationScrollProvider` MUST render a `ScrollView` wrapped in
  `ScrollContext.Provider`.
- **FR-015**: `OptimizationScrollProvider` MUST initialize viewport height from first layout event
  when current viewport height is zero.
- **FR-016**: `OptimizationScrollProvider` scroll handling MUST update `scrollY` and
  `viewportHeight` from native event data.
- **FR-017**: `OptimizationScrollProvider` MUST forward caller-provided `onLayout` and `onScroll`
  callbacks.
- **FR-018**: `OptimizationScrollProvider` MUST set `scrollEventThrottle={16}`.
- **FR-019**: `LiveUpdatesContext` MUST expose `globalLiveUpdates`, `previewPanelVisible`, and
  `setPreviewPanelVisible`.
- **FR-020**: `LiveUpdatesProvider` MUST default `globalLiveUpdates` to `false`.
- **FR-021**: `LiveUpdatesProvider` MUST own `previewPanelVisible` state internally.
- **FR-022**: `useLiveUpdates()` MUST return context value or `null` outside provider.
- **FR-023**: `InteractionTrackingContext` MUST default to `{ views: true, taps: false }`.
- **FR-024**: `InteractionTrackingProvider` MUST resolve `trackEntryInteraction` against defaults,
  with omitted values falling back to `{ views: true, taps: false }`.
- **FR-025**: `OptimizationRoot` MUST compose providers in this order:
  `OptimizationProvider -> LiveUpdatesProvider -> InteractionTrackingProvider`.
- **FR-026**: `OptimizationRoot` MUST default `liveUpdates` to `false`.
- **FR-027**: When `previewPanel.enabled` is true, `OptimizationRoot` MUST render
  `PreviewPanelOverlay` and forward `contentfulClient`, `fabPosition`, `onVisibilityChange`, and
  `showHeader`.
- **FR-028**: When preview panel is absent or disabled, `OptimizationRoot` MUST render children
  without `PreviewPanelOverlay`.
- **FR-029**: `PreviewPanelOverlay` MUST synchronize modal visibility to
  `LiveUpdatesContext.setPreviewPanelVisible`.
- **FR-030**: `PreviewPanelOverlay` MUST wrap content in `PreviewOverrideProvider`.
- **FR-031**: `usePreviewOverrides()` MUST throw when used outside `PreviewOverrideProvider`.

### Key Entities _(include if feature involves data)_

- **OptimizationContext**: Provider-backed contract for SDK instance access.
- **ScrollContext**: Shared viewport metrics for visibility-based tracking.
- **LiveUpdatesContext**: Global and preview-modal visibility state for optimization live updates.
- **InteractionTrackingContext**: Global defaults for auto view/tap tracking behavior.
- **OptimizationRoot Composition**: Canonical provider tree with optional preview overlay.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Provider tests confirm async initialization gate, context access, and cleanup
  behavior.
- **SC-002**: Scroll-context tests confirm viewport metrics updates and callback forwarding.
- **SC-003**: Live-updates and interaction-tracking tests confirm default and override resolution.
- **SC-004**: Root composition tests confirm provider order and conditional preview-overlay
  behavior.
- **SC-005**: Preview integration tests confirm preview visibility sync and `usePreviewOverrides()`
  provider boundary enforcement.
