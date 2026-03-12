# Feature Specification: Contentful Optimization Web Automatic Component Click Tracking

**Feature Branch**: `[025-web-automatic-click-tracking]`  
**Created**: 2026-02-27  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Track Clicks for Tracked Entry Elements via DOM Click Signals (Priority: P1)

As a Web SDK consumer, I need click interactions for tracked entry elements emitted automatically
from document click events so I do not manually wire component click tracking for common HTML
patterns.

**Why this priority**: Click interaction tracking is a core automatic interaction type in the Web
SDK.

**Independent Test**: Register tracked entries, trigger click events across supported clickable
paths, and assert `trackClick` payload dispatch.

**Acceptance Scenarios**:

1. **Given** a tracked entry element that is itself clickable, **When** it is clicked, **Then** one
   component click event is dispatched.
2. **Given** a tracked entry element inside a clickable ancestor, **When** the entry is clicked,
   **Then** one component click event is dispatched for that entry.
3. **Given** a tracked entry element containing a clickable descendant, **When** the descendant is
   clicked, **Then** one component click event is dispatched for that entry.

---

### User Story 2 - Combine Auto-Tracking State with Per-Element Overrides (Priority: P1)

As an integrator, I need per-element enable/disable/clear overrides that work with global
auto-tracking so click behavior can be tuned per element.

**Why this priority**: Real-world pages need element-level exceptions while preserving default
automatic tracking.

**Independent Test**: Apply `enableElement`, `disableElement`, and `clearElement` across auto and
non-auto states and verify payload precedence and tracking eligibility behavior.

**Acceptance Scenarios**:

1. **Given** an element with both dataset metadata and an enabled override, **When** click tracking
   runs, **Then** override metadata is used.
2. **Given** an auto-tracked element with a disabled override, **When** it is clicked, **Then** no
   click event is dispatched.
3. **Given** an element with a cleared override, **When** it is auto-tracked and clicked, **Then**
   click payload resolution falls back to dataset metadata.
4. **Given** an auto-tracked entry with `data-ctfl-track-clicks='false'`, **When** it is clicked,
   **Then** no click event is dispatched.
5. **Given** global click auto-tracking is disabled and an auto-discovered entry has
   `data-ctfl-track-clicks='true'`, **When** it is clicked on a clickable path, **Then** one
   component click event is dispatched.

---

### User Story 3 - Preserve Robust Click Target and Lifecycle Handling (Priority: P2)

As an SDK maintainer, I need robust event-target resolution and cleanup semantics so click tracking
remains stable with text-node targets, node removals, and runtime teardown.

**Why this priority**: Browser event targets and dynamic DOM changes are common sources of tracking
regressions.

**Independent Test**: Exercise text-node click targets, removed entries, non-clickable paths, and
start/stop teardown behavior.

**Acceptance Scenarios**:

1. **Given** a click event whose target is a text node, **When** target resolution runs, **Then**
   click tracking resolves to the nearest element target and can dispatch normally.
2. **Given** an entry removed from the DOM and processed by mutation observation, **When** further
   clicks occur on that removed node, **Then** no additional auto-tracked click events are
   dispatched.
3. **Given** non-clickable click paths, **When** clicks occur, **Then** no click tracking event is
   emitted.

---

### Edge Cases

- Clickability detection must support selector-based clickables and `onclick` property handlers.
- Document listener registration must be capture-phase to observe click intent before bubbling
  side-effects.
- `enableElement`, `disableElement`, and `clearElement` must be safe for elements without prior
  auto-tracking state.
- `disableElement` must suppress click tracking for that element, even when `setAuto(true)` and auto
  entry state are present.
- `data-ctfl-track-clicks` supports per-element click override for auto-discovered entries where
  only case-insensitive `'true'` and `'false'` are recognized.
- Manual `enableElement`/`disableElement` overrides must take precedence over
  `data-ctfl-track-clicks`; after `clearElement`, click eligibility falls back to
  `data-ctfl-track-clicks` first, then auto-tracking state.
- On `stop()`, listener teardown and tracked-entry map cleanup must occur even if no events were
  emitted.
