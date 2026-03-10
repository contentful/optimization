# Feature Specification: Optimization Web Automatic Entry Interaction Tracking

**Feature Branch**: `[017-web-automatic-entry-interaction-tracking]`  
**Created**: 2026-02-27  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Control Entry Interactions with Auto and Per-Element Overrides (Priority: P1)

As a Web SDK consumer, I need one tracking API that supports both automatic interaction control and
per-element overrides so I can combine default behavior with targeted element-level decisions.

**Why this priority**: Interaction control is the primary integration surface for automatic click
and view tracking.

**Independent Test**: Create `EntryInteractionRuntime`, exercise
`tracking.enable/disable/enableElement/disableElement/clearElement`, and verify runtime state,
detector lifecycle, and override behavior.

**Acceptance Scenarios**:

1. **Given** a runtime and a known interaction key, **When** `tracking.enable(interaction, options)`
   is called, **Then** auto-tracking for that interaction is set to `true` and the interaction is
   reconciled with the provided options.
2. **Given** a running auto-tracked interaction, **When** `tracking.disable(interaction)` is called,
   **Then** auto-tracking for that interaction is set to `false` and the interaction stops when no
   force-enabled element overrides remain.
3. **Given** global auto-tracking is disabled, **When**
   `tracking.enableElement(interaction, element, options)` is called, **Then** the interaction
   starts in override-only mode and tracks the force-enabled element.
4. **Given** an element override exists, **When** `tracking.disableElement(interaction, element)` or
   `tracking.clearElement(interaction, element)` is called, **Then** tracking reflects the override
   (`disable`) or returns to automatic behavior (`clear`).
5. **Given** an auto-discovered entry element with `data-ctfl-track-clicks` or
   `data-ctfl-track-views`, **When** interaction reconciliation runs, **Then** the attribute value
   force-enables (`'true'`) or force-disables (`'false'`) that specific interaction for that
   element.

---

### User Story 2 - Share Entry Element Lifecycle Across Interaction Detectors (Priority: P1)

As an SDK maintainer, I need click and view detectors to share one entry registry and mutation
pipeline so DOM discovery and lifecycle handling are consistent.

**Why this priority**: Shared lifecycle behavior prevents drift between interaction implementations.

**Independent Test**: Verify runtime start/stop wiring to registry subscriptions, registry seeding,
mutation add/remove propagation, and observer teardown.

**Acceptance Scenarios**:

1. **Given** an interaction starts, **When** runtime wiring is initialized, **Then** the runtime
   subscribes the detector to entry add/remove/error callbacks through the shared registry.
2. **Given** nodes are added, removed, or moved in the DOM, **When** mutation records are processed,
   **Then** move-only remove+add pairs are coalesced and net removals are dispatched before net
   additions.
3. **Given** the runtime is destroyed, **When** teardown executes, **Then** interaction detectors
   stop and shared registry/observer resources are disconnected.

---

### User Story 3 - Resolve Component Payloads from Explicit and Dataset Metadata (Priority: P2)

As an interaction implementation author, I need one payload resolver that normalizes explicit entry
metadata and dataset metadata so click and view tracking emit consistent payloads.

**Why this priority**: Payload consistency is required for downstream analytics correctness.

**Independent Test**: Validate payload resolution precedence and parsing behavior using explicit
data, dataset-only data, and invalid input combinations.

**Acceptance Scenarios**:

1. **Given** valid explicit entry data and valid dataset metadata, **When** payload resolution runs,
   **Then** explicit data wins.
2. **Given** invalid explicit data and valid dataset metadata, **When** payload resolution runs,
   **Then** dataset-derived payload is returned.
3. **Given** neither explicit nor dataset metadata contains a valid non-empty entry ID, **When**
   payload resolution runs, **Then** no payload is returned.

---

### Edge Cases

- Auto-track interaction options default to `false` for known interaction keys when omitted.
- Element overrides are independent from auto-tracking flags: `enableElement` can run an interaction
  while auto-tracking is disabled.
- `disableElement` for a tracked entry must suppress tracking for that element, even when
  auto-tracking is enabled.
- `clearElement` on a non-overridden element is a safe no-op.
- For auto-discovered entries, `data-ctfl-track-clicks` and `data-ctfl-track-views` act as
  per-interaction overrides where only case-insensitive `'true'` and `'false'` are recognized.
- Manual API overrides (`enableElement`/`disableElement`) take precedence over attribute overrides;
  after `clearElement`, behavior falls back to attribute overrides first, then normal auto-tracking.
- View start options passed through `tracking.enable('views', options)` are retained and reused when
  view tracking restarts.
- Registry subscription starts lazily on first subscriber and stops when the last subscriber
  unsubscribes.
- Registry seeding emits currently present entry elements to each new subscriber.
- Existence observer callbacks must isolate subscriber failures and forward errors through optional
  `onError` handlers.
- Existence observer delivery includes descendants of added/removed containers.
- Non-DOM environments degrade to safe no-op behavior for entry discovery and mutation observation.
- Sticky parsing from dataset treats only case-insensitive `'true'` as true; all other values are
  false.
- Variant index parsing from dataset accepts only digit-only non-negative safe integers.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `OptimizationWebConfig` MUST support optional
  `autoTrackEntryInteraction?: Partial<Record<EntryInteraction, boolean>>`.
- **FR-002**: Auto-track interaction options MUST resolve to a complete per-interaction boolean map
  with default `false` for omitted interaction keys.
- **FR-003**: `EntryInteractionRuntime` MUST initialize detectors for registered interactions and
  expose a unified `tracking` API (`enable`, `disable`, `enableElement`, `disableElement`,
  `clearElement`).
