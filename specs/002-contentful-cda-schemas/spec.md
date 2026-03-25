# Feature Specification: Contentful CDA Optimization Contract Schemas

**Feature Branch**: `[002-contentful-cda-schemas]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate Contentful Entry and Link Shapes (Priority: P1)

As a runtime developer, I need base schemas for Contentful links and entries so optimized content
processing starts from validated CDA data.

**Why this priority**: Entry validation is the first safety boundary before optimization logic.

**Independent Test**: Parse valid and invalid payloads through `CtflEntry`, `EntrySys`, and link
schemas.

**Acceptance Scenarios**:

1. **Given** an entry with `fields`, `metadata.tags`, and valid `sys`, **When** parsed with
   `CtflEntry`, **Then** parsing succeeds.
2. **Given** an entry missing required `sys` members, **When** parsed with `CtflEntry`, **Then**
   parsing fails.

---

### User Story 2 - Normalize Optimization Entry Configuration (Priority: P2)

As an optimization developer, I need deterministic defaults for optimization config fields so
variant logic receives predictable values.

**Why this priority**: `nt_config` is optional/nullable in CDA payloads and must be normalized.

**Independent Test**: Parse optimization entries with omitted, `null`, and partial config values.

**Acceptance Scenarios**:

1. **Given** `fields.nt_config` as `null` or omitted, **When** parsing `OptimizationEntry`, **Then**
   parsing succeeds without fabricating `nt_config`.
2. **Given** `OptimizationConfig` input with omitted fields, **When** `normalizeOptimizationConfig`
   is called, **Then** `distribution`, `traffic`, `components`, and `sticky` use runtime-safe
   defaults.

---

### User Story 3 - Narrow Runtime Types with Guards (Priority: P3)

As an SDK maintainer, I need type guards for entries and components so runtime branching does not
depend on manual casts.

**Why this priority**: Guards are used by downstream optimization resolution paths.

**Independent Test**: Run exported guards across valid and invalid objects.

**Acceptance Scenarios**:

1. **Given** an `OptimizationComponent` with `type: 'InlineVariable'`, **When**
   `isInlineVariableComponent` is called, **Then** it returns `true`.
2. **Given** a component without `type`, **When** `isEntryReplacementComponent` is called, **Then**
   it returns `true`.

---

### Edge Cases

- `CtflEntry.fields` must accept arbitrary JSON-compatible keys via `z.catchall(..., z.json())`.
- `OptimizationEntryArray` must allow both unresolved `Link` values and resolved `OptimizationEntry`
  values.
- `EntryReplacementComponent.type` may be omitted and still be treated as entry replacement.
- `MergeTagEntry` must fail when `sys.contentType.sys.id !== 'nt_mergetag'`.
- `nt_variants` must default to `[]` when omitted.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Contentful link primitives MUST include `Link`, `ContentTypeLink`, `EnvironmentLink`,
  `SpaceLink`, and `TagLink`.
- **FR-002**: `EntrySys` MUST require `type`, `contentType`, `publishedVersion`, `id`, `createdAt`,
  `updatedAt`, `revision`, `space`, and `environment`, with optional `locale`.
- **FR-003**: `CtflEntry` MUST require `fields`, `metadata.tags`, and `sys`; `metadata.concepts` MAY
  be omitted.
- **FR-004**: `OptimizedEntry` MUST extend `CtflEntry` with required
  `fields.nt_experiences: OptimizationEntryArray`.
- **FR-005**: `OptimizationType` MUST allow only `nt_experiment` or `nt_personalization`.
- **FR-006**: `OptimizationEntryFields` MUST require `nt_name`, `nt_type`, and `nt_experience_id`.
- **FR-007**: `OptimizationEntryFields.nt_config` MUST accept nullable/optional config without
  fabricating schema defaults during parsing.
- **FR-008**: `OptimizationConfig` MUST define optional `distribution`, `traffic`, `components`, and
  `sticky` fields, and `normalizeOptimizationConfig` MUST provide runtime-safe defaults.
- **FR-009**: `OptimizationComponent` MUST be a discriminated union containing
  `EntryReplacementComponent` and `InlineVariableComponent`.
- **FR-010**: `EntryReplacementVariant.hidden` MUST default to `false`.
- **FR-011**: `MergeTagEntry` MUST require `fields.nt_name` and `fields.nt_mergetag_id`; it MAY
  include `fields.nt_fallback`.
- **FR-012**: Skeleton schemas MUST exist for `nt_audience` (`AudienceEntrySkeleton`) and
  `nt_experience` (`OptimizationEntrySkeleton`).
- **FR-013**: Runtime guards MUST include `isEntry`, `isOptimizedEntry`, `isOptimizationEntry`,
  `isEntryReplacementVariant`, `isEntryReplacementComponent`, `isInlineVariableComponent`, and
  `isMergeTagEntry`.

### Key Entities _(include if feature involves data)_

- **CtflEntry**: Base Contentful entry schema used by specialized entry contracts.
- **OptimizationEntry**: Experience definition entry with optional `nt_config`.
- **OptimizationConfig**: Traffic/distribution/component/sticky configuration schema.
- **OptimizedEntry**: Entry that references attached experiences via `nt_experiences`.
- **AudienceEntry**: Audience metadata entry schema.
- **MergeTagEntry**: Merge-tag schema constrained to `nt_mergetag` content type.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Base and specialized entry schemas accept valid CDA payloads and reject invalid system
  metadata.
- **SC-002**: Nullish `nt_config` values remain parseable and normalize to runtime-safe defaults via
  `normalizeOptimizationConfig`.
- **SC-003**: Omitted `nt_variants` parses to an empty array.
- **SC-004**: Exported type guards return `true` only for values matching their target contracts.
