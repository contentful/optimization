# Feature Specification: Insights API Event and Batch Ingestion Schemas

**Feature Branch**: `[004-insights-api-schemas]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate Insights Event Variants Before Send (Priority: P1)

As an analytics developer, I need strict event schema validation so only supported Insights event
types are accepted before transport.

**Why this priority**: Invalid event types should fail before any network call.

**Independent Test**: Parse view, click, and hover payloads through `InsightsEvent`.

**Acceptance Scenarios**:

1. **Given** valid `component`, `component_click`, and `component_hover` payloads, **When** parsed
   with `InsightsEvent`, **Then** parsing succeeds.
2. **Given** an unsupported `type`, **When** parsed with `InsightsEvent`, **Then** parsing fails.

---

### User Story 2 - Validate Profile-Scoped Batch Payloads (Priority: P2)

As an SDK client implementer, I need batch schemas that pair a profile with an events array so
request bodies match ingestion contracts.

**Why this priority**: `BatchInsightsEvent` is the direct wire payload used by Insights API client
calls.

**Independent Test**: Parse batch payloads with valid and invalid profile/event shapes.

**Acceptance Scenarios**:

1. **Given** `profile.id` and valid events, **When** parsed with `BatchInsightsEvent`, **Then**
   parsing succeeds.
2. **Given** a missing `profile.id`, **When** parsed with `BatchInsightsEvent`, **Then** parsing
   fails.

---

### User Story 3 - Reuse Experience-Domain Primitives (Priority: P3)

As a maintainer, I need Insights schemas to reuse shared Experience contracts so common
event/profile rules stay aligned.

**Why this priority**: Reuse prevents duplicated schema logic and contract drift.

**Independent Test**: Confirm composition from `ViewEvent`, `InteractionEventProperties`, and
`PartialProfile`.

**Acceptance Scenarios**:

1. **Given** shared event/profile schema updates, **When** Insights schemas are parsed, **Then**
   they follow the updated shared behavior.
2. **Given** multiple batch entries, **When** parsed with `BatchInsightsEventArray`, **Then** each
   item applies identical validation.

---

### Edge Cases

- `BatchInsightsEvent.events` currently allows empty arrays (no minimum length check).
- `HoverEvent` requires both `hoverId` and `hoverDurationMs`.
- `ClickEvent` and `HoverEvent` must still satisfy shared interaction fields (`componentType`,
  `componentId`, `variantIndex`, etc.).
- `PartialProfile` allows additional JSON attributes but always requires `id`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `InsightsEvent` MUST be a discriminated union keyed by `type`.
- **FR-002**: `InsightsEvent` MUST include `ViewEvent` (`type: 'component'`), `ClickEvent`
  (`type: 'component_click'`), and `HoverEvent` (`type: 'component_hover'`).
- **FR-003**: `InsightsEventArray` MUST be `InsightsEvent[]`.
- **FR-004**: `BatchInsightsEvent` MUST require `profile: PartialProfile`.
- **FR-005**: `BatchInsightsEvent` MUST require `events: InsightsEventArray`.
- **FR-006**: `BatchInsightsEventArray` MUST be `BatchInsightsEvent[]`.
- **FR-007**: `ClickEvent` MUST extend `InteractionEventProperties` with literal
  `type: 'component_click'`.
- **FR-008**: `HoverEvent` MUST extend `InteractionEventProperties` with literal
  `type: 'component_hover'`, plus `hoverId` and `hoverDurationMs`.
- **FR-009**: Insights domain exports MUST expose `BatchInsightsEvent`, `ClickEvent`, `HoverEvent`,
  and `InsightsEvent` from `insights/event/index.ts`, re-exported by `insights/index.ts`.

### Key Entities _(include if feature involves data)_

- **InsightsEvent**: Union of supported Insights analytics event variants.
- **ClickEvent / HoverEvent**: Interaction event variants specific to click and hover tracking.
- **InsightsEventArray**: Event collection for one profile scope.
- **BatchInsightsEvent**: Profile plus events payload entry.
- **BatchInsightsEventArray**: Multi-profile batch payload.
- **PartialProfile**: Shared profile schema with required `id` and JSON catchall.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Valid `component`, `component_click`, and `component_hover` events parse successfully.
- **SC-002**: Unsupported event types fail `InsightsEvent` parsing.
- **SC-003**: Batch payloads without `profile.id` fail validation.
- **SC-004**: Array validation applies per element for `BatchInsightsEventArray`.