- **FR-004**: `tracking.enable(interaction, options)` MUST set auto-tracking for that interaction to
  `true`; for `views` it MUST retain the latest start options and reconcile interaction state.
- **FR-005**: `tracking.disable(interaction)` MUST set auto-tracking for that interaction to `false`
  and reconcile interaction state.
- **FR-006**: `tracking.enableElement(interaction, element, options)` MUST store an enabled override
  for the element and reconcile interaction state.
- **FR-007**: `tracking.disableElement(interaction, element)` MUST store a disabled override for the
  element and reconcile interaction state.
- **FR-008**: `tracking.clearElement(interaction, element)` MUST remove the element override,
  delegate clear behavior to a running detector when supported, and reconcile interaction state.
- **FR-009**: `EntryInteractionRuntime` reconciliation MUST run an interaction when either
  auto-tracking is enabled with consent or at least one element override is force-enabled.
- **FR-010**: `EntryInteractionRuntime.reset()` MUST stop all interactions and clear all element
  overrides.
- **FR-011**: `EntryInteractionRuntime.destroy()` MUST stop all interactions, clear overrides,
  disconnect the shared entry registry, and disconnect the shared existence observer.
- **FR-012**: `syncAutoTrackedEntryInteractions(hasConsent)` MUST gate auto-tracked interactions by
  consent while preserving force-enabled element override behavior.
- **FR-013**: Starting an interaction MUST call detector `start(options)` and subscribe to shared
  registry callbacks (`onAdded`, `onRemoved`, `onError`) with stored cleanup.
- **FR-014**: Stopping an interaction MUST invoke stored registry cleanup once and MUST call
  detector `stop()`.
- **FR-015**: Runtime MUST propagate auto-tracking state changes to running detectors through
  optional detector `setAuto(enabled)` handlers.
- **FR-016**: `EntryElementRegistry` MUST lazily subscribe to `ElementExistenceObserver` and seed
  initial entries using `ENTRY_SELECTOR` from the current document when available.
- **FR-017**: `EntryElementRegistry` MUST deduplicate tracked entries and notify subscribers on net
  add/remove changes.
- **FR-018**: `EntryElementRegistry` MUST resolve entry elements from mutation root elements and
  nested descendants matching `ENTRY_SELECTOR`.
- **FR-019**: `ElementExistenceObserver` MUST observe `childList + subtree` mutations when
  supported, while at least one subscriber exists.
- **FR-020**: `ElementExistenceObserver` MUST coalesce transient remove+add node moves, collect
  element descendants from mutation nodes, and dispatch removals before additions.
- **FR-021**: `ElementExistenceObserver` MUST isolate subscriber callback failures and forward them
  to optional `onError` handlers.
- **FR-022**: `resolveTrackingPayload(data, element)` MUST return `undefined` when neither explicit
  data nor element dataset resolves valid entry metadata.
- **FR-023**: `resolveTrackingPayload(data, element)` MUST prefer valid explicit `EntryData` over
  dataset-derived entry metadata.
- **FR-024**: Dataset-derived payload parsing MUST map `ctflEntryId -> componentId` and
  `ctflPersonalizationId -> experienceId`; `ctflSticky` parsing MUST be true only for
  case-insensitive `'true'`; `ctflVariantIndex` parsing MUST allow only digit-only non-negative safe
  integers.
- **FR-025**: `isEntryElement` MUST return true only for `HTMLElement|SVGElement` values with
  non-empty `dataset.ctflEntryId`; `isEntryData` MUST return true only for objects with non-empty
  `entryId` strings.
- **FR-026**: Auto-discovered entry elements MAY declare per-interaction tracking overrides via
  `dataset.ctflTrackClicks` and `dataset.ctflTrackViews`; only case-insensitive `'true'` and
  `'false'` values MUST be interpreted as overrides.
- **FR-027**: For a given element+interaction, detector reconciliation MUST apply precedence in this
  order: manual API override (`enableElement`/`disableElement`), dataset override
  (`ctflTrackClicks`/`ctflTrackViews`), then global auto-tracking state.

### Key Entities _(include if feature involves data)_

- **EntryInteractionRuntime**: Orchestrator for detector lifecycle, consent gating, and element
  overrides.
- **EntryInteractionDetector**: Detector contract (`start`, `stop`, optional `setAuto` and
  element-level override handlers) implemented by click/view tracking strategies.
- **EntryElementRegistry**: Shared set of tracked entry elements discovered from initial DOM and
  mutations.
- **ElementExistenceObserver**: MutationObserver-based add/remove dispatcher with move coalescing.
- **TrackingPayload**: Normalized payload (`componentId`, `experienceId`, `sticky`, `variantIndex`)
  derived from explicit entry data and/or element dataset.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Runtime tests confirm tracking API methods correctly update auto-track state, apply
  element overrides, and route control to targeted detectors.
- **SC-002**: Consent-sync tests confirm auto-tracked interactions start/stop according to consent
  while force-enabled element overrides remain functional.
- **SC-003**: Registry/existence observer tests confirm lazy activation, mutation move coalescing,
  descendant filtering, ordered delivery (removed then added), and teardown behavior.
- **SC-004**: Payload resolver tests confirm explicit-data precedence, dataset fallback, and strict
  parsing/validation behavior for sticky and variant index fields.
- **SC-005**: Detector tests confirm `data-ctfl-track-clicks`/`data-ctfl-track-views` force-enable
  and force-disable behavior, plus precedence against manual API overrides.