- If payload resolution fails (no valid entry metadata), the detector must skip dispatch and log a
  warning.
- Non-DOM environments must short-circuit listener registration safely.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `createEntryClickDetector(core)` MUST produce an interaction detector with
  `start/stop/setAuto/onEntryAdded/onEntryRemoved/enableElement/disableElement/clearElement`
  handlers.
- **FR-002**: `start()` MUST register a document-level `'click'` event listener in capture phase
  when `document` is available.
- **FR-003**: `stop()` MUST remove the document `'click'` capture listener when active and clear all
  tracked entry state.
- **FR-004**: `setAuto(enabled)` MUST control whether auto-marked entries are considered tracked
  when no explicit element override is present.
- **FR-005**: `onEntryAdded(entryElement)` MUST mark the element as auto-tracked and preserve any
  existing override state for that element.
- **FR-006**: `onEntryRemoved(entryElement)` MUST mark the element as no longer auto-tracked and
  MUST remove element state only when no explicit override is present.
- **FR-007**: `enableElement(element, { data })` MUST set an enabled override and store override
  metadata for payload resolution.
- **FR-008**: `disableElement(element)` MUST set a disabled override and clear override metadata.
- **FR-009**: `clearElement(element)` MUST remove override enable/disable state and metadata, and
  MUST delete element state when it is not auto-tracked.
- **FR-010**: Click target resolution MUST support `EventTarget` values that are elements directly
  or non-element nodes whose `parentElement` can be used.
- **FR-011**: Click context resolution MUST locate the nearest tracked entry ancestor in the event
  path and determine clickability from either selector-based clickable path or `onclick` property
  handlers.
- **FR-012**: Click tracking MUST dispatch only when both a tracked entry element and a clickable
  path are present.
- **FR-013**: Payload resolution MUST use override metadata only when the element override is
  explicitly enabled; otherwise it MUST resolve from entry dataset attributes.
- **FR-014**: When payload resolution succeeds, the detector MUST call `core.trackClick` with the
  normalized payload.
- **FR-015**: When payload resolution fails, the detector MUST skip dispatch and log a warning.
- **FR-016**: Clickable path detection MUST include semantic controls (`a[href]`, `button`,
  `input:not([type="hidden"])`, `select`, `textarea`, `summary`), role-hinted clickables
  (`[role="button"]`, `[role="link"]`), and explicit hints (`[onclick]`,
  `[data-ctfl-clickable="true"]`).
- **FR-017**: `onEntryAdded(entryElement)` MUST resolve optional per-element click override from
  `dataset.ctflTrackClicks`, where only case-insensitive `'true'` and `'false'` values are treated
  as overrides.
- **FR-018**: When deciding tracked click eligibility for an entry, precedence MUST be manual
  enable/disable override first, then `ctflTrackClicks` dataset override, then `setAuto(enabled)` +
  auto-tracked state.
- **FR-019**: `clearElement(element)` MUST clear only manual override state; when the element
  remains auto-tracked, click eligibility MUST continue to honor any `ctflTrackClicks` dataset
  override.

### Key Entities _(include if feature involves data)_

- **TrackedEntryState**: Per-element click-tracking ownership state (`auto`, `overrideEnabled`,
  `attributeOverrideEnabled`, `overrideData`).
- **Click Context**: Resolved combination of nearest tracked entry element and clickable-path
  presence for a click event.
- **Click Tracking Payload**: Normalized component payload emitted to `trackClick`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Click tests confirm direct-entry, clickable-ancestor, and clickable-descendant flows
  each emit exactly one component click event.
- **SC-002**: Override tests confirm enabled overrides take metadata precedence, disabled overrides
  suppress tracking, and clear restores fallback behavior.
- **SC-003**: Robustness tests confirm text-node targets resolve correctly, non-clickable paths do
  not emit events, and removed entries stop emitting events after mutation processing.
- **SC-004**: Lifecycle tests confirm start/stop listener management and state cleanup are
  deterministic.
- **SC-005**: Click override tests confirm `data-ctfl-track-clicks='false'` suppresses tracking and
  `data-ctfl-track-clicks='true'` can force-enable tracking when global auto mode is off.
