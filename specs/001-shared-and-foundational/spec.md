# Feature Specification: Shared and Foundational Schema Contracts

**Feature Branch**: `[001-shared-and-foundational]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Examine current functionality in
`@contentful/optimization-api-schemas` package and derive a list of SpecKit-compatible
specifications..."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Runtime Boundary Validation (Priority: P1)

As an SDK runtime developer, I need a shared way to validate unknown payloads at runtime so API
boundary failures are caught early and reported with actionable error messages.

**Why this priority**: Runtime contract validation is the safety boundary for all higher-layer SDK
packages.

**Independent Test**: Call `parseWithFriendlyError` with valid and invalid payloads and verify typed
output or thrown error text with meaningful details.

**Acceptance Scenarios**:

1. **Given** a valid payload and matching Zod Mini schema, **When** `parseWithFriendlyError` is
   called, **Then** parsed typed data is returned.
2. **Given** an invalid payload, **When** `parseWithFriendlyError` is called, **Then** an `Error` is
   thrown with prettified field/path details.

---

### User Story 2 - Stable Public Contract Surface (Priority: P2)

As an SDK package consumer, I need stable top-level and domain-level exports so I can import
schemas/types consistently across runtimes.

**Why this priority**: The package is a shared dependency for API client, core, and platform
packages.

**Independent Test**: Build and typecheck dependent packages that import from root and domain
barrels.

**Acceptance Scenarios**:

1. **Given** package root import usage, **When** the consumer imports from
   `@contentful/optimization-api-schemas`, **Then** contentful/experience/insights/validation
   exports are available.
2. **Given** a production build, **When** artifacts are published, **Then** both ESM and CJS entry
   points plus dual declaration files are emitted.

---

### User Story 3 - Extensible Schema Design Patterns (Priority: P3)

As a schema maintainer, I need consistent extensibility patterns so future API evolution can be
introduced with minimal breakage.

**Why this priority**: API contracts evolve; extensibility prevents frequent hard-breaking updates.

**Independent Test**: Extend existing schema unions/defaults in a branch and confirm existing use
sites continue passing typecheck and runtime parsing.

**Acceptance Scenarios**:

1. **Given** schema families with discriminators, **When** new event/change variants are added,
   **Then** existing variants remain backward compatible.
2. **Given** optional/defaulted fields, **When** fields are omitted, **Then** deterministic defaults
   are applied where defined.

---

### Edge Cases

- Invalid root-level payloads must still return descriptive errors even when no object path exists.
- Nested object failures must include dot-path context (for example, `context.locale`).
- Optional nullable configuration fields must behave deterministically for omitted, `null`, and
  partial object inputs.
- Schema parsing utility must throw plain `Error` objects rather than leaking `ZodError` instances.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The package MUST use `zod/mini` schemas as the runtime validation primitive.
- **FR-002**: The package MUST expose a root barrel exporting `contentful`, `experience`,
  `insights`, and `validation` domains.
- **FR-003**: The package MUST expose domain barrel files so callers can import grouped schema
  families.
- **FR-004**: The package MUST provide `parseWithFriendlyError(schema, data)` that returns typed
  parsed data on success.
- **FR-005**: `parseWithFriendlyError` MUST throw `Error` with `z.prettifyError` output on parse
  failure.
- **FR-006**: The validation utility MUST configure English locale messaging for Zod errors.
- **FR-007**: Schema families SHOULD use discriminated unions for event/change variants where a
  `type` discriminator exists.
- **FR-008**: Schema families SHOULD use explicit defaulting (`prefault`) for optional fields that
  require stable runtime defaults.
- **FR-009**: The package MUST publish ESM and CJS build outputs and dual declaration outputs.
- **FR-010**: Unit tests MUST verify friendly error message behavior for root-level and nested path
  failures.

### Key Entities _(include if feature involves data)_

- **Schema Domain Barrel**: Export group for one contract family (`contentful`, `experience`,
  `insights`, `validation`).
- **Validation Utility**: `parseWithFriendlyError` adapter over `schema.safeParse`.
- **Discriminated Contract Family**: Schema set keyed by `type` literals for runtime event/change
  routing.
- **Published Artifact Set**: Dist outputs for `.mjs`, `.cjs`, and type declarations.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Validation utility tests pass for success, root-error, and nested-path cases.
- **SC-002**: A clean package build emits both `dist/index.mjs` and `dist/index.cjs`.
- **SC-003**: A clean package build emits dual declaration outputs for both import and require type
  resolution.
- **SC-004**: Dependent workspace packages can import root/domain schemas without type errors.
