# Feature Specification: Optimization Web Automatic Component View Tracking

**Feature Branch**: `[017-web-automatic-component-view-tracking]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in `@contentful/optimization-web`
package and derive SpecKit-compatible specifications."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Track Entry Component Views from DOM Signals (Priority: P1)

As a Web SDK consumer, I need component view events emitted automatically from entry-marked DOM
elements so I do not need to manually call tracking APIs for every viewable component.

**Why this priority**: Automatic view tracking is a primary Web SDK differentiator.

**Independent Test**: Enable auto tracking, render elements with `data-ctfl-*` attributes, trigger
intersections, and assert `trackComponentView` payload routing.

**Acceptance Scenarios**:

1. **Given** an observed element with valid entry data attributes, **When** dwell and visibility
   requirements are met, **Then** one component view event is sent through `trackComponentView`.
2. **Given** callback data passed through manual observation, **When** both callback data and
   dataset are present, **Then** callback data takes precedence for payload extraction.
3. **Given** missing entry identifier in callback and dataset, **When** callback executes, **Then**
   no event is sent and a warning is logged.

---

### User Story 2 - Observe and Unobserve Dynamic Entry Elements (Priority: P1)

As a runtime maintainer, I need newly-added/removed entry elements auto-managed so tracking stays
accurate during dynamic DOM updates.

**Why this priority**: Modern Web apps frequently add, remove, and reorder content nodes.

**Independent Test**: Use mutation-driven add/remove scenarios and verify automatic
observe/unobserve behavior plus move-coalescing semantics.

**Acceptance Scenarios**:

1. **Given** auto-observation is enabled, **When** entry elements are added to DOM, **Then** they
   are automatically observed for view tracking.
2. **Given** tracked entry elements are removed, **When** mutation processing runs, **Then**
   matching elements are unobserved.
3. **Given** a node move represented as remove+add in same mutation batch, **When** records are
   coalesced, **Then** no net add/remove callbacks are delivered.

---

### User Story 3 - Maintain Reliable Dwell/Retry Behavior Across Visibility Changes (Priority: P2)

As an SDK operator, I need dwell timing and retry handling to be robust across tab visibility
changes, callback failures, and disconnected elements so view tracking remains stable and bounded.

**Why this priority**: Reliability depends on deterministic retry/timer lifecycle behavior.

**Independent Test**: Simulate visible/hidden cycles, callback failures, and orphan elements; verify
dwell accumulation, retry backoff behavior, and cleanup semantics.

**Acceptance Scenarios**:

1. **Given** intermittent visibility, **When** an element is visible across multiple cycles,
   **Then** visible time accumulates until dwell threshold is reached and callback fires once.
2. **Given** callback failures while visible, **When** retries are permitted, **Then** retries are
   scheduled with exponential backoff plus jitter and without concurrent duplicate attempts.
3. **Given** tab hidden state, **When** timers/retries are active, **Then** processing pauses and
   resumes cleanly when tab becomes visible again.

---

### Edge Cases

- `autoTrackEntryViews` defaults to `false` and only auto-starts/stops with consent transitions when
  enabled.
- `parseSticky(undefined)` resolves to `false` for dataset-based extraction.
- Dataset variant index parsing must accept only digit-only safe integers; invalid values become
  `undefined`.
- Manual entry observation APIs are safe no-ops before observers are initialized.
- `startAutoTrackingEntryViews(options)` applies provided options to initially discovered elements;
  mutation-added elements use observer defaults.
- Element view callbacks must execute once per element after success or retry exhaustion.
- Mutation callbacks must deliver removals before additions for each processed batch.
- Non-DOM/SSR environments must degrade to no-op observer behavior.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `Optimization` MUST default `autoTrackEntryViews` to `false` when omitted.
- **FR-002**: `Optimization` MUST preserve explicit `autoTrackEntryViews: true` configuration.
- **FR-003**: Consent synchronization MUST start auto tracking when consent is truthy and
  `autoTrackEntryViews` is enabled.
- **FR-004**: Consent synchronization MUST stop auto tracking when consent is falsy/undefined and
  `autoTrackEntryViews` is enabled.
- **FR-005**: `startAutoTrackingEntryViews()` MUST create an `ElementViewObserver` using
  `createAutoTrackingEntryViewCallback`.
- **FR-006**: `startAutoTrackingEntryViews()` MUST create an `ElementExistenceObserver` using
  `createAutoTrackingEntryExistenceCallback(..., true)`.
- **FR-007**: `startAutoTrackingEntryViews()` MUST query `[data-ctfl-entry-id]` elements and observe
  each valid entry element.
- **FR-008**: `stopAutoTrackingEntryViews()` MUST disconnect both element existence and element view
  observers.
- **FR-009**: `trackEntryViewForElement()` MUST attempt to observe the provided element through
  `ElementViewObserver` when initialized.
- **FR-010**: `untrackEntryViewForElement()` MUST attempt to unobserve the provided element through
  `ElementViewObserver` when initialized.
- **FR-011**: `isEntryElement()` MUST return true only for DOM elements with non-empty
  `dataset.ctflEntryId`.
- **FR-012**: `createAutoTrackingEntryViewCallback` MUST accept callback data in `EntryData` form or
  derive payload data from `data-ctfl-*` attributes.
- **FR-013**: Callback data extraction MUST prioritize explicit callback `info.data` over element
  dataset.
- **FR-014**: Dataset sticky parsing MUST treat only case-insensitive `'true'` as true; all other
  values MUST resolve to false.
- **FR-015**: Dataset variant index parsing MUST return only non-negative safe integers parsed from
  digit-only strings; otherwise `undefined`.
- **FR-016**: Auto-tracking callback MUST call `core.trackComponentView` with
  `{ componentId, experienceId, sticky, variantIndex }` when entry ID is available.
- **FR-017**: Auto-tracking callback MUST skip event dispatch when entry ID cannot be resolved.
- **FR-018**: Existence observer callback MUST auto-observe added entry elements when auto-observe
  is enabled.
- **FR-019**: Existence observer callback MUST unobserve removed entry elements only when stats
  indicate they are currently tracked.
- **FR-020**: `ElementViewObserver` MUST accumulate visible time across multiple visibility cycles.
- **FR-021**: `ElementViewObserver` MUST invoke callback once per observed element after dwell
  threshold is met and callback succeeds, then unobserve that element.
- **FR-022**: `ElementViewObserver` MUST retry failed callbacks with per-element exponential backoff
  and jitter while respecting `maxRetries`.
- **FR-023**: `ElementViewObserver` MUST avoid duplicate concurrent callback attempts for the same
  element.
- **FR-024**: `ElementViewObserver` MUST pause dwell/retry timing when page visibility is hidden and
  resume when visible.
- **FR-025**: `ElementViewObserver` MUST expose readonly stats via `getStats()` and return `null`
  when state is not tracked.
- **FR-026**: `ElementViewObserver` MUST clear timers and state on `unobserve()` and `disconnect()`.
- **FR-027**: `ElementViewObserver` MUST periodically sweep orphaned/disconnected element states and
  stop sweeper when no active states remain.
- **FR-028**: `ElementExistenceObserver` MUST observe childList+subtree mutations, coalesce moves,
  filter to elements (including descendants), and batch deliveries in idle time.
- **FR-029**: `ElementExistenceObserver` MUST dispatch removal chunks before addition chunks.
- **FR-030**: `ElementExistenceObserver` MUST route sync/async callback failures to optional
  `onError`.

### Key Entities _(include if feature involves data)_

- **EntryElement**: DOM element with `data-ctfl-entry-id` and optional personalization attributes.
- **EntryData**: Normalized callback payload (`entryId`, `personalizationId`, `sticky`,
  `variantIndex`).
- **ElementViewObserver**: IntersectionObserver-based dwell/retry tracker for per-element callbacks.
- **ElementExistenceObserver**: MutationObserver-based add/remove detector for dynamic DOM tracking.
- **AutoTracking Callbacks**: Glue logic that transforms observer signals into component view
  events.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Auto-tracking tests confirm valid entry elements emit exactly one component view event
  per observed element after dwell conditions are satisfied.
- **SC-002**: Mutation tests confirm added elements are observed, removed elements are unobserved,
  and move-only mutations produce no net callbacks.
- **SC-003**: Dwell/retry tests confirm accumulation across visibility cycles, exponential retry
  behavior, and no duplicate concurrent attempts.
- **SC-004**: Cleanup tests confirm observer disconnect/unobserve paths clear timers/listeners/state
  and prevent further callback execution.
