# Feature Specification: Contentful CDA Personalization Contract Schemas

**Feature Branch**: `[002-contentful-cda-schemas]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Derive SpecKit-compatible specifications for Contentful CDA schemas in
`@contentful/optimization-api-schemas`."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate CDA Entry Shapes for Runtime Use (Priority: P1)

As a personalization runtime developer, I need to validate CDA entries and links before using them
so personalization logic only runs on structurally valid content data.

**Why this priority**: Entry parsing is the first gate before personalization resolution.

**Independent Test**: Parse representative `CtflEntry`, `Link`, and specialized entry payloads and
assert success/failure paths.

**Acceptance Scenarios**:

1. **Given** a generic CDA entry with `fields`, `metadata.tags`, and `sys`, **When** parsed with
   `CtflEntry`, **Then** parsing succeeds.
2. **Given** an invalid entry missing required `sys` metadata, **When** parsed with `CtflEntry`,
   **Then** parsing fails.

---

### User Story 2 - Validate Personalization Entry Configuration (Priority: P2)

As a personalization feature developer, I need structured schemas for personalization entries and
their config components so variant selection logic receives predictable input.

**Why this priority**: Personalization behavior depends on strict interpretation of config fields.

**Independent Test**: Parse entries with omitted/null/partial `nt_config` and confirm deterministic
defaulting behavior.

**Acceptance Scenarios**:

1. **Given** a personalization entry with `nt_config` set to `null`, **When** parsed, **Then** a
   default config object is produced.
2. **Given** a personalization entry with component definitions, **When** parsed, **Then** component
   schema discrimination succeeds for supported component types.

---

### User Story 3 - Use Type Guards in Runtime Entry Resolution (Priority: P3)

As a core SDK maintainer, I need type guard helpers for generic and specialized entries so runtime
resolution can branch safely without manual casting.

**Why this priority**: Type guards reduce unsafe assumptions and improve integration ergonomics.

**Independent Test**: Run guards (`isEntry`, `isPersonalizedEntry`, `isPersonalizationEntry`,
component guards) against valid and invalid samples.

**Acceptance Scenarios**:

1. **Given** a generic entry payload, **When** `isEntry` is called, **Then** result reflects schema
   validity.
2. **Given** a personalized entry payload with `nt_experiences`, **When** `isPersonalizedEntry` is
   called, **Then** result is `true`.

---

### Edge Cases

- `nt_config` omitted or `null` must still produce deterministic fallback config.
- `nt_variants` omitted must default to an empty array.
- Entry replacement components may omit `type`; omitted discriminator must still be treated as entry
  replacement logic.
- `MergeTagEntry` must fail if `sys.contentType` is not `nt_mergetag`.
- Personalization arrays must allow both unresolved links and resolved personalization entries.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The schema set MUST include base Contentful link primitives (`Link`,
  `ContentTypeLink`, `EnvironmentLink`, `SpaceLink`, `TagLink`).
- **FR-002**: The schema set MUST include `EntrySys` and `CtflEntry` as reusable base entry
  contracts.
- **FR-003**: `CtflEntry.fields` MUST accept JSON-like key/value data through catch-all validation.
- **FR-004**: `PersonalizedEntry` MUST extend `CtflEntry` with required
  `fields.nt_experiences: PersonalizationEntryArray`.
- **FR-005**: `PersonalizationEntry` MUST require `nt_name`, `nt_type`, and `nt_experience_id` in
  fields.
- **FR-006**: `PersonalizationType` MUST support exactly `nt_experiment` and `nt_personalization`.
- **FR-007**: `PersonalizationEntryFields.nt_config` MUST accept nullable/optional values and
  transform missing/null to default
  `{ traffic: 0, distribution: [0.5, 0.5], components: [], sticky: false }`.
- **FR-008**: `PersonalizationConfig` MUST model distribution, traffic, components, and sticky with
  explicit defaults for omitted fields.
- **FR-009**: Personalization components MUST be represented as a discriminated union between
  `EntryReplacement` and `InlineVariable` schemas.
- **FR-010**: `MergeTagEntry` MUST constrain `sys.contentType.sys.id` to `nt_mergetag`.
- **FR-011**: `AudienceEntry` MUST define `nt_audience_id` and optional descriptive fields.
- **FR-012**: Skeleton schemas MUST exist for audience (`nt_audience`) and personalization
  (`nt_experience`) content types.
- **FR-013**: Type guard helpers MUST be provided for entry-level runtime narrowing (`isEntry`,
  `isPersonalizedEntry`, `isPersonalizationEntry`).
- **FR-014**: Component-level type guard helpers MUST be provided for entry replacement, inline
  variable, and replacement variant schemas.

### Key Entities _(include if feature involves data)_

- **CtflEntry**: Base Contentful entry contract with `fields`, `metadata`, and `sys`.
- **PersonalizedEntry**: Base entry extended with attached personalization references.
- **PersonalizationEntry**: Specialized entry describing one personalization/experiment definition.
- **PersonalizationConfig**: Behavior/config block controlling traffic, distribution, and component
  variants.
- **AudienceEntry**: Audience metadata used for targeting conditions.
- **MergeTagEntry**: Merge tag entry with fallback and constrained content type.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Valid CDA fixture payloads parse successfully for base and specialized entry schemas.
- **SC-002**: Invalid payloads missing required system or field-level data are rejected by schema
  parsing.
- **SC-003**: Null/omitted personalization config inputs produce deterministic defaulted outputs.
- **SC-004**: Type guard functions correctly narrow types for valid inputs and reject invalid
  shapes.
