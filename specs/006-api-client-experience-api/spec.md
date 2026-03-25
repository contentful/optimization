# Feature Specification: Experience API Client Contracts

**Feature Branch**: `[006-api-client-experience-api]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Read and Mutate Profiles via Experience API (Priority: P1)

As a personalization runtime developer, I need typed profile read/write methods so profile state can
be fetched or updated with predictable request/response handling.

**Why this priority**: Profile fetch and mutation are the core Experience client functions.

**Independent Test**: Exercise `getProfile`, `createProfile`, and `updateProfile` with valid and
invalid inputs.

**Acceptance Scenarios**:

1. **Given** a valid profile ID, **When** `getProfile(id)` is called, **Then** it requests
   `/profiles/{id}` and returns `{ profile, selectedOptimizations, changes }`.
2. **Given** an empty ID, **When** `getProfile` or `updateProfile` is called, **Then** it throws
   `Error('Valid profile ID required.')` before request execution.
3. **Given** valid events, **When** `createProfile` or `updateProfile` is called, **Then** the body
   is schema-validated and the parsed `ExperienceResponse` data is returned in mapped form.

---

### User Story 2 - Resolve Request Option Precedence Predictably (Priority: P1)

As an integrator, I need deterministic precedence between client defaults and per-call options for
headers, query params, and body options.

**Why this priority**: Option resolution affects behavior across server and browser contexts.

**Independent Test**: Set client defaults, then override per call and inspect effective request
output.

**Acceptance Scenarios**:

1. **Given** client-level defaults and no per-call override, **When** a mutation request is made,
   **Then** default values are used.
2. **Given** per-call options (`plainText`, `ip`, `preflight`, `locale`), **When** request URL and
   headers are built, **Then** per-call values override client defaults.
3. **Given** missing or empty `enabledFeatures`, **When** body options are built, **Then** features
   default to `['ip-enrichment', 'location']`.

---

### User Story 3 - Upsert Many Profiles in One Request (Priority: P2)

As a backend developer, I need batch upsert support so multiple anonymous profile events can be
processed in a single call.

**Why this priority**: Batch upsert is the throughput-oriented Experience API operation.

**Independent Test**: Call `upsertManyProfiles` with valid and empty event arrays.

**Acceptance Scenarios**:

1. **Given** a valid non-empty batch, **When** `upsertManyProfiles` is called, **Then** it posts to
   `/events` and returns parsed `data.profiles`.
2. **Given** an empty batch, **When** `upsertManyProfiles` is called, **Then** schema validation
   fails before successful completion.

---

### Edge Cases

- `baseUrl` defaults to `https://experience.ninetailed.co/` for any falsey override.
- Mutation requests default to `Content-Type: text/plain`; `upsertManyProfiles` applies method-level
  fallback `plainText: false`.
- `upsertManyProfiles` still allows explicit call-time override after that fallback
  (`{ plainText: false, ...options }`).
- `getProfile` options intentionally exclude `plainText` and `preflight` at type level.
- Query `type=preflight` is included only when effective `preflight` is truthy.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ExperienceApiClient` MUST default `baseUrl` to `https://experience.ninetailed.co/`
  when `config.baseUrl` is falsey.
- **FR-002**: `getProfile(id, options)` MUST throw `Error('Valid profile ID required.')` when `id`
  is empty.
- **FR-003**: `getProfile` MUST issue `GET` to
  `/v2/organizations/{clientId}/environments/{environment}/profiles/{id}`.
- **FR-004**: `createProfile` MUST issue `POST` to
  `/v2/organizations/{clientId}/environments/{environment}/profiles`.
- **FR-005**: `updateProfile` MUST throw on empty `profileId`; otherwise it MUST issue `POST` to
  `/v2/organizations/{clientId}/environments/{environment}/profiles/{profileId}`.
- **FR-006**: `upsertProfile` MUST delegate to `createProfile` when `profileId` is falsy and to
  `updateProfile` when `profileId` is truthy.
- **FR-007**: `upsertManyProfiles` MUST issue `POST` to
  `/v2/organizations/{clientId}/environments/{environment}/events`.
- **FR-008**: All mutation requests MUST use `keepalive: true`.
- **FR-009**: Mutation headers MUST include `Content-Type: text/plain` when effective `plainText` is
  true (or omitted).
- **FR-010**: Mutation headers MUST include `Content-Type: application/json` when effective
  `plainText` is false.
- **FR-011**: Mutation headers MUST include `X-Force-IP` when effective `ip` is set.
- **FR-012**: URL construction MUST apply effective `locale` from `options.locale ?? client.locale`.
- **FR-013**: URL construction MUST apply `type=preflight` when effective `preflight` is truthy.
- **FR-014**: Singular mutation request bodies MUST be validated as `ExperienceRequestData` and MUST
  include parsed `ExperienceEventArray` events.
- **FR-015**: Batch mutation request bodies MUST be validated with `BatchExperienceRequestData`.
- **FR-016**: Request body `options.features` MUST use effective non-empty `enabledFeatures`; else
  it MUST default to `['ip-enrichment', 'location']`.
- **FR-017**: `upsertManyProfiles` MUST call profile mutation with
  `options: { plainText: false, ...options }`.
- **FR-018**: `getProfile`, `createProfile`, and `updateProfile` MUST parse with
  `ExperienceResponse` and return `{ profile, selectedOptimizations: experiences, changes }`.
- **FR-019**: `upsertManyProfiles` MUST parse with `BatchExperienceResponse` and return
  `data.profiles`.
- **FR-020**: On caught request failures, `getProfile`, `createProfile`, `updateProfile`, and
  `upsertManyProfiles` MUST call `logRequestError` and rethrow.

### Key Entities _(include if feature involves data)_

- **ExperienceApiClient**: Experience transport client for profile operations.
- **RequestOptions**: Per-request option set (`enabledFeatures`, `ip`, `locale`, `plainText`,
  `preflight`).
- **ExperienceRequestData**: Validated singular mutation payload.
- **BatchExperienceRequestData**: Validated batch mutation payload.
- **OptimizationData**: Returned shape `{ profile, selectedOptimizations, changes }`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Tests confirm endpoint path and query behavior for read/write methods.
- **SC-002**: Empty IDs and empty event arrays are rejected by method-level/schema validation.
- **SC-003**: Content type, IP header, and feature options resolve deterministically across defaults
  and overrides.
- **SC-004**: Batch upsert returns parsed `profiles` for valid input and rejects invalid batches.
