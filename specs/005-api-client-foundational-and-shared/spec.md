# Feature Specification: API Client Foundational and Shared Contracts

**Feature Branch**: `[005-api-client-foundational-and-shared]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configure a Single Aggregated Client (Priority: P1)

As an SDK integrator, I need one top-level client that wires both Experience and Insights APIs with
shared configuration so I can initialize once and call both APIs consistently.

**Why this priority**: Aggregation and config inheritance are the primary entry point for runtime
adoption.

**Independent Test**: Instantiate `ApiClient` with shared config and verify `experience` and
`insights` clients receive shared fields plus per-client overrides.

**Acceptance Scenarios**:

1. **Given** a valid `ApiClient` config with `clientId`, **When** the client is created, **Then**
   `.experience` and `.insights` are initialized and available.
2. **Given** per-client `baseUrl` overrides, **When** the client is created, **Then** each
   sub-client uses only its own override.
3. **Given** an unsupported top-level `baseUrl` at runtime, **When** the client is created, **Then**
   sub-clients ignore it.

---

### User Story 2 - Apply Shared Transport Protection (Priority: P1)

As an API client maintainer, I need shared timeout, retry, and error logging behavior so transport
failures are handled consistently across all API clients.

**Why this priority**: Cross-client transport consistency prevents divergent reliability and logging
behavior.

**Independent Test**: Verify `Fetch.create` composition, timeout callbacks, retry-on-503 behavior,
and log behavior for abort vs non-abort errors.

**Acceptance Scenarios**:

1. **Given** protected fetch configuration, **When** `Fetch.create` is called, **Then** timeout
   protection is composed before retry protection.
2. **Given** a request timeout, **When** no custom timeout callback is provided, **Then** the
   timeout wrapper logs an error and aborts the request.
3. **Given** a `503` response, **When** retry config allows attempts, **Then** the request is
   retried.
4. **Given** a non-`503` non-OK response, **When** retry logic executes, **Then** retries stop and
   the request fails with a non-retriable error.

---

### User Story 3 - Preserve a Stable Shared Package Surface (Priority: P2)

As a downstream package developer, I need a stable root export surface so I can import client types,
builders, and schema contracts from one package.

**Why this priority**: Multiple workspace packages depend on a predictable shared import surface.

**Independent Test**: Build/typecheck dependent packages importing from the root package and verify
dual module output artifacts.

**Acceptance Scenarios**:

1. **Given** root imports from `@contentful/optimization-api-client`, **When** consumers import
   client/builders/experience/insights/schema exports, **Then** type resolution succeeds.
2. **Given** a production build, **When** artifacts are emitted, **Then** both ESM/CJS bundles and
   dual declarations are generated.

---

### Edge Cases

- Missing `environment` must default to `'main'`.
- `ApiClientBase.logRequestError` must not log for thrown values that are not `Error` instances.
- Timeout aborts may be transformed into a generic non-retriable request error by retry handling.
- Retry logic must treat only `503` as retryable under current transport policy.
- `createProtectedFetchMethod` must rethrow original errors after logging (for `Error` instances).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ApiClient` MUST accept shared config fields `clientId`, optional `environment`, and
  optional `fetchOptions`.
- **FR-002**: `ApiClient` MUST construct both `ExperienceApiClient` and `InsightsApiClient` from
  shared config merged with per-client overrides.
- **FR-003**: Shared config MUST NOT define a top-level supported `baseUrl` field; base URLs are
  per-client configuration.
- **FR-004**: `ApiClientBase` MUST default `environment` to `'main'` when omitted.
- **FR-005**: `ApiClientBase` MUST create its fetch method via
  `Fetch.create({ ...fetchOptions, apiName })`.
- **FR-006**: `ApiClientBase.logRequestError` MUST log abort errors at warning level with request
  context.
- **FR-007**: `ApiClientBase.logRequestError` MUST log non-abort `Error` instances at error level.
- **FR-008**: `ApiClientBase.logRequestError` MUST ignore non-`Error` thrown values.
- **FR-009**: `createTimeoutFetchMethod` MUST default `requestTimeout` to `3000ms`.
- **FR-010**: `createTimeoutFetchMethod` MUST invoke `onRequestTimeout({ apiName })` when provided
  before aborting.
- **FR-011**: `createTimeoutFetchMethod` MUST log timeout failure when no timeout callback is
  provided.
- **FR-012**: `createRetryFetchMethod` MUST default to `retries: 1` and `intervalTimeout: 0`.
- **FR-013**: `createRetryFetchMethod` MUST retry only when response status is `503`.
- **FR-014**: `createRetryFetchMethod` MUST abort and fail non-`503` failures as non-retriable
  request errors.
- **FR-015**: `createRetryFetchMethod` MUST pass `apiName` to `onFailedAttempt` callback metadata.
- **FR-016**: `createProtectedFetchMethod` MUST compose timeout wrapper first, then retry wrapper.
- **FR-017**: `createProtectedFetchMethod` MUST log and rethrow `Error` failures (abort vs non-abort
  severity differs).
- **FR-018**: Package root exports MUST include API client classes, builders, experience/insights
  modules, and re-exported schema contracts.
- **FR-019**: Package build output MUST include ESM (`.mjs`), CJS (`.cjs`), and dual declaration
  types (`.d.mts`/`.d.cts`).

### Key Entities _(include if feature involves data)_

- **ApiClient**: Aggregated top-level client exposing `.experience` and `.insights`.
- **ApiClientBase**: Shared base class for config, protected fetch creation, and request error
  logging.
- **Protected Fetch Method**: Timeout + retry composed fetch wrapper used by all API clients.
- **Fetch Callback Options**: Metadata passed to timeout/retry callbacks (`apiName`, attempt data,
  optional error).
- **Package Export Surface**: Root and submodule contract exposed to downstream packages.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `ApiClient` initialization tests confirm both sub-clients are always constructed.
- **SC-002**: Runtime tests confirm per-client `baseUrl` overrides remain isolated.
- **SC-003**: Transport wrapper tests confirm timeout, retry, and callback behavior under success
  and failure paths.
- **SC-004**: Build artifacts include dual runtime module formats and dual declaration formats.
