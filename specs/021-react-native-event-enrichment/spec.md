# Feature Specification: Optimization React Native Event Enrichment

**Feature Branch**: `[021-react-native-event-enrichment]` **Created**: 2026-02-26 **Status**: Draft
**Input**: User description: "Examine the current functionality in
`@contentful/optimization-react-native` package and derive SpecKit-compatible specifications that
could have guided its development."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Apply Mobile Event Metadata Defaults (Priority: P1)

As an SDK integrator, I need default mobile event metadata set automatically so emitted events carry
stable source attribution without extra configuration.

**Why this priority**: Event metadata consistency is required for downstream attribution and
analysis.

**Independent Test**: Initialize `Optimization` with minimal config and assert merged
`eventBuilder.channel` and `eventBuilder.library` defaults.

**Acceptance Scenarios**:

1. **Given** SDK initialization with no event-builder overrides, **When** merged config is resolved,
   **Then** `eventBuilder.channel` is `'mobile'`.
2. **Given** SDK initialization with no event-builder library override, **When** merged config is
   resolved, **Then** `eventBuilder.library.name` and `eventBuilder.library.version` are populated
   from SDK metadata constants.
3. **Given** build-time metadata replacement is unavailable, **When** defaults are resolved,
   **Then** fallback package name/version values are used.

---

### User Story 2 - Preserve Consumer Event Builder Overrides (Priority: P1)

As an SDK consumer, I need to override event-builder fields while retaining unspecified React Native
defaults so enrichment behavior can be customized incrementally.

**Why this priority**: Real integrations frequently customize only part of event-builder behavior.

**Independent Test**: Provide partial and full `eventBuilder` overrides and verify deep-merge
behavior preserves non-overridden defaults.

**Acceptance Scenarios**:

1. **Given** a custom `eventBuilder.channel`, **When** config is merged, **Then** the custom channel
   overrides the default.
2. **Given** a partial `eventBuilder.library` override (for example, name only), **When** config is
   merged, **Then** unspecified library fields retain default values.
3. **Given** additional event-builder fields supplied by the consumer, **When** config is merged,
   **Then** those fields are preserved in the final event-builder configuration.

---

### User Story 3 - Align RN Enrichment Scope with Core Support Boundaries (Priority: P2)

As a maintainer, I need React Native enrichment defaults scoped to metadata only because currently
Core's built-in function enrichers are intended for server-side and Web environments, not mobile.

**Why this priority**: This avoids implying first-class React Native support for enrichment
functions that are outside current Core support boundaries.

**Independent Test**: Initialize SDK without function-based event-builder overrides and verify the
React Native merge layer contributes only channel/library defaults; then provide explicit function
overrides and verify they pass through unchanged.

**Acceptance Scenarios**:

1. **Given** no consumer-supplied function-based event-builder overrides, **When** merge runs,
   **Then** the React Native merge layer only contributes channel/library defaults.
2. **Given** consumer-supplied function-based event-builder values, **When** merge runs, **Then**
   those values are preserved unchanged.
3. **Given** React Native SDK usage where `page(...)` is technically callable via inherited Core
   APIs, **When** defining React Native enrichment scope, **Then** `page` enrichment is treated as a
   non-explicit feature with no RN-specific enrichment helper defaults.

---

### Edge Cases

- Partial nested overrides (for example, only `eventBuilder.library.name`) must keep missing nested
  defaults (for example, default `library.version`).
- Explicit consumer channel overrides must replace `'mobile'`.
- Fallback metadata constants must remain valid when build-time define replacement is absent.
- React Native event enrichment scope intentionally omits built-in function enrichers because
  current Core built-in enrichers are server/web-oriented.
- `page` event emission remains technically possible through inherited Core APIs but is outside
  explicitly supported React Native enrichment behavior.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: React Native config merging MUST set default `eventBuilder.channel` to `'mobile'`.
- **FR-002**: React Native config merging MUST set default `eventBuilder.library.name` to
  `OPTIMIZATION_REACT_NATIVE_SDK_NAME`.
- **FR-003**: React Native config merging MUST set default `eventBuilder.library.version` to
  `OPTIMIZATION_REACT_NATIVE_SDK_VERSION`.
- **FR-004**: React Native config merging MUST deep-merge caller config with defaults.
- **FR-005**: Caller-provided `eventBuilder.channel` MUST override the default channel value.
- **FR-006**: Caller-provided partial `eventBuilder.library` values MUST override only specified
  fields while preserving unspecified default library fields.
- **FR-007**: Caller-provided additional `eventBuilder` fields MUST be preserved in merged config.
- **FR-008**: React Native config merging MUST omit built-in function-based event-builder enrichers
  by default because current Core built-in function enrichers target server-side and Web contexts.
- **FR-009**: Consumer-supplied function-based `eventBuilder` values MUST be preserved unchanged by
  merge behavior.
- **FR-010**: `OPTIMIZATION_REACT_NATIVE_SDK_NAME` MUST resolve to build-time replacement when
  available, otherwise `'@contentful/optimization-react-native'`.
- **FR-011**: `OPTIMIZATION_REACT_NATIVE_SDK_VERSION` MUST resolve to build-time replacement when
  available, otherwise `'0.0.0'`.
- **FR-012**: Event-builder library defaults MUST always remain non-empty and valid through
  build-time and fallback constant resolution.
- **FR-013**: `page(...)` event emission MAY still occur through inherited Core APIs, but React
  Native event enrichment contracts MUST NOT define dedicated RN helper defaults for `page`
  enrichment.

### Key Entities _(include if feature involves data)_

- **Event Builder Defaults**: React Native-provided channel/library baseline metadata.
- **Event Builder Overrides**: Caller-supplied event-builder fields merged into runtime config.
- **SDK Metadata Constants**: Build-time or fallback package identity values used for library
  metadata.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Initialization tests confirm merged defaults include `channel='mobile'` and library
  name/version metadata.
- **SC-002**: Override tests confirm deep-merge behavior for channel/library and preservation of
  additional event-builder fields.
- **SC-003**: Regression tests confirm React Native merge logic applies metadata defaults only and
  does not inject built-in function enrichers.
- **SC-004**: Constant-resolution tests confirm build-time replacements and fallback values both
  produce valid library metadata.
