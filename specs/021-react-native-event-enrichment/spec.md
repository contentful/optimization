# Feature Specification: Optimization React Native Event Enrichment

**Feature Branch**: `[021-react-native-event-enrichment]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Apply React Native Event Metadata Defaults (Priority: P1)

As an SDK integrator, I need React Native channel/library metadata set automatically so outgoing
events are attributed to the mobile SDK without extra setup.

**Why this priority**: Event metadata consistency is required for downstream attribution and
analysis.

**Independent Test**: Initialize `ContentfulOptimization` with minimal config and inspect merged
`eventBuilder` defaults.

**Acceptance Scenarios**:

1. **Given** no caller `eventBuilder.channel`, **When** React Native merge runs, **Then**
   `eventBuilder.channel` defaults to `'mobile'`.
2. **Given** no caller `eventBuilder.library` override, **When** merge runs, **Then**
   `eventBuilder.library.name` and `eventBuilder.library.version` resolve from SDK constants.
3. **Given** build-time define replacement is unavailable, **When** constants are resolved, **Then**
   fallback package name/version values are used.

---

### User Story 2 - Preserve Caller Event-Builder Overrides via Deep Merge (Priority: P1)

As an SDK consumer, I need caller-supplied event-builder fields to override defaults without losing
unspecified nested defaults.

**Why this priority**: Integrations often customize only selected event-builder fields.

**Independent Test**: Provide partial/full `eventBuilder` overrides and verify merged output.

**Acceptance Scenarios**:

1. **Given** caller `eventBuilder.channel`, **When** merge runs, **Then** caller channel overrides
   `'mobile'`.
2. **Given** caller provides partial `eventBuilder.library` (for example only `name`), **When**
   merge runs, **Then** unspecified library fields retain React Native defaults.
3. **Given** caller supplies additional `eventBuilder` fields (including functions), **When** merge
   runs, **Then** those fields are preserved.

---

### User Story 3 - Keep React Native Enrichment Scope Limited to Metadata Defaults (Priority: P2)

As a maintainer, I need React Native merge behavior to inject only mobile metadata defaults and not
inject additional function-based enrichers.

**Why this priority**: Keeps React Native enrichment scope explicit and predictable.

**Independent Test**: Compare merged config with and without caller function-based event-builder
fields.

**Acceptance Scenarios**:

1. **Given** no caller function-based event-builder fields, **When** merge runs, **Then** React
   Native contributes only channel/library defaults.
2. **Given** caller function-based event-builder fields, **When** merge runs, **Then** those values
   pass through unchanged.

---

### Edge Cases

- Nested override behavior must preserve unspecified nested defaults.
- Explicit caller channel override must replace `'mobile'`.
- Metadata constants must remain valid when build-time define replacement is absent.
- React Native merge must not add extra event-builder helper functions by default.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: React Native merge logic MUST default `eventBuilder.channel` to `'mobile'`.
- **FR-002**: React Native merge logic MUST default `eventBuilder.library.name` to
  `OPTIMIZATION_REACT_NATIVE_SDK_NAME`.
- **FR-003**: React Native merge logic MUST default `eventBuilder.library.version` to
  `OPTIMIZATION_REACT_NATIVE_SDK_VERSION`.
- **FR-004**: React Native merge logic MUST deep-merge caller config with React Native defaults.
- **FR-005**: Caller-provided `eventBuilder.channel` MUST override React Native channel default.
- **FR-006**: Caller-provided partial `eventBuilder.library` values MUST override only provided
  fields while preserving unspecified defaults.
- **FR-007**: Caller-provided additional `eventBuilder` fields MUST be preserved in merged config.
- **FR-008**: React Native merge layer MUST only inject channel/library metadata defaults and MUST
  NOT inject additional function-based event-builder defaults.
- **FR-009**: Caller-supplied function-based event-builder fields MUST be preserved unchanged.
- **FR-010**: `OPTIMIZATION_REACT_NATIVE_SDK_NAME` MUST resolve from build-time replacement when
  available, otherwise `'@contentful/optimization-react-native'`.
- **FR-011**: `OPTIMIZATION_REACT_NATIVE_SDK_VERSION` MUST resolve from build-time replacement when
  available, otherwise `'0.0.0'`.
- **FR-012**: Event-builder library defaults MUST remain defined and usable through both build-time
  and fallback constant resolution.

### Key Entities _(include if feature involves data)_

- **React Native Event Metadata Defaults**: Channel/library defaults injected at merge time.
- **Caller Event-Builder Overrides**: User-supplied fields merged into runtime event-builder config.
- **SDK Metadata Constants**: Package name/version values used for event library attribution.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Merge tests confirm `channel='mobile'` and library name/version defaults are applied
  when omitted.
- **SC-002**: Override tests confirm deep-merge behavior for channel/library and preservation of
  additional event-builder fields.
- **SC-003**: Scope tests confirm React Native merge contributes metadata defaults only and does not
  inject extra function enrichers.
- **SC-004**: Constant-resolution tests confirm build-time replacement and fallback values both
  produce valid metadata.
