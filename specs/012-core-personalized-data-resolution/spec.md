# Feature Specification: Optimization Core Resolution Helpers

**Feature Branch**: `[012-core-optimized-data-resolution]` **Created**: 2026-02-26 **Status**:
Current (Pre-release) **Input**: Repository behavior review for the current pre-release
implementation (validated 2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resolve Custom Flags from Optimization Changes (Priority: P1)

As an SDK consumer, I need optimization changes resolved into deterministic flag lookups so I can
read variable values directly from change payloads.

**Why this priority**: Flag lookup is a core optimization-consumption path.

**Independent Test**: Resolve flags from undefined and populated change arrays, then validate both
`FlagsResolver.resolve(...)` and `CoreBase.getFlag(...)`.

**Acceptance Scenarios**:

1. **Given** undefined changes, **When** flag resolution runs, **Then** `FlagsResolver.resolve`
   returns `{}` and single-key lookup returns `undefined`.
2. **Given** change entries with primitive values, **When** flag resolution runs, **Then** each
   `change.key` resolves directly to its primitive value.
3. **Given** change entries shaped as wrapper objects (`{ value: { ... } }`), **When** flag
   resolution runs, **Then** wrapped object payloads are unwrapped to the inner object value.
4. **Given** `CoreBase.getFlag(name, changes)`, **When** it is called, **Then** it returns
   `flagsResolver.resolve(changes)[name]`.

---

### User Story 2 - Resolve Optimized Entries to Selected Variants (Priority: P1)

As a Contentful SDK consumer, I need baseline entries resolved to selected optimized variants so
rendered content matches the current Experience API selection state.

**Why this priority**: Optimized entry resolution is the primary optimized-content behavior.

**Independent Test**: Run resolver methods with matching and non-matching selections; validate
baseline fallback, variant selection, hidden-baseline filtering, and metadata output.

**Acceptance Scenarios**:

1. **Given** selected optimizations with non-zero `variantIndex` and a matching replacement variant,
   **When** resolution runs, **Then** resolver returns variant entry plus `selectedOptimization`
   metadata.
2. **Given** selected variant index `0`, **When** resolution runs, **Then** baseline entry is
   returned and `selectedOptimization` is omitted.
3. **Given** missing selected optimizations or non-optimized entry input, **When** resolution runs,
   **Then** baseline entry is returned unchanged.
4. **Given** missing optimization entry, invalid variant config, hidden baseline config, or missing
   linked variant entry, **When** resolution runs, **Then** baseline entry is returned.

---

### User Story 3 - Resolve Merge Tag Values with Profile Fallbacks (Priority: P2)

As a runtime rendering optimized content, I need merge-tag values resolved from profile data with
fallback behavior so output remains renderable when profile values are unavailable.

**Why this priority**: Merge tags are user-visible and require predictable fallback semantics.

**Independent Test**: Resolve merge tags with valid and invalid entries/profiles across underscore
and dot selector variants.

**Acceptance Scenarios**:

1. **Given** a valid merge-tag entry and matching truthy primitive profile value, **When** merge-tag
   resolution runs, **Then** the resolved value is returned as a string.
2. **Given** a valid merge-tag entry and invalid profile or unresolved selector path, **When**
   merge-tag resolution runs, **Then** configured fallback value is returned.
3. **Given** an invalid merge-tag entry, **When** merge-tag resolution runs, **Then** result is
   `undefined`.

---

### User Story 4 - Default Resolver Inputs from Stateful Signals (Priority: P2)

As a stateful runtime consumer, I need omitted resolver inputs sourced from current signals so
resolution helpers work without reconstructing runtime state manually.

**Why this priority**: Stateful convenience methods are part of the public core SDK surface.

**Independent Test**: Call `CoreStateful.getFlag`, `resolveOptimizedEntry`, and `getMergeTagValue`
without explicit resolver inputs and verify signal-backed defaults plus flag-view side effects.

**Acceptance Scenarios**:

1. **Given** `CoreStateful.getFlag(name)` with omitted `changes`, **When** it is called, **Then**
   current `changes` signal state is used by default.
2. **Given** `CoreStateful.resolveOptimizedEntry(entry)` or `getMergeTagValue(entry)` with omitted
   resolver inputs, **When** they are called, **Then** current `selectedOptimizations` or `profile`
   signal state is used by default.
3. **Given** `CoreStateful.getFlag(name)`, **When** the matching change contains optimization
   metadata, **Then** `trackFlagView` is emitted with `componentId`, optional `experienceId`, and
   optional `variantIndex`, while still returning the flag value synchronously.

---

### Edge Cases

- `SelectedOptimization.variantIndex` is treated as 1-based; `0` is explicit baseline.
- Hidden baseline components are excluded from replacement-variant selection.
- If selected variant config exists but linked variant entry is missing, resolver returns baseline.
- Merge-tag selector normalization supports mixed underscore and dot patterns.
- `MergeTagValueResolver.getValueFromProfile` currently resolves only truthy primitive matches;
  falsy primitive values (`''`, `0`, `false`) are treated as unresolved.
- Stateful flag-view emission is best-effort; failures are logged and do not change the resolved
  flag value.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `CoreBase` MUST expose resolver-backed helpers `getFlag`, `resolveOptimizedEntry`, and
  `getMergeTagValue`.
- **FR-002**: `FlagsResolver.resolve` MUST return `{}` when `changes` is `undefined`.
- **FR-003**: `FlagsResolver.resolve` MUST flatten change entries into a key-value map keyed by
  `change.key`.
- **FR-004**: `FlagsResolver.resolve` MUST unwrap wrapped object values only when the change value
  is an object containing an object-valued `value` property.
- **FR-005**: `CoreBase.getFlag(name, changes)` MUST return
  `CoreBase.flagsResolver.resolve(changes)[name]`.
- **FR-006**: `OptimizedEntryResolver.getOptimizationEntry` MUST match selected `experienceId`
  values to optimization entries by `nt_experience_id`.
- **FR-007**: `OptimizedEntryResolver.getSelectedOptimization` MUST return the selected optimization
  matching the optimization entry `nt_experience_id`.
- **FR-008**: `OptimizedEntryResolver.getSelectedVariant` MUST normalize `nt_config`, locate
  non-hidden `EntryReplacementComponent` values whose baseline entry ID matches the target entry,
  and return the variant at `selectedVariantIndex - 1`.
- **FR-009**: `OptimizedEntryResolver.getSelectedVariantEntry` MUST resolve variant entry by
  selected variant ID from `nt_variants` and validate the resolved object as a Contentful `Entry`.
- **FR-010**: `OptimizedEntryResolver.resolve` MUST return baseline entry when selected
  optimizations are missing or empty.
- **FR-011**: `OptimizedEntryResolver.resolve` MUST return baseline entry when input entry is not an
  optimized entry shape.
- **FR-012**: `OptimizedEntryResolver.resolve` MUST treat selected variant index `0` as baseline.
- **FR-013**: `OptimizedEntryResolver.resolve` MUST return baseline entry when optimization entry,
  variant config, or linked variant entry cannot be resolved.
- **FR-014**: `OptimizedEntryResolver.resolve` MUST return
  `{ entry: variantEntry, selectedOptimization }` when variant resolution succeeds.
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
- **FR-020**: `CoreStateful.getFlag(name)` MUST default omitted `changes` to the current `changes`
  signal value.
- **FR-021**: `CoreStateful.resolveOptimizedEntry(entry)` MUST default omitted
  `selectedOptimizations` to the current `selectedOptimizations` signal value.
- **FR-022**: `CoreStateful.getMergeTagValue(entry)` MUST default omitted `profile` to the current
  `profile` signal value.
- **FR-023**: `CoreStateful.getFlag(name)` MUST emit `trackFlagView` using metadata derived from the
  matching change when available, and MUST still return the resolved flag value immediately.

### Key Entities _(include if feature involves data)_

- **FlagsResolver**: Utility mapping `ChangeArray` inputs to flattened flag lookup maps.
- **OptimizedEntryResolver**: Multi-step resolver selecting baseline versus variant Contentful
  entries.
- **MergeTagValueResolver**: Utility resolving merge-tag IDs against profile data with fallback
  semantics.
- **ResolvedData**: Resolver output containing resolved entry and optional `selectedOptimization`
  metadata.
- **SelectedOptimization**: Selection metadata with `experienceId`, 1-based `variantIndex`, and
  optional `sticky`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Flag resolution consistently returns deterministic maps and lookups for undefined
  changes, primitive values, and wrapped object values.
- **SC-002**: Optimized entry resolution returns baseline for all invalid or missing paths and
  variant plus `selectedOptimization` metadata for valid paths.
- **SC-003**: Merge-tag resolution supports underscore and dot selector normalization plus fallback
  behavior for invalid profile paths.
- **SC-004**: Stateful resolver helpers default omitted inputs from current signals without changing
  the underlying resolver output shapes.
