# Feature Specification: Experience API Request, Event, and Response Schemas

**Feature Branch**: `[003-experience-api-schemas]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate Outbound Experience Requests (Priority: P1)

As an API client developer, I need request payload schemas for single and batch experience calls so
outbound events are validated before network transmission.

**Why this priority**: Bad outbound requests cause immediate API errors and downstream behavior
drift.

**Independent Test**: Validate request payloads with empty and non-empty event arrays for both
single and batch request schemas.

**Acceptance Scenarios**:

1. **Given** a request with at least one valid experience event, **When** parsed as
   `ExperienceRequestData`, **Then** parsing succeeds.
2. **Given** a request with zero events, **When** parsed as `ExperienceRequestData`, **Then**
   parsing fails.

---

### User Story 2 - Validate Inbound Experience Responses (Priority: P2)

As a runtime integrator, I need response envelope/data schemas so received Experience API payloads
can be trusted before they enter personalization logic.

**Why this priority**: Response parsing protects core logic and state from malformed API data.

**Independent Test**: Parse standard and batch response fixtures, including invalid envelopes.

**Acceptance Scenarios**:

1. **Given** a valid experience response envelope with profile, experiences, and changes, **When**
   parsed with `ExperienceResponse`, **Then** parsing succeeds.
2. **Given** a response missing required envelope fields (`message`, `error`), **When** parsed,
   **Then** parsing fails.

---

### User Story 3 - Maintain a Typed Event and Profile Taxonomy (Priority: P3)

As a schema maintainer, I need a complete discriminated event model and profile/change primitives so
all personalization and analytics builders share one contract source.

**Why this priority**: A unified event/profile contract prevents divergence between builders and API
client layers.

**Independent Test**: Parse each event variant and verify discriminator behavior plus per-variant
required fields.

**Acceptance Scenarios**:

1. **Given** event payloads for `alias`, `component`, `group`, `identify`, `page`, `screen`, and
   `track`, **When** parsed with `ExperienceEvent`, **Then** all valid variants are accepted.
2. **Given** batch events missing `anonymousId`, **When** parsed with `BatchExperienceEvent`,
   **Then** parsing fails.

---

### Edge Cases

- Timestamp fields must be ISO datetime strings and fail validation on malformed values.
- `countryCode` in geo-location must be exactly two characters when present.
- Unknown change objects may parse with `UnknownChange`, but the `Change` discriminated union must
  currently only accept `Variable`.
- `BatchExperienceResponseData.profiles` may be omitted entirely.
- `PageViewEvent` and `ScreenViewEvent` must enforce page/screen-specific context overrides.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ExperienceRequestData` MUST require `events` and enforce minimum length of 1.
- **FR-002**: `BatchExperienceRequestData` MUST require `events` and enforce minimum length of 1.
- **FR-003**: Request schemas MUST support optional request options with optional
  `features: string[]`.
- **FR-004**: `ExperienceEvent` MUST be a discriminated union over `alias`, `component`, `group`,
  `identify`, `page`, `screen`, and `track`.
- **FR-005**: `BatchExperienceEvent` MUST mirror `ExperienceEvent` variants and require
  `anonymousId` on every variant.
- **FR-006**: Universal event contracts MUST require channel, context, message identifier, and three
  ISO datetime timestamps (`originalTimestamp`, `sentAt`, `timestamp`).
- **FR-007**: Universal event context MUST require GDPR consent state and library metadata.
- **FR-008**: `PageViewEvent` MUST require page properties and page context; `name` remains
  optional.
- **FR-009**: `ScreenViewEvent` MUST require screen name and screen context; properties remain
  optional.
- **FR-010**: `TrackEvent` MUST require event name plus generic properties map.
- **FR-011**: `ViewEvent` MUST require component type/id and variant index, with optional
  `experienceId`.
- **FR-012**: `ExperienceResponse` MUST extend a shared response envelope and include `profile`,
  `experiences`, and `changes` in `data`.
- **FR-013**: `BatchExperienceResponse` MUST extend a shared response envelope and include optional
  `profiles` in `data`.
- **FR-014**: `Profile` MUST include id, stable id, random, audiences, traits, location, and session
  statistics.
- **FR-015**: `PartialProfile` MUST require `id` and allow additional JSON-compatible attributes.
- **FR-016**: `SelectedPersonalization` MUST include experience id, variant index, variants map, and
  defaultable sticky flag.
- **FR-017**: Change contracts MUST include typed variable changes and expose unknown-change
  fallback schema for forward-compatible handling.
- **FR-018**: Property-level schemas MUST constrain channel values to `mobile|server|web` and
  `GeoLocation.countryCode` length to two characters when present.

### Key Entities _(include if feature involves data)_

- **ExperienceRequestData**: Outbound single-request payload (events + options).
- **BatchExperienceRequestData**: Outbound batch-request payload (batch events + options).
- **ExperienceEvent / BatchExperienceEvent**: Discriminated event unions used for tracking and
  personalization evaluation.
- **ResponseEnvelope**: Shared response metadata wrapper (`data`, `message`, `error`).
- **ExperienceResponse / BatchExperienceResponse**: Typed inbound response contracts.
- **Profile / PartialProfile**: Full and partial profile representations.
- **Change / VariableChange**: Contract for personalization flag/change payloads.
- **SelectedPersonalization**: Chosen experience/variant mapping outcome.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Single and batch request schemas reject empty event arrays in runtime validation.
- **SC-002**: All seven supported experience event variants parse successfully with valid payloads.
- **SC-003**: Batch experience events fail validation whenever `anonymousId` is absent.
- **SC-004**: Standard and batch response schemas accept valid envelope/data payloads and reject
  malformed envelope fields.
