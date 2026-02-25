# Feature Specification: Experience API Client Contracts

**Feature Branch**: `[006-api-client-experience-api]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Derive SpecKit-compatible specs from current Experience client
behavior in `@contentful/optimization-api-client`."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Retrieve and Mutate Profiles Reliably (Priority: P1)

As a personalization runtime developer, I need strongly defined profile read/write methods so I can
fetch, create, and update profile state with predictable request/response behavior.

**Why this priority**: Profile retrieval and mutation are core Experience API capabilities.

**Independent Test**: Execute `getProfile`, `createProfile`, and `updateProfile` with valid and
invalid input and validate URL shape, headers, response mapping, and thrown errors.

**Acceptance Scenarios**:

1. **Given** a valid profile ID, **When** `getProfile(id)` is called, **Then** the client requests
   `/profiles/:id` and returns `{ profile, personalizations, changes }`.
2. **Given** a missing/empty profile ID, **When** `getProfile` or `updateProfile` is called,
   **Then** a validation error is thrown before network execution.
3. **Given** valid events, **When** `createProfile` or `updateProfile` is called, **Then** the body
   is schema-validated and a parsed Experience response is returned.

---

### User Story 2 - Apply Request Options with Deterministic Precedence (Priority: P1)

As an integrator, I need request option precedence to be deterministic across client defaults and
per-call overrides so transport and API semantics stay predictable.

**Why this priority**: Option precedence affects behavior across SSR, browser, and server contexts.

**Independent Test**: Configure client-level defaults and per-request overrides; verify query
params, headers, and body options match precedence rules.

**Acceptance Scenarios**:

1. **Given** client-level options and no per-call overrides, **When** a mutation request is sent,
   **Then** defaults apply.
2. **Given** per-request overrides (`plainText`, `ip`, `preflight`, `locale`), **When** a request is
   sent, **Then** override values are applied.
3. **Given** no explicit `enabledFeatures`, **When** request body options are built, **Then**
   default features are included.

---

### User Story 3 - Upsert Many Profiles in a Single Batch (Priority: P2)

As a backend developer, I need a batch upsert endpoint wrapper so multiple anonymous profile events
can be sent in one request and return updated profiles.

**Why this priority**: Batch profile upserts are high-value for server-side throughput.

**Independent Test**: Call `upsertManyProfiles` with valid and invalid batches and verify endpoint,
content type, and parsed profile list behavior.

**Acceptance Scenarios**:

1. **Given** a non-empty valid batch event array, **When** `upsertManyProfiles` is called, **Then**
   the client posts to `/events` and returns parsed `profiles`.
2. **Given** an empty batch array, **When** `upsertManyProfiles` is called, **Then** validation
   fails and the request is rejected.

---

### Edge Cases

- `baseUrl` defaults to `https://experience.ninetailed.co/` when omitted or falsey.
- `plainText` defaults to `true` for profile mutation requests, while `upsertManyProfiles` uses
  `plainText: false` as its method-level fallback.
- Missing or empty `enabledFeatures` resolves to default `['ip-enrichment', 'location']`.
- `preflight` adds `type=preflight` query only when effective value is `true`.
- `getProfile` method options intentionally exclude `plainText` and `preflight`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ExperienceApiClient` MUST default `baseUrl` to `https://experience.ninetailed.co/`
  when no truthy override is provided.
- **FR-002**: `getProfile(id, options)` MUST reject empty IDs with
  `Error('Valid profile ID required.')`.
- **FR-003**: `getProfile` MUST issue `GET` to
  `/v2/organizations/{clientId}/environments/{environment}/profiles/{id}`.
- **FR-004**: `createProfile` MUST issue `POST` to
  `/v2/organizations/{clientId}/environments/{environment}/profiles`.
- **FR-005**: `updateProfile` MUST reject empty `profileId` and otherwise issue `POST` to
  `/v2/organizations/{clientId}/environments/{environment}/profiles/{profileId}`.
- **FR-006**: `upsertProfile` MUST route to `createProfile` when `profileId` is absent and
  `updateProfile` when `profileId` is present.
- **FR-007**: `upsertManyProfiles` MUST issue `POST` to
  `/v2/organizations/{clientId}/environments/{environment}/events`.
- **FR-008**: All profile mutation requests MUST send `keepalive: true`.
- **FR-009**: Mutation request headers MUST include `Content-Type: text/plain` by default.
- **FR-010**: Mutation request headers MUST switch to `Content-Type: application/json` when
  effective `plainText` is `false`.
- **FR-011**: Mutation request headers MUST include `X-Force-IP` when effective `ip` is provided.
- **FR-012**: Request URL construction MUST apply `locale` query param from per-request override,
  else client default, when available.
- **FR-013**: Request URL construction MUST apply `type=preflight` query param when effective
  `preflight` is true.
- **FR-014**: Singular profile mutation body MUST validate against `ExperienceRequestData` and
  include schema-validated `events`.
- **FR-015**: Batch mutation body MUST validate against `BatchExperienceRequestData`.
- **FR-016**: Body options MUST include `features`, using effective `enabledFeatures` when
  non-empty, otherwise defaulting to `['ip-enrichment', 'location']`.
- **FR-017**: `upsertManyProfiles` MUST use `plainText: false` as the default method-level request
  option before applying call-time overrides.
- **FR-018**: `getProfile`, `createProfile`, and `updateProfile` MUST parse responses with
  `ExperienceResponse` and map `experiences` to returned `personalizations`.
- **FR-019**: `upsertManyProfiles` MUST parse responses with `BatchExperienceResponse` and return
  `data.profiles`.
- **FR-020**: On request failure, Experience client methods MUST log via `logRequestError` and
  rethrow the original error.

### Key Entities _(include if feature involves data)_

- **ExperienceApiClient**: API client for profile retrieval/mutation and batch upserts.
- **RequestOptions**: Effective option set controlling locale/preflight/query/body/header behavior.
- **ExperienceRequestData**: Validated payload for singular profile mutations.
- **BatchExperienceRequestData**: Validated payload for batch profile updates.
- **OptimizationData**: Returned shape containing `profile`, `personalizations`, and `changes`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Experience client tests confirm endpoint paths and query parameter behavior for
  profile read/write operations.
- **SC-002**: Invalid IDs and empty event arrays are rejected before successful request completion.
- **SC-003**: Header/content-type behavior is deterministic across defaults and overrides.
- **SC-004**: Batch upsert returns parsed profile arrays for valid inputs and rejects invalid
  batches.
