# Feature Specification: Event Builder Contract Boundary

**Feature Branch**: `[008-api-client-event-builder]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Avoid Incorrect Imports from API Client Package (Priority: P1)

As an SDK consumer, I need the package surface to clearly exclude event-builder APIs so I do not
import non-existent symbols from `@contentful/optimization-api-client`.

**Why this priority**: Import failures are a high-friction integration error.

**Independent Test**: Check root exports and package `exports` map for builder symbols/subpaths.

**Acceptance Scenarios**:

1. **Given** root import usage, **When** consuming `@contentful/optimization-api-client`, **Then**
   no `EventBuilder` export is available.
2. **Given** subpath imports, **When** checking package exports, **Then** no event-builder subpath
   is defined.

---

### User Story 2 - Keep Event Construction Responsibility in the Correct Package (Priority: P1)

As a maintainer, I need event-construction concerns documented outside this package so API client
scope remains transport-focused.

**Why this priority**: Current architecture separates event building from API transport.

**Independent Test**: Verify package README and source entrypoints describe this boundary.

**Acceptance Scenarios**:

1. **Given** API client documentation, **When** reading Event Construction guidance, **Then** it
   points to `@contentful/optimization-core` instead of local builder APIs.
2. **Given** API client source entrypoints, **When** inspected, **Then** only API client root
   exports and logger/schema subpath surfaces are exposed.

---

### User Story 3 - Keep Usable Event Contracts Available for External Builders (Priority: P2)

As an integrator using another builder package, I need typed event schemas still accessible so
externally built events can be validated and sent through this client package.

**Why this priority**: API-client methods depend on schema-valid event payloads.

**Independent Test**: Verify schema re-export subpath and client method signatures.

**Acceptance Scenarios**:

1. **Given** consumers importing `@contentful/optimization-api-client/api-schemas`, **When** used,
   **Then** Experience API/Insights API event schemas are available.
2. **Given** `ExperienceApiClient` and `InsightsApiClient` methods, **When** called, **Then** they
   accept schema-typed event payloads without requiring local builder APIs.

---

### Edge Cases

- Attempting to import `EventBuilder` from the package root should fail type resolution.
- Attempting an event-builder subpath import should fail module resolution (no export map entry).
- Event ingestion still works with externally constructed payloads that satisfy schema contracts.
- This package may evolve later, but current behavior contains no event-builder implementation.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `@contentful/optimization-api-client` root exports MUST NOT include `EventBuilder`.
- **FR-002**: Package `exports` MUST include `.`, `./logger`, and `./api-schemas` (plus
  `./package.json`) and MUST NOT include an event-builder subpath.
- **FR-003**: Source root entrypoint (`src/index.ts`) MUST export API client classes/base and
  Experience API/Insights API modules only.
- **FR-004**: Schema re-exports MUST remain available via `src/api-schemas.ts` and package subpath
  `./api-schemas`.
- **FR-005**: Documentation in this package MUST state that event-construction helpers are provided
  by `@contentful/optimization-core` and related environment SDKs.
- **FR-006**: Experience API/Insights API client contracts MUST continue to accept typed event
  payloads from external builders or manual construction.

### Key Entities _(include if feature involves data)_

- **API Client Root Surface**: Exports from `src/index.ts` and package root export map.
- **Schema Subpath Surface**: `@contentful/optimization-api-client/api-schemas` re-export contract.
- **Logger Subpath Surface**: `@contentful/optimization-api-client/logger`.
- **Event Builder Boundary**: Explicit absence of event-builder implementation in this package.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Package inspection confirms no root or subpath event-builder export exists.
- **SC-002**: README Event Construction section points consumers to `@contentful/optimization-core`.
- **SC-003**: Schema contracts remain available through `./api-schemas` for external event builders.
- **SC-004**: API client methods continue to accept valid externally built event payloads.
