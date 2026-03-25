# Feature Specification: Experience API Request, Event, and Response Schemas

**Feature Branch**: `[003-experience-api-schemas]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate Outbound Experience Payloads (Priority: P1)

As an API client developer, I need request schemas that reject malformed or empty event payloads
before transport.

**Why this priority**: Request validation prevents avoidable API failures.

**Independent Test**: Parse valid and empty event payloads with both request schemas.

**Acceptance Scenarios**:

1. **Given** at least one valid event, **When** parsed by `ExperienceRequestData`, **Then** parsing
   succeeds.
2. **Given** an empty `events` array, **When** parsed by `ExperienceRequestData` or
   `BatchExperienceRequestData`, **Then** parsing fails.

---

### User Story 2 - Validate Experience Response Envelopes (Priority: P2)

As a runtime integrator, I need response envelope validation so inbound Experience API payloads are
trusted before use.

**Why this priority**: Response contracts protect downstream personalization logic.

**Independent Test**: Parse valid and invalid `ExperienceResponse` and `BatchExperienceResponse`
objects.

**Acceptance Scenarios**:

1. **Given** a response with valid envelope fields and typed `data`, **When** parsed, **Then**
   parsing succeeds.
2. **Given** missing `message` or invalid `error`, **When** parsed, **Then** parsing fails.

---

### User Story 3 - Maintain One Typed Event/Profile Taxonomy (Priority: P3)

As a schema maintainer, I need complete event/profile/change contracts so Experience and Insights
reuse one consistent source.

**Why this priority**: Shared contracts prevent drift between SDK layers.

**Independent Test**: Parse each event variant and related profile/change entities.

**Acceptance Scenarios**:

1. **Given** events of type `alias`, `component`, `group`, `identify`, `page`, `screen`, and
   `track`, **When** parsed by `ExperienceEvent`, **Then** valid variants are accepted.
2. **Given** batch events missing `anonymousId`, **When** parsed by `BatchExperienceEvent`, **Then**
   parsing fails.

---

### Edge Cases

- `originalTimestamp`, `sentAt`, and `timestamp` must be ISO datetime strings.
- `GeoLocation.countryCode` must be exactly two characters when present.
- `UnknownChange` may parse unknown change payloads, but `Change` currently accepts only
  `VariableChange`.
- `BatchExperienceResponseData.profiles` may be omitted.
- `PageViewEvent` and `ScreenViewEvent` must enforce page/screen-specific context shapes.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ExperienceRequestData.events` MUST enforce minimum length `1`.
- **FR-002**: `BatchExperienceRequestData.events` MUST enforce minimum length `1`.
- **FR-003**: Both request schemas MUST allow optional `options.features: string[]`.
- **FR-004**: `ExperienceEvent` MUST be a discriminated union of `AliasEvent`, `ViewEvent`,
  `GroupEvent`, `IdentifyEvent`, `PageViewEvent`, `ScreenViewEvent`, and `TrackEvent`.
- **FR-005**: `BatchExperienceEvent` MUST extend each `ExperienceEvent` variant with required
  `anonymousId: string`.
- **FR-006**: `UniversalEventProperties` MUST require `channel`, `context`, `messageId`,
  `originalTimestamp`, `sentAt`, and `timestamp`.
- **FR-007**: `UniversalEventContext` MUST require `campaign`, `gdpr.isConsentGiven`, `library`, and
  `locale`; it MAY include `app`, `location`, and `userAgent`.
- **FR-008**: `ViewEvent` MUST require `componentType`, `componentId`, `variantIndex`, `viewId`, and
  `viewDurationMs`; `experienceId` MAY be omitted.
- **FR-009**: `PageViewEvent` MUST require `properties: Page` and `context: PageEventContext`;
  `name` is optional.
- **FR-010**: `ScreenViewEvent` MUST require `name` and `context: ScreenEventContext`; `properties`
  is optional.
- **FR-011**: `TrackEvent` MUST require `event` and `properties: Properties`.
- **FR-012**: `ResponseEnvelope` MUST require `data`, `message`, and `error` where `error` is
  `boolean | null`.
- **FR-013**: `ExperienceResponse.data` MUST include `profile`, `experiences`, and `changes`.
- **FR-014**: `BatchExperienceResponse.data` MUST include optional `profiles: Profile[]`.
- **FR-015**: `Profile` MUST require `id`, `stableId`, `random`, `audiences`, `traits`, `location`,
  and `session`.
- **FR-016**: `PartialProfile` MUST require `id` and allow additional JSON values via catchall.
- **FR-017**: `SelectedOptimization.sticky` MUST default to `false` when omitted.
- **FR-018**: `Change` MUST be a discriminated union containing `VariableChange`; `UnknownChange`
  MUST remain available as a separate schema.

### Key Entities _(include if feature involves data)_

- **ExperienceRequestData**: Single-request payload (`events` + optional `options`).
- **BatchExperienceRequestData**: Batch payload requiring `BatchExperienceEvent[]`.
- **ExperienceEvent**: Runtime union of supported Experience event variants.
- **ResponseEnvelope**: Shared API envelope (`data`, `message`, `error`).
- **ExperienceResponse / BatchExperienceResponse**: Typed response contracts.
- **Profile / PartialProfile**: Full profile and partial profile payload schemas.
- **Change / VariableChange / UnknownChange**: Change contracts for flag/personalization effects.
- **SelectedOptimization**: Experience variant selection result schema.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Empty request event arrays are rejected by both request schemas.
- **SC-002**: All seven supported `ExperienceEvent` variants parse successfully when valid.
- **SC-003**: `BatchExperienceEvent` rejects items without `anonymousId`.
- **SC-004**: Response schemas accept valid envelope/data payloads and reject invalid envelope
  fields.
