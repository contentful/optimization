# Feature Specification: Optimization Core Personalized Data Resolution

**Feature Branch**: `[012-core-personalized-data-resolution]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resolve Custom Flags from Changes (Priority: P1)

As a personalization consumer, I need change payloads resolved into both full flag maps and
single-flag lookups so I can read variable values deterministically.

**Why this priority**: Flag lookup is a core personalization consumption path.

**Independent Test**: Resolve flags from undefined and populated change arrays (including wrapped
values) and validate both `getCustomFlags` and `getCustomFlag` behavior.

**Acceptance Scenarios**:

1. **Given** undefined changes, **When** flag resolution runs, **Then** `FlagsResolver.resolve`
   returns `{}` and single-key lookup returns `undefined`.
2. **Given** change entries with primitive values, **When** flag resolution runs, **Then** each
   `change.key` resolves directly to its primitive value.
3. **Given** change entries shaped as object wrappers (`{ value: { ... } }`), **When** flag
   resolution runs, **Then** wrapped object payloads are unwrapped to inner object values.
4. **Given** `PersonalizationStateful` with omitted `changes` argument, **When** `getCustomFlag` or
   `getCustomFlags` is called, **Then** current `changes` signal state is used by default.

---

### User Story 2 - Resolve Personalized Entries to Selected Variants (Priority: P1)

As a Contentful SDK consumer, I need baseline entries resolved to selected personalized variants so
rendered content matches selected treatment state.

**Why this priority**: Entry variant resolution is the primary personalized-content behavior.

**Independent Test**: Run resolver with matching and non-matching selections; validate baseline
fallback, variant selection, hidden-baseline filtering, and metadata output.

**Acceptance Scenarios**:

1. **Given** selected personalizations with non-zero `variantIndex` and a matching replacement
   variant, **When** resolution runs, **Then** resolver returns variant entry plus selected
   personalization metadata.
2. **Given** selected variant index `0`, **When** resolution runs, **Then** baseline entry is
   returned and `personalization` metadata is omitted.
3. **Given** missing selected personalizations or non-personalized entry input, **When** resolution
   runs, **Then** baseline entry is returned.
4. **Given** missing/invalid variant config or missing linked variant entry, **When** resolution
   runs, **Then** baseline entry is returned.

---

### User Story 3 - Resolve Merge Tag Values with Profile Fallbacks (Priority: P2)

As a runtime rendering personalized content, I need merge-tag values resolved from profile data with
fallback behavior so output remains renderable when profile values are unavailable.

**Why this priority**: Merge tags are user-visible and require predictable fallback semantics.

**Independent Test**: Resolve merge tags with valid and invalid entries/profiles across underscore
and dot selector variants.

**Acceptance Scenarios**:

1. **Given** valid merge-tag entry and matching truthy primitive profile value, **When** merge-tag
   resolution runs, **Then** resolved value is returned as a string.
2. **Given** valid merge-tag entry and invalid profile or unresolved selector path, **When**
   merge-tag resolution runs, **Then** configured fallback value is returned.
3. **Given** invalid merge-tag entry, **When** merge-tag resolution runs, **Then** result is
   `undefined`.

---

### Edge Cases

- `SelectedPersonalization.variantIndex` is treated as 1-based; `0` is explicit baseline.
- Hidden baseline components are excluded from replacement-variant selection.
- If selected variant config exists but linked variant entry is missing, resolver returns baseline.
- Merge-tag selector normalization supports mixed underscore and dot patterns.
- `MergeTagValueResolver.getValueFromProfile` currently resolves only truthy primitive matches;
  falsy primitive values (`''`, `0`, `false`) are treated as unresolved.
- Core-level resolver wrappers preserve underlying resolver output shapes without additional
  transformation.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `PersonalizationBase` MUST expose resolver-backed methods `getCustomFlag`,
  `getCustomFlags`, `personalizeEntry`, and `getMergeTagValue`.
- **FR-002**: `FlagsResolver.resolve` MUST return `{}` when `changes` is `undefined`.
- **FR-003**: `FlagsResolver.resolve` MUST flatten change entries into a key-value map keyed by
  `change.key`.
- **FR-004**: `FlagsResolver.resolve` MUST unwrap wrapped object values only when the change value
  is an object containing an object-valued `value` property.
- **FR-005**: `PersonalizationBase.getCustomFlag(name, changes)` MUST return
  `PersonalizationBase.getCustomFlags(changes)[name]`.
- **FR-006**: `PersonalizedEntryResolver.getPersonalizationEntry` MUST match selected `experienceId`
  values to personalization entries by `nt_experience_id`.
- **FR-007**: `PersonalizedEntryResolver.getSelectedPersonalization` MUST return the selected
  personalization matching the personalization entry `nt_experience_id`.
- **FR-008**: `PersonalizedEntryResolver.getSelectedVariant` MUST locate non-hidden replacement
  components whose baseline entry ID matches the target entry and return variant at
  `selectedVariantIndex - 1`.
- **FR-009**: `PersonalizedEntryResolver.getSelectedVariantEntry` MUST resolve variant entry by
  selected variant ID from `nt_variants` and validate the resolved object as a Contentful `Entry`.
- **FR-010**: `PersonalizedEntryResolver.resolve` MUST return baseline entry when selected
  personalizations are missing/empty.
- **FR-011**: `PersonalizedEntryResolver.resolve` MUST return baseline entry when input entry is not
  a personalized entry shape.
- **FR-012**: `PersonalizedEntryResolver.resolve` MUST treat selected variant index `0` as baseline.
- **FR-013**: `PersonalizedEntryResolver.resolve` MUST return baseline entry when personalization
  entry, variant config, or linked variant entry cannot be resolved.
- **FR-014**: `PersonalizedEntryResolver.resolve` MUST return
  `{ entry: variantEntry, personalization: selectedPersonalization }` when variant resolution
  succeeds.
- **FR-015**: `MergeTagValueResolver.resolve` MUST return `undefined` when supplied entry is not a
  valid merge-tag entry.
- **FR-016**: `MergeTagValueResolver.normalizeSelectors` MUST generate progressive selector
  candidates by splitting IDs on underscores and combining preceding segments with dot notation.
- **FR-017**: `MergeTagValueResolver.getValueFromProfile` MUST select the first normalized selector
  path that resolves to a truthy value and inspect that selected value for return eligibility.
- **FR-018**: `MergeTagValueResolver.getValueFromProfile` MUST return a stringified value only when
  the selected value is a truthy primitive (`string | number | boolean`); otherwise it MUST return
  `undefined`.
- **FR-019**: `MergeTagValueResolver.resolve` MUST return merge-tag fallback when profile validation
  fails or no value is resolved from profile selectors.
- **FR-020**: `PersonalizationStateful` overrides for resolver methods MUST default omitted resolver
  inputs from current signals (`changes`, `selectedPersonalizations`, `profile`).
- **FR-021**: Core-level resolver wrappers (`CoreBase.getCustomFlag`, `.getCustomFlags`,
  `.personalizeEntry`, `.getMergeTagValue`) MUST delegate to personalization resolver methods
  without altering payload shape.

### Key Entities _(include if feature involves data)_

- **FlagsResolver**: Utility mapping `ChangeArray` inputs to flattened flag lookup maps.
- **PersonalizedEntryResolver**: Multi-step resolver selecting baseline versus variant Contentful
  entries.
- **MergeTagValueResolver**: Utility resolving merge-tag IDs against profile data with fallback
  semantics.
- **ResolvedData**: Resolver output containing resolved entry and optional selected personalization
  metadata.
- **SelectedPersonalization**: Selection metadata with `experienceId` and 1-based `variantIndex`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Flag resolution consistently returns deterministic maps/lookups for undefined changes,
  primitive values, and wrapped object values.
- **SC-002**: Personalized entry resolution returns baseline for all invalid/missing paths and
  variant+metadata for valid paths.
- **SC-003**: Merge-tag resolution supports underscore/dot selector normalization and fallback
  behavior for invalid profile paths.
- **SC-004**: Core and personalization resolver wrappers preserve resolver semantics across
  stateless and stateful runtime contexts.
