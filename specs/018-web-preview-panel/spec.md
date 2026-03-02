# Feature Specification: Optimization Web Preview Panel

**Feature Branch**: `[018-web-preview-panel]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Attach the Preview Panel and Load Preview Data (Priority: P1)

As a Web SDK consumer, I need to attach a single preview panel instance and load all relevant
audience and personalization entries so editors can inspect personalization state in-page.

**Why this priority**: The feature is unusable unless the panel attaches reliably and receives data.

**Independent Test**: Call `attachOptimizationPreviewPanel(...)` in a browser-like environment and
verify one panel is appended, required elements are defined, and audiences/personalizations are
loaded.

**Acceptance Scenarios**:

1. **Given** no existing preview panel and a valid `Optimization` preview registration, **When**
   `attachOptimizationPreviewPanel` is called, **Then** the panel initializes and is appended to
   `document.body`.
2. **Given** an existing preview panel element in the DOM, **When** attachment is attempted again,
   **Then** the function throws and does not append a duplicate panel.
3. **Given** `optimization.registerPreviewPanel()` does not provide required preview signals,
   **When** attachment is attempted, **Then** the function throws an error.

---

### User Story 2 - Explore Audiences and Override Variants (Priority: P1)

As an editor, I need to browse audiences and choose variants from the panel so I can preview
personalization behavior for specific experiences.

**Why this priority**: Manual variant overrides are the core editor interaction for previewing.

**Independent Test**: Render the panel with fetched entries and simulate audience toggles and
variant selection events; verify grouping, ordering, and signal updates.

**Acceptance Scenarios**:

1. **Given** fetched audiences and personalizations, **When** the panel renders, **Then**
   personalizations are grouped by audience and entries without audience are grouped under the
   synthetic "All Visitors" audience.
2. **Given** personalizations containing `InlineVariable` components, **When** entries are prepared
   for rendering, **Then** those personalizations are excluded from the panel.
3. **Given** a variant radio change in an audience section, **When** a valid
   `ctfl-opt-preview-personalization-change` event is emitted, **Then** the selected override is
   stored and propagated to optimization personalizations.

---

### User Story 3 - Keep Overrides and Reset in Sync with Optimization Signals (Priority: P2)

As an editor, I need override changes and reset behavior to stay synchronized with optimization
signals so the preview state is deterministic and reversible.

**Why this priority**: Correct synchronization prevents stale or conflicting preview assignments.

**Independent Test**: Trigger optimization state updates, apply overrides, and press reset; verify
default capture, override application, and restoration semantics.

**Acceptance Scenarios**:

1. **Given** optimization states are intercepted, **When** states update, **Then** default
   personalizations are captured and overrides are applied to returned state values.
2. **Given** one or more active overrides, **When** the panel reset action is triggered, **Then**
   overrides are cleared and optimization personalizations revert to captured defaults.
3. **Given** malformed personalization change events, **When** event payload guards fail, **Then**
   no override mutation is applied.

---

### Edge Cases

- Contentful entry fetching must follow cursor pagination until all pages are collected.
- A personalization with no `nt_audience` reference must still appear under an "All Visitors"
  fallback.
- Audiences with no qualifying personalizations must render deterministic empty-state messaging.
- Attachment must fail fast if preview signals are unavailable from the Optimization instance.
- Duplicate panel attachment attempts must fail fast to prevent conflicting listeners/state.
- Invalid or non-`CustomEvent` variant-change payloads must be ignored by event guards.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `attachOptimizationPreviewPanel` MUST throw when `document` already contains a
  `ctfl-opt-preview-panel` element.
- **FR-002**: `attachOptimizationPreviewPanel` MUST assign the provided `cspNonce` to
  `window.litNonce` before creating Lit-based elements.
- **FR-003**: `attachOptimizationPreviewPanel` MUST call `optimization.registerPreviewPanel()` and
  MUST throw when required `signals` or `signalFns` are missing.
- **FR-004**: Entry loading MUST fetch all `nt_audience` and `nt_experience` entries using
  cursor-aware pagination.
- **FR-005**: Initialization MUST define custom elements for indicator, personalization, audience,
  and panel before appending the panel instance.
- **FR-006**: Panel data preparation MUST include only valid audience/personalization entries and
  MUST exclude personalizations containing `InlineVariable` components.
- **FR-007**: The panel instance MUST receive `signals`, `signalFns`, audiences, personalizations,
  and the initial `defaultSelectedPersonalizations`.
- **FR-008**: An Optimization state interceptor MUST capture default personalizations and MUST
  return states with personalizations transformed by `applyPersonalizationOverrides(...)`.
- **FR-009**: Handling `ctfl-opt-preview-personalization-change` MUST update the override map and
  `signals.personalizations.value` with override-applied personalizations.
- **FR-010**: Handling `ctfl-opt-preview-panel-reset` MUST clear overrides, restore default
  personalizations to signals, and refresh panel defaults.
- **FR-011**: The panel MUST group personalizations by audience and MUST use the synthetic "All
  Visitors" audience for personalizations without an audience reference.
- **FR-012**: The panel MUST maintain deterministic audience ordering using audience metadata and
  associated personalization counts.
- **FR-013**: Audience sections MUST maintain local expanded/collapsed state and update it from
  `ctfl_opt_preview_audience_content_toggle` events.
- **FR-014**: Audience sections MUST expose personalization variant choices through radio groups and
  MUST emit `ctfl-opt-preview-personalization-change` with personalization id and variant index.
- **FR-015**: Personalization change handlers MUST ignore malformed/non-`CustomEvent` payloads that
  fail payload guards.
- **FR-016**: Panel reset UI interaction MUST emit `ctfl-opt-preview-panel-reset`.
- **FR-017**: Audience and personalization rows MUST render qualification/selection indicators based
  on profile and override state.
- **FR-018**: Empty personalization collections MUST render explicit empty-state messaging in
  audience content.

### Key Entities _(include if feature involves data)_

- **PreviewPanelAttachment**: Host-side initialization flow that validates prerequisites, fetches
  entries, installs interceptors/listeners, and appends `ctfl-opt-preview-panel`.
- **AudienceEntry**: Contentful `nt_audience` entry rendered as an expandable audience group.
- **PersonalizationEntry**: Contentful `nt_experience` entry with variant configuration shown as
  radio options.
- **PersonalizationOverrideMap**: `Map<personalizationId, variantIndex>` used to persist manual
  overrides.
- **PreviewSignals**: Optimization `signals` and `signalFns` used to read/update runtime
  personalization state.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Attachment tests confirm exactly one preview panel can exist and duplicate attachment
  throws.
- **SC-002**: Data loading tests confirm all paginated audiences/personalizations are retrieved and
  inline variable personalizations are excluded from panel rendering.
- **SC-003**: Interaction tests confirm valid variant-change events mutate overrides and immediately
  update optimization personalization signals.
- **SC-004**: Interceptor tests confirm default personalizations are captured and override
  application is reflected in returned optimization state.
- **SC-005**: Reset tests confirm override map is emptied and optimization personalizations revert
  to captured defaults.
