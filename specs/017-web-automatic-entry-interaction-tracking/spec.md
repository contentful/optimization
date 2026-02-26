# Feature Specification: Optimization Web Automatic Entry Interaction Tracking

**Feature Branch**: `[017-web-automatic-entry-interaction-tracking]`  
**Created**: 2026-02-27  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in `@contentful/optimization-web`
package and derive SpecKit-compatible specifications."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Control Automatic Entry Interactions Through a Unified Runtime (Priority: P1)

As a Web SDK consumer, I need one interaction-tracking API that can enable, disable, and manually
observe tracked entry interactions so integrations use a consistent contract across interaction
implementations.

**Why this priority**: A single runtime contract is required for scalable multi-interaction support.

**Independent Test**: Create `EntryInteractionRuntime`, exercise
`tracking.enable/disable/observe/ unobserve`, and verify auto-track flags and delegated tracker
calls.

**Acceptance Scenarios**:

1. **Given** a runtime and a known interaction key, **When** `tracking.enable(interaction, options)`
   is called, **Then** auto-tracking for that interaction is set to `true`, existing tracker state
   is stopped, and the tracker restarts with provided options.
2. **Given** a runtime and a tracked interaction, **When** `tracking.disable(interaction)` is
   called, **Then** the tracker for that interaction is stopped.
3. **Given** auto-tracking is configured for known interactions, **When**
   `syncAutoTrackedEntryInteractions(hasConsent)` is called, **Then** consented state starts those
   interactions and non-consented state stops them.

---

### User Story 2 - Share Entry Element Lifecycle Across Interaction Trackers (Priority: P1)

As an SDK maintainer, I need interaction trackers to share one entry registry and mutation observer
pipeline so discovery, add/remove handling, and teardown are centralized.

**Why this priority**: Shared lifecycle management avoids duplicated observer logic and inconsistent
DOM behavior between interaction types.

**Independent Test**: Verify tracker host subscription behavior, registry seeding/add/remove
notification behavior, and existence observer coalescing/chunking/flush behavior.

**Acceptance Scenarios**:

1. **Given** a tracker host starts, **When** it subscribes to the entry registry, **Then** entry
   add/remove callbacks are wired to the detector and cleanup is registered.
2. **Given** entry elements are added, removed, or moved in the DOM, **When** mutation records are
   processed, **Then** move-only changes are coalesced away and net removals are delivered before
   net additions.
3. **Given** the runtime is destroyed, **When** teardown executes, **Then** all interaction trackers
   are stopped and shared registry/existence observer resources are disconnected.

---

### User Story 3 - Resolve Component Tracking Payloads from Entry Metadata (Priority: P2)

As an interaction implementation author, I need one payload resolver that normalizes explicit entry
metadata and dataset metadata so all interaction types dispatch consistent component payloads.

**Why this priority**: Payload consistency is required for reliable downstream analytics semantics.

**Independent Test**: Validate payload resolution precedence and parsing behavior using explicit
data, dataset-only data, and invalid input combinations.

**Acceptance Scenarios**:

1. **Given** valid explicit entry data and valid element dataset, **When** payload resolution runs,
   **Then** explicit data wins over dataset values.
2. **Given** invalid explicit data and valid element dataset, **When** payload resolution runs,
   **Then** dataset-derived payload is returned.
3. **Given** neither explicit nor dataset data resolves to a valid entry identifier, **When**
   payload resolution runs, **Then** no payload is returned.

---

### Edge Cases

- Auto-track configuration defaults to `false` for every known interaction key when omitted.
- `tracking.observe`/`tracking.unobserve` are safe when a detector does not implement element-level
  handlers.
- Registry subscription starts lazily on first subscriber and stops after last subscriber cleanup.
- Registry seeding must emit currently present entry elements to new subscribers after subscribe.
- Subscriber callback failures in registry and existence observer must be isolated and routed
  through optional `onError` handlers.
- Existence observer delivery must include descendant elements of added/removed containers.
- Existence observer `flush()` must cancel pending idle work and process queued records immediately.
- Non-DOM environments must degrade to safe no-op behavior for entry existence observation.
- Sticky parsing from dataset treats only case-insensitive `'true'` as true; all other values are
  false.
- Variant index parsing from dataset accepts only digit-only non-negative safe integers.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `OptimizationWebConfig` MUST support optional
  `autoTrackEntryInteraction?: Partial<Record<EntryInteraction, boolean>>`.
- **FR-002**: Auto-track interaction options MUST resolve to a complete per-interaction boolean map
  with default `false` for omitted interaction keys.
- **FR-003**: `EntryInteractionRuntime` MUST initialize one tracker host per registered interaction
  and expose a unified `tracking` API (`enable`, `disable`, `observe`, `unobserve`).
