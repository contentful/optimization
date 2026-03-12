# Feature Specification: Contentful Optimization Web Preview Panel

**Feature Branch**: `[018-web-preview-panel]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Attach the Preview Panel and Load Preview Data (Priority: P1)

As a Web SDK consumer, I need to attach a single preview panel instance and load all relevant
audience and personalization entries so editors can inspect personalization state in-page.

**Why this priority**: The feature is unusable unless the panel attaches reliably and receives data.

**Independent Test**: Call `attachOptimizationPreviewPanel(...)` in a browser-like environment and
verify one panel is appended, required elements are defined, preview bridge values resolve, and
audiences/personalizations are loaded.

**Acceptance Scenarios**:

1. **Given** no existing preview panel and a valid `registerPreviewPanel` bridge, **When**
   `attachOptimizationPreviewPanel` is called, **Then** the panel initializes, appends to
   `document.body`, and sets `signals.previewPanelAttached.value = true`.
2. **Given** an existing preview panel element in the DOM, **When** attachment is attempted again,
   **Then** the function throws and does not append a duplicate panel.
3. **Given** `registerPreviewPanel(...)` does not provide required symbol-keyed preview values,
   **When** attachment is attempted, **Then** the function throws an error.
4. **Given** a provided `nonce` value, **When** attachment starts, **Then** `window.litNonce` is set
   before Lit custom elements are defined.

---

### User Story 2 - Explore Audiences and Override Variants (Priority: P1)

As an editor, I need to browse audiences and choose variants from the panel so I can preview
personalization behavior for specific experiences.

**Why this priority**: Manual variant overrides are the core editor interaction for previewing.

**Independent Test**: Render the panel with fetched entries and simulate audience toggles, drawer
toggles, and variant selection events; verify grouping, ordering, and signal updates.

**Acceptance Scenarios**:

1. **Given** fetched audiences and personalizations, **When** the panel renders, **Then**
   personalizations are grouped by audience and entries without audience are grouped under the
   synthetic All Visitors audience.
2. **Given** personalizations containing `InlineVariable` components, **When** entries are prepared
   for rendering, **Then** those personalizations are excluded from the panel.
3. **Given** a valid `ctfl-opt-preview-personalization-change` event, **When** it is handled,
   **Then** the override map is updated and override-applied values are written to
   `signals.selectedPersonalizations.value`.
4. **Given** a valid `ctfl-opt-preview-panel-drawer-toggle` event, **When** it is handled, **Then**
   `signals.previewPanelOpen.value` is synchronized to event detail.

---

### User Story 3 - Keep Overrides and Reset in Sync with Optimization Signals (Priority: P2)

As an editor, I need override changes and reset behavior to stay synchronized with optimization
signals so preview state is deterministic and reversible.

**Why this priority**: Correct synchronization prevents stale or conflicting preview assignments.

**Independent Test**: Trigger optimization state updates, apply overrides, and reset; verify default
capture, override application, and restoration semantics.

**Acceptance Scenarios**:

1. **Given** optimization state interception is installed, **When** states update, **Then** default
   `selectedPersonalizations` are captured and returned state values are transformed by
   `applyPersonalizationOverrides(...)`.
2. **Given** active overrides, **When** the panel reset action is triggered, **Then** overrides are
   cleared and selected personalizations revert to captured defaults.
3. **Given** preview personalization change events that fail event-guard checks, **When** handlers
   run, **Then** no override mutation is applied.
4. **Given** `signals.profile` updates to a truthy profile, **When** effects run, **Then**
   `panel.profile` is synchronized.

---

### Edge Cases

- Contentful entry fetching follows cursor pagination until `pages.next` is `undefined`.
- A personalization with no `nt_audience` reference still appears under the synthetic All Visitors
  audience.
- Audiences with no qualifying personalizations render deterministic empty-state messaging.
- Attachment fails fast if preview signals/signalFns are unavailable from the Optimization instance.
- Duplicate panel attachment attempts fail fast to prevent conflicting listeners/state.
- Variant-change payload guards validate only `CustomEvent` shape with `detail.key` and
  `detail.value` presence.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `attachOptimizationPreviewPanel` MUST throw when `document` already contains a
  `ctfl-opt-preview-panel` element.
- **FR-002**: `attachOptimizationPreviewPanel` MUST assign provided `nonce` to `window.litNonce`
  before creating Lit-based elements when nonce is defined.
- **FR-003**: `attachOptimizationPreviewPanel` MUST call `optimization.registerPreviewPanel(...)`,
  then read bridge values from `PREVIEW_PANEL_SIGNALS_SYMBOL` and `PREVIEW_PANEL_SIGNAL_FNS_SYMBOL`,
  and MUST throw when either value is missing.
- **FR-004**: Entry loading MUST fetch all `nt_audience` and `nt_experience` entries using
  cursor-aware pagination.
- **FR-005**: Initialization MUST define custom elements for indicator, personalization, audience,
  and panel before appending the panel instance.
- **FR-006**: Panel data preparation MUST include only valid audience/personalization entries and
  MUST exclude personalizations containing `InlineVariable` components.
- **FR-007**: The panel instance MUST receive `overrides`, `audiences`, `personalizationEntries`,
  and initial `defaultSelectedPersonalizations`.
- **FR-008**: An Optimization state interceptor MUST capture default `selectedPersonalizations` and
  MUST return states with `selectedPersonalizations` transformed by
  `applyPersonalizationOverrides(...)`.
- **FR-009**: Handling `ctfl-opt-preview-panel-drawer-toggle` MUST update
  `signals.previewPanelOpen.value` when event guard checks pass.
- **FR-010**: Handling `ctfl-opt-preview-personalization-change` MUST update the override map and
  `signals.selectedPersonalizations.value` with override-applied selections.
- **FR-011**: Handling `ctfl-opt-preview-panel-reset` MUST clear overrides, restore captured default
  selected personalizations to signals, and refresh panel defaults.
- **FR-012**: `signalFns.effect(...)` wiring MUST update `panel.profile` from
  `signals.profile.value` when a profile value is available.
- **FR-013**: After append, attachment MUST set `signals.previewPanelAttached.value = true`.
- **FR-014**: The panel MUST group personalizations by audience and MUST use the synthetic All
  Visitors audience for personalizations without an audience reference.
- **FR-015**: The panel MUST maintain deterministic audience ordering using personalization counts
  and audience names, with deterministic personalization ordering within each audience.
- **FR-016**: Audience sections MUST maintain local expanded/collapsed state and update it from
  `ctfl_opt_preview_audience_content_toggle` events.
- **FR-017**: Audience sections MUST expose personalization variant choices through radio groups and
  MUST emit `ctfl-opt-preview-personalization-change` with personalization id and variant index.
- **FR-018**: Personalization change handlers MUST ignore events that fail
  `isRecordRadioGroupChangeEvent`.
- **FR-019**: Panel reset UI interaction MUST emit `ctfl-opt-preview-panel-reset`.
- **FR-020**: Audience and personalization rows MUST render qualification/selection indicators based
  on profile and override/default state.
- **FR-021**: Empty personalization collections MUST render explicit empty-state messaging in
  audience content.

### Key Entities _(include if feature involves data)_

- **PreviewPanelAttachment**: Host-side initialization flow that validates prerequisites, fetches
  entries, installs interceptors/listeners/effects, and appends `ctfl-opt-preview-panel`.
- **Preview Bridge**: Symbol-keyed object populated by `registerPreviewPanel(...)` with `signals`
  and `signalFns`.
- **AudienceEntry**: Contentful `nt_audience` entry rendered as an expandable audience group.
- **PersonalizationEntry**: Contentful `nt_experience` entry with variant configuration shown as
  radio options.
- **PersonalizationOverrideMap**: `Map<personalizationId, variantIndex>` used to persist manual
  overrides.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Attachment checks confirm exactly one preview panel can exist, duplicate attachment
  throws, and bridge validation enforces required symbol-keyed values.
- **SC-002**: Data-loading checks confirm all paginated audiences/personalizations are retrieved and
  inline-variable personalizations are excluded from panel rendering.
- **SC-003**: Interaction checks confirm valid drawer/variant events synchronize preview-related
  signals and override state.
- **SC-004**: Interceptor and reset checks confirm defaults are captured, overrides are applied in
  returned state, and reset restores captured defaults.
- **SC-005**: UI-state checks confirm deterministic grouping/ordering and explicit empty-state
  rendering for audiences without personalizations.
