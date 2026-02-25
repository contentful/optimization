# Feature Specification: Insights API Event and Batch Ingestion Schemas

**Feature Branch**: `[004-insights-api-schemas]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Derive SpecKit-compatible specifications for Insights API schemas in
`@contentful/optimization-api-schemas`."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate Insights Events Prior to Send (Priority: P1)

As an analytics pipeline developer, I need a schema for Insights events so only valid event types
are accepted before sending to the Insights API.

**Why this priority**: Analytics ingestion should reject invalid events before transport attempts.

**Independent Test**: Parse valid and invalid insight event payloads through `InsightsEvent`.

**Acceptance Scenarios**:

1. **Given** a valid component view event payload, **When** parsed with `InsightsEvent`, **Then**
   parsing succeeds.
2. **Given** a non-supported event type payload, **When** parsed with `InsightsEvent`, **Then**
   parsing fails.

---

### User Story 2 - Validate Batched Insights Request Bodies (Priority: P2)

As an SDK client implementer, I need a batched schema contract that pairs profile identity with
events so request bodies match ingestion API expectations.

**Why this priority**: Batch structure is the direct transport payload for Insights ingestion.

**Independent Test**: Parse batch payloads that vary profile completeness and event list
composition.

**Acceptance Scenarios**:

1. **Given** a batch payload with `profile.id` and valid events, **When** parsed with
   `BatchInsightsEvent`, **Then** parsing succeeds.
2. **Given** a batch payload missing `profile.id`, **When** parsed with `BatchInsightsEvent`,
   **Then** parsing fails.

---

### User Story 3 - Preserve Cross-Domain Contract Reuse (Priority: P3)

As a maintainer, I need Insights schemas to reuse Experience-domain primitives so event/profile
compatibility remains consistent across APIs.

**Why this priority**: Reuse prevents drift between personalization and analytics data contracts.

**Independent Test**: Verify `InsightsEvent` and `BatchInsightsEvent` are composed from
`ComponentViewEvent` and `PartialProfile` contracts.

**Acceptance Scenarios**:

1. **Given** updates to shared component event or profile schemas, **When** Insights schemas are
   parsed, **Then** behavior remains aligned with shared primitives.
2. **Given** batch arrays of profile+events objects, **When** parsed with `BatchInsightsEventArray`,
   **Then** each element enforces identical schema rules.

---

### Edge Cases

- Batch payloads with empty `events` arrays are currently valid and must remain parseable unless the
  contract is intentionally tightened.
- Unsupported insight event discriminators must be rejected.
- Profile payloads may include additional JSON fields, but must always include `id`.
- Component events missing required identifiers (`componentId`) must fail parsing.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `InsightsEvent` MUST be a discriminated union keyed by `type`.
- **FR-002**: The current `InsightsEvent` union MUST include `ComponentViewEvent` as the supported
  event variant.
- **FR-003**: `InsightsEventArray` MUST represent an array of `InsightsEvent`.
- **FR-004**: `BatchInsightsEvent` MUST require a `profile` object validated by `PartialProfile`.
- **FR-005**: `BatchInsightsEvent` MUST require an `events` array validated by `InsightsEventArray`.
- **FR-006**: `BatchInsightsEventArray` MUST represent an array of `BatchInsightsEvent`.
- **FR-007**: Insights contracts MUST reuse Experience-domain shared schemas (`ComponentViewEvent`,
  `PartialProfile`) rather than duplicate equivalent schema definitions.
- **FR-008**: Insights domain barrels MUST export event and batch schema contracts through
  `insights/index.ts` and `insights/event/index.ts`.

### Key Entities _(include if feature involves data)_

- **InsightsEvent**: Valid analytics event contract for Insights ingestion.
- **InsightsEventArray**: Collection of analytics events for a profile context.
- **BatchInsightsEvent**: One profile-scoped batch payload containing events.
- **BatchInsightsEventArray**: Multi-batch request payload structure.
- **PartialProfile**: Shared profile contract requiring `id` plus optional JSON attributes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Valid component-view events parse successfully through `InsightsEvent`.
- **SC-002**: Unsupported event types are rejected by `InsightsEvent` parsing.
- **SC-003**: Batch payloads without `profile.id` are rejected by `BatchInsightsEvent`.
- **SC-004**: Array-level validation applies consistently for every element in
  `BatchInsightsEventArray`.
