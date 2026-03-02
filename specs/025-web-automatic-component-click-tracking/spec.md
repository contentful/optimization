# Feature Specification: Optimization Web Automatic Component Click Tracking

**Feature Branch**: `[025-web-automatic-component-click-tracking]`  
**Created**: 2026-02-27  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in `@contentful/optimization-web`
package and derive SpecKit-compatible specifications."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Track Clicks for Tracked Entry Elements via DOM Click Signals (Priority: P1)

As a Web SDK consumer, I need click interactions for tracked entry elements emitted automatically
from document click events so I do not manually wire component click tracking for common HTML
patterns.

**Why this priority**: Click interaction tracking is a core automatic interaction type in the Web
SDK.

**Independent Test**: Register auto-tracked entries, trigger click events across supported clickable
paths, and assert `trackComponentClick` payload dispatch.

**Acceptance Scenarios**:

1. **Given** a tracked entry element that is itself clickable, **When** it is clicked, **Then** one
   component click event is dispatched.
2. **Given** a tracked entry element inside a clickable ancestor, **When** the entry is clicked,
   **Then** one component click event is dispatched for that entry.
3. **Given** a tracked entry element containing a clickable descendant, **When** the descendant is
   clicked, **Then** one component click event is dispatched for that entry.

---

### User Story 2 - Combine Auto and Manual Click Tracking Metadata (Priority: P1)

As an integrator, I need to manually override entry metadata for specific elements while preserving
auto-tracked behavior so click payloads can be customized where needed.

**Why this priority**: Manual overrides are required for non-standard DOM markup and programmatic
tracking scenarios.

**Independent Test**: Manually track/untrack elements with `data` overrides and verify payload
precedence plus fallback behavior.

**Acceptance Scenarios**:

1. **Given** an element with both dataset metadata and manual tracking metadata, **When** click
   tracking runs, **Then** manual metadata is used.
2. **Given** a manually tracked element that remains auto-tracked, **When** manual untrack is
   called, **Then** click payload resolution falls back to dataset metadata.
3. **Given** an element manually tracked before tracker start, **When** auto-tracking starts and a
   click occurs, **Then** manual metadata remains in effect.

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
2. **Given** an entry removed from the DOM and processed by the existence observer, **When** further
   clicks occur on that removed node, **Then** no additional click events are dispatched.
3. **Given** non-clickable click paths, **When** clicks occur, **Then** no click tracking event is
   emitted.

---

### Edge Cases

- Clickability detection must support selector-based clickables and `onclick` property handlers.
- Document listener registration must be capture-phase to observe click intent before bubbling
  side-effects.
- `trackElement` and `untrackElement` must be safe for elements without prior auto-tracking state.
- On `stop()`, listener teardown and tracked-entry map cleanup must occur even if no events were
  emitted.
- If payload resolution fails (no valid entry metadata), the detector must skip dispatch and log a
  warning.
- Non-DOM environments must short-circuit listener registration safely.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `createEntryClickDetector(core)` MUST produce an interaction detector with
  `start/stop/onEntryAdded/onEntryRemoved/trackElement/untrackElement` handlers.
- **FR-002**: `start()` MUST register a document-level `'click'` event listener in capture phase
  when `document` is available.
- **FR-003**: `stop()` MUST remove the document `'click'` capture listener when active and clear all
  tracked entry state.
- **FR-004**: `onEntryAdded(entryElement)` MUST mark the element as auto-tracked and preserve any
  existing manual tracking state for that element.
- **FR-005**: `onEntryRemoved(entryElement)` MUST remove all tracking state for that element.
- **FR-006**: `trackElement(element, { data })` MUST mark the element as manually tracked and store
  manual metadata for payload resolution.
- **FR-007**: `untrackElement(element)` MUST clear manual tracking metadata, and MUST remove the
  element state only when the element is not auto-tracked.
- **FR-008**: Click target resolution MUST support `EventTarget` values that are elements directly
  or non-element nodes whose `parentElement` can be used.
- **FR-009**: Click context resolution MUST locate the nearest tracked entry ancestor in the event
  path and determine clickability from either selector-based clickable path or `onclick` property
  handlers.
- **FR-010**: Click tracking MUST dispatch only when both a tracked entry element and a clickable
  path are present.
- **FR-011**: Payload resolution MUST prefer manual tracking data when the entry is manually
  tracked; otherwise it MUST resolve from entry dataset attributes.
- **FR-012**: When payload resolution succeeds, the detector MUST call `core.trackComponentClick`
  with the normalized payload.
- **FR-013**: When payload resolution fails, the detector MUST skip dispatch and log a warning.
- **FR-014**: Clickable path detection MUST include semantic controls (`a[href]`, `button`,
  `input:not([type="hidden"])`, `select`, `textarea`, `summary`), role-hinted clickables
  (`[role="button"]`, `[role="link"]`), and explicit hints (`[onclick]`,
  `[data-ctfl-clickable="true"]`).

### Key Entities _(include if feature involves data)_

- **TrackedEntryState**: Per-element click-tracking ownership state (`auto`, `manual`,
  `manualData`).
- **Click Context**: Resolved combination of nearest tracked entry element and clickable-path
  presence for a click event.
- **Click Tracking Payload**: Normalized component payload emitted to `trackComponentClick`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Click tests confirm direct-entry, clickable-ancestor, and clickable-descendant flows
  each emit exactly one component click event.
- **SC-002**: Manual override tests confirm manual payload precedence and dataset fallback after
  manual untrack.
- **SC-003**: Robustness tests confirm text-node targets resolve correctly, non-clickable paths do
  not emit events, and removed entries stop emitting events after mutation processing.
- **SC-004**: Lifecycle tests confirm start/stop listener management and state cleanup are
  deterministic.
