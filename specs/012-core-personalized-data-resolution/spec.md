# Feature Specification: Optimization Core Personalized Data Resolution

**Feature Branch**: `[012-core-personalized-data-resolution]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resolve Custom Flags from Changes (Priority: P1)

As a personalization consumer, I need custom flags resolved from Experience API `changes` so I can
read feature and variable values from one flattened lookup map.

**Why this priority**: Flag lookup is a core personalization consumption pattern.

**Independent Test**: Resolve flags from undefined and populated change arrays, including wrapped
values, and verify deterministic key-value output.

**Acceptance Scenarios**:

1. **Given** undefined changes, **When** flag resolution runs, **Then** an empty flag map is
   returned.
2. **Given** change entries with primitive values, **When** flag resolution runs, **Then** keys map
   to those values directly.
3. **Given** change entries with wrapped object values (`{ value: { ... } }`), **When** flag
   resolution runs, **Then** wrapped payloads are unwrapped to underlying object values.

---

### User Story 2 - Resolve Personalized Entries to Selected Variants (Priority: P1)

As a Contentful SDK consumer, I need baseline entries resolved to selected personalized variants so
the rendered content matches selected experience treatments.

**Why this priority**: Entry variant resolution is the primary personalized-content behavior.

**Independent Test**: Run resolver with matching and non-matching selections and verify baseline
fallback, variant selection, and returned personalization metadata.

**Acceptance Scenarios**:

1. **Given** selected personalizations with non-zero variant index and matching replacement variant,
   **When** entry resolution runs, **Then** variant entry and selected personalization metadata are
   returned.
2. **Given** selected variant index `0`, **When** entry resolution runs, **Then** baseline entry is
   returned without personalization metadata.
3. **Given** missing/invalid personalization linkage, **When** entry resolution runs, **Then**
   baseline entry is returned and variant resolution failure is logged.

---

### User Story 3 - Resolve Merge Tag Values with Profile Fallbacks (Priority: P2)

As a runtime rendering personalized rich text, I need merge-tag values resolved from profile data
with fallback values so content remains renderable even when profile fields are missing.

**Why this priority**: Merge tags are often rendered in user-visible content and need graceful
fallback semantics.

**Independent Test**: Resolve merge tags using valid and invalid entries/profiles, underscore+dot
selector variants, and fallback paths.

**Acceptance Scenarios**:

1. **Given** valid merge-tag entry and matching profile value, **When** merge-tag resolution runs,
   **Then** the resolved profile value is returned as a string.
2. **Given** valid merge-tag entry and invalid/missing profile, **When** merge-tag resolution runs,
   **Then** entry fallback value is returned.
3. **Given** invalid merge-tag entry, **When** merge-tag resolution runs, **Then** resolution
   returns `undefined`.

---

### Edge Cases

- In stateless usage, missing `changes` causes `getCustomFlag(name)` lookups to return `undefined`.
- Variant indexes are treated as 1-based; index `0` is explicit baseline.
- Hidden baseline components are excluded from replacement-variant selection.
- If selected variant config exists but linked variant entry is absent, resolver returns baseline.
- Merge-tag selector normalization must support mixed underscore and dot path patterns.
- Merge-tag profile resolution only returns primitive string/number/boolean values and stringifies
  them.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `PersonalizationBase` MUST expose resolver-backed methods `getCustomFlag`,
  `personalizeEntry`, and `getMergeTagValue`.
- **FR-002**: `FlagsResolver.resolve` MUST return `{}` when `changes` is undefined.
- **FR-003**: `FlagsResolver.resolve` MUST flatten change entries into a key-value map keyed by
  `change.key`.
- **FR-004**: `FlagsResolver.resolve` MUST unwrap wrapped object values when change value is object
  containing object-like `value`.
- **FR-005**: `PersonalizationBase.getCustomFlag(name, changes)` MUST resolve from `FlagsResolver`
  and return lookup value at `name`.
- **FR-006**: `PersonalizedEntryResolver.getPersonalizationEntry` MUST find personalization entries
  by matching selected `experienceId` values against entry `nt_experience_id`.
- **FR-007**: `PersonalizedEntryResolver.getSelectedPersonalization` MUST return selected
  personalization matching personalization entry `nt_experience_id`.
- **FR-008**: `PersonalizedEntryResolver.getSelectedVariant` MUST locate relevant replacement
  component by baseline entry ID and return variant at `variantIndex - 1`.
- **FR-009**: `PersonalizedEntryResolver.getSelectedVariant` MUST ignore components whose baseline
  is marked hidden.
- **FR-010**: `PersonalizedEntryResolver.getSelectedVariantEntry` MUST resolve variant entry by
  variant ID from `nt_variants`.
- **FR-011**: `PersonalizedEntryResolver.resolve` MUST return baseline entry when no selected
  personalizations are provided.
- **FR-012**: `PersonalizedEntryResolver.resolve` MUST return baseline entry when entry is not a
  personalized entry shape.
- **FR-013**: `PersonalizedEntryResolver.resolve` MUST treat selected variant index `0` as baseline.
- **FR-014**: `PersonalizedEntryResolver.resolve` MUST return baseline entry when variant config or
  linked variant entry cannot be resolved.
- **FR-015**: `PersonalizedEntryResolver.resolve` MUST return
  `{ entry: variantEntry, personalization: selectedPersonalization }` when variant resolution
  succeeds.
- **FR-016**: `MergeTagValueResolver.isMergeTagEntry` MUST validate candidate entries using
  `MergeTagEntry.safeParse`.
- **FR-017**: `MergeTagValueResolver.normalizeSelectors` MUST produce selector candidates by
  splitting merge-tag IDs on underscores and progressively combining dot/underscore segments.
- **FR-018**: `MergeTagValueResolver.getValueFromProfile` MUST return stringified primitive values
  from first matching selector path and return `undefined` for missing or non-primitive values.
- **FR-019**: `MergeTagValueResolver.resolve` MUST return `undefined` for invalid merge-tag entries.
- **FR-020**: `MergeTagValueResolver.resolve` MUST return configured merge-tag fallback when profile
  is invalid or no profile value is resolved.
- **FR-021**: Stateful personalization overrides for these methods MUST default optional resolver
  inputs from current signals (`changes`, `personalizations`, `profile`).
- **FR-022**: Core-level wrapper methods (`CoreBase.getCustomFlag`, `.personalizeEntry`,
  `.getMergeTagValue`) MUST delegate to personalization resolver methods without altering resolved
  payload shape.

### Key Entities _(include if feature involves data)_

- **FlagsResolver**: Utility mapping `ChangeArray` inputs to flattened flag lookup map.
- **PersonalizedEntryResolver**: Multi-step resolver selecting baseline vs variant Contentful
  entries.
- **MergeTagValueResolver**: Utility resolving merge-tag IDs against profile data with fallback
  support.
- **ResolvedData**: Resolver output shape containing resolved entry and optional selected
  personalization metadata.
- **SelectedPersonalization**: Experience selection metadata with `experienceId` and 1-based
  `variantIndex`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Custom flag resolution returns deterministic outputs for undefined changes, primitive
  values, and wrapped object values.
- **SC-002**: Personalized entry resolution returns baseline on all invalid/missing selection paths
  and returns variant+metadata on valid selection paths.
- **SC-003**: Merge-tag resolution supports underscore/dot selector normalization and returns
  fallback values for invalid profile paths.
- **SC-004**: Core and personalization resolver wrapper methods preserve resolver semantics across
  stateless and stateful runtime contexts.
