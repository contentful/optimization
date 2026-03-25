# Feature Specification: Shared and Foundational Schema Contracts

**Feature Branch**: `[001-shared-and-foundational]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate Unknown Payloads with Friendly Errors (Priority: P1)

As an SDK developer, I need one shared runtime parser so schema failures are reported as readable
errors instead of raw Zod internals.

**Why this priority**: This utility is the common runtime boundary used by both schema and client
packages.

**Independent Test**: Call `parseWithFriendlyError` with valid and invalid inputs and verify typed
return values and thrown error text.

**Acceptance Scenarios**:

1. **Given** valid input for a `zod/mini` schema, **When** `parseWithFriendlyError` is called,
   **Then** it returns the parsed `z.output<T>` value.
2. **Given** invalid input, **When** `parseWithFriendlyError` is called, **Then** it throws a plain
   `Error` containing `z.prettifyError(...)` output.

---

### User Story 2 - Provide a Stable Root Export Surface (Priority: P2)

As a package consumer, I need one predictable root module export so I can import schema contracts
without internal path coupling.

**Why this priority**: `@contentful/optimization-api-schemas` is reused by multiple workspace
packages.

**Independent Test**: Import from `@contentful/optimization-api-schemas` and verify all domain
exports are available.

**Acceptance Scenarios**:

1. **Given** a root package import, **When** the consumer imports from
   `@contentful/optimization-api-schemas`, **Then** exports from `contentful`, `experience`,
   `insights`, and `validation` are re-exported.
2. **Given** a package build, **When** artifacts are emitted, **Then** ESM/CJS runtime bundles and
   dual declaration outputs are produced.

---

### User Story 3 - Keep Forward-Compatible Schema Patterns (Priority: P3)

As a schema maintainer, I need consistent defaulting and discriminator patterns so contract
extensions are low risk.

**Why this priority**: The API contracts evolve over time and need additive extension paths.

**Independent Test**: Validate unions/defaults with omitted values and current variants.

**Acceptance Scenarios**:

1. **Given** event/change families keyed by `type`, **When** schemas are parsed, **Then**
   discriminated unions select the matching variant contract.
2. **Given** fields that use `z.prefault(...)`, **When** values are omitted, **Then** deterministic
   defaults are applied.

---

### Edge Cases

- Root-level type errors must still produce readable messages even without a path.
- Nested failures must include dot-path hints (for example, `context.locale`).
- Validation utility failures must throw `Error`, not leak `ZodError`.
- English locale wording must be applied globally via `z.config(en())`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Runtime schemas MUST use `zod/mini`.
- **FR-002**: The root barrel MUST re-export `./contentful`, `./experience`, `./insights`, and
  `./validation`.
- **FR-003**: `parseWithFriendlyError<T extends z.ZodMiniType>(schema, data)` MUST call
  `schema.safeParse(data)`.
- **FR-004**: On success, `parseWithFriendlyError` MUST return `result.data`.
- **FR-005**: On failure, `parseWithFriendlyError` MUST throw `new Error(z.prettifyError(error))`.
- **FR-006**: Validation setup MUST configure English Zod locale via `z.config(en())`.
- **FR-007**: Package exports MUST provide dual module targets (`import` and `require`) with dual
  type entries (`.d.mts` and `.d.cts`).
- **FR-008**: Unit tests MUST cover successful parse, prettified root-level errors, and prettified
  nested-path errors.

### Key Entities _(include if feature involves data)_

- **Root Barrel**: Top-level `index.ts` re-exporting all schema domains.
- **Validation Utility**: `parseWithFriendlyError` wrapper around `safeParse`.
- **Friendly Error Output**: Human-readable error text from `z.prettifyError`.
- **Build Artifacts**: `dist/*.mjs`, `dist/*.cjs`, and emitted dual declaration files.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Validation tests pass for success, root-level failure, and nested failure.
- **SC-002**: Package build emits both ESM and CJS runtime outputs.
- **SC-003**: Package build emits both `.d.mts` and `.d.cts` declaration outputs.
- **SC-004**: Workspace consumers can import schema contracts from the package root without type
  errors.