- **FR-004**: `tracking.enable(interaction, options)` MUST set auto-tracking for that interaction to
  `true`, stop the active tracker instance for that interaction, then start it with the supplied
  options.
- **FR-005**: `tracking.disable(interaction)` MUST stop the tracker for that interaction.
- **FR-006**: `tracking.observe(interaction, element, options)` MUST delegate to the matching
  interaction tracker's `trackElement` handler when available.
- **FR-007**: `tracking.unobserve(interaction, element)` MUST delegate to the matching interaction
  tracker's `untrackElement` handler when available.
- **FR-008**: `EntryInteractionRuntime.reset()` MUST stop all registered interaction trackers.
- **FR-009**: `EntryInteractionRuntime.destroy()` MUST stop all registered interaction trackers,
  disconnect the shared entry registry, and disconnect the shared existence observer.
- **FR-010**: `syncAutoTrackedEntryInteractions(hasConsent)` MUST start each interaction whose
  auto-track flag is `true` when `hasConsent` is truthy, and MUST stop those interactions when
  `hasConsent` is falsy.
- **FR-011**: `EntryInteractionTrackerHost.start(options)` MUST call detector `start(options)` and
  subscribe to the shared entry registry using detector add/remove/error callbacks.
- **FR-012**: `EntryInteractionTrackerHost.stop()` MUST run stored registry cleanup exactly once per
  active subscription and MUST always call detector `stop()`.
- **FR-013**: `EntryElementRegistry` MUST subscribe to `ElementExistenceObserver` lazily and seed
  initial entries using `ENTRY_SELECTOR` from the current document when available.
- **FR-014**: `EntryElementRegistry` MUST deduplicate tracked entry elements and notify subscribers
  on net add/remove changes.
- **FR-015**: `EntryElementRegistry` MUST resolve entry elements both from mutation root elements
  and nested descendants matching `ENTRY_SELECTOR`.
- **FR-016**: `ElementExistenceObserver` MUST observe `childList + subtree` mutations when
  supported, coalesce transient remove+add node moves, and filter node sets to element sets.
- **FR-017**: `ElementExistenceObserver` MUST deliver aggregate `onChange` payloads plus per-kind
  `onRemoved` and `onAdded` payloads, with removals dispatched before additions.
- **FR-018**: `ElementExistenceObserver` MUST support idle-time chunked dispatch with configurable
  `idleTimeoutMs` and `maxChunk`, and `flush()` MUST force immediate processing.
- **FR-019**: `ElementExistenceObserver` MUST isolate sync/async subscriber failures and forward
  them to optional `onError` callbacks.
- **FR-020**: `resolveComponentTrackingPayload(data, element)` MUST return `undefined` when neither
  explicit data nor element dataset resolves valid entry metadata.
- **FR-021**: `resolveComponentTrackingPayload(data, element)` MUST prefer valid explicit
  `EntryData` over dataset-derived entry metadata.
- **FR-022**: Dataset-derived payload parsing MUST map `ctflEntryId -> componentId` and
  `ctflPersonalizationId -> experienceId`; `ctflSticky` parsing MUST be true only for
  case-insensitive `'true'`; `ctflVariantIndex` parsing MUST allow only digit-only non-negative safe
  integers.
- **FR-023**: `isEntryElement` MUST return true only for `HTMLElement|SVGElement` values with
  non-empty `dataset.ctflEntryId`; `isEntryData` MUST return true only for objects with non-empty
  `entryId` strings.

### Key Entities _(include if feature involves data)_

- **EntryInteractionRuntime**: Orchestrator for interaction tracker hosts, consent gating, and
  tracking API surface.
- **EntryInteractionTrackerHost**: Adapter wiring a concrete detector to shared registry lifecycle.
- **EntryElementRegistry**: Shared set of entry elements discovered from initial DOM and mutations.
- **ElementExistenceObserver**: MutationObserver-based coalescing and chunked add/remove dispatcher.
- **ComponentTrackingPayload**: Normalized payload (`componentId`, `experienceId`, `sticky`,
  `variantIndex`) derived from explicit entry data and/or element dataset.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Runtime tests confirm generic `tracking` API methods update auto-track state and route
  control to the targeted interaction tracker.
- **SC-002**: Consent-sync tests confirm auto-tracked interactions start and stop strictly according
  to consent transitions.
- **SC-003**: Registry/existence observer tests confirm lazy activation, mutation coalescing,
  descendant filtering, ordered delivery (removed then added), and idle/flush behavior.
- **SC-004**: Payload resolver tests confirm explicit-data precedence, dataset fallback, and strict
  parsing/validation behavior for sticky and variant index fields.
