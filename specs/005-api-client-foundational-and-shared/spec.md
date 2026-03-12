# Feature Specification: API Client Foundational and Shared Contracts

**Feature Branch**: `[005-api-client-foundational-and-shared]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initialize One Aggregated Client with Shared Config (Priority: P1)

As an SDK integrator, I need one top-level client that wires Experience and Insights with shared
config plus per-client overrides.

**Why this priority**: `ApiClient` is the main package entrypoint.

**Independent Test**: Instantiate `ApiClient` and verify `.experience`/`.insights` creation and base
URL isolation.

**Acceptance Scenarios**:

1. **Given** `ApiClientConfig` with `clientId`, **When** `ApiClient` is created, **Then** both
   `ExperienceApiClient` and `InsightsApiClient` instances are created.
2. **Given** per-client base URL overrides, **When** `ApiClient` is created, **Then** each
   sub-client uses only its own override.
3. **Given** a runtime-only top-level `baseUrl`, **When** `ApiClient` is created, **Then** it is
   ignored by sub-clients.

---

### User Story 2 - Apply Shared Timeout/Retry Transport Protection (Priority: P1)

As a client maintainer, I need shared fetch wrappers so timeout, retry, and error behavior stays
consistent across APIs.

**Why this priority**: Experience and Insights clients both rely on `Fetch.create(...)`.

**Independent Test**: Verify timeout callback/log behavior, retry-on-503 policy, and wrapper
composition order.

**Acceptance Scenarios**:

1. **Given** protected fetch options, **When** `createProtectedFetchMethod` runs, **Then** timeout
   wrapping is composed before retry wrapping.
2. **Given** a timeout and no `onRequestTimeout`, **When** the timeout elapses, **Then** a timeout
   error is logged and the request is aborted.
3. **Given** a `503` response and retries available, **When** retry wrapper executes, **Then**
   failed attempts are retried.
4. **Given** a non-`503` non-OK response, **When** retry wrapper executes, **Then** it stops
   retrying and throws a non-retriable error message.

---

### User Story 3 - Keep a Correct Package Export Surface (Priority: P2)

As a downstream developer, I need accurate import boundaries so I can use root exports and subpath
exports correctly.

**Why this priority**: Root and subpath exports are intentionally different.

**Independent Test**: Validate package exports map and root entrypoint contents.

**Acceptance Scenarios**:

1. **Given** root import `@contentful/optimization-api-client`, **When** consumed, **Then** it
   exports `ApiClient`, `ApiClientBase`, and Experience/Insights modules.
2. **Given** schema or logger imports, **When** consumed, **Then** they are accessed via
   `@contentful/optimization-api-client/api-schemas` and
   `@contentful/optimization-api-client/logger`.

---

### Edge Cases

- `ApiClientBase` must default `environment` to `'main'`.
- `logRequestError` must ignore thrown values that are not `Error` instances.
- Retry policy must treat only HTTP `503` as retriable.
- Non-503 non-OK responses must terminate retry flow and throw a generic non-retriable message.
- `createProtectedFetchMethod` logs only synchronous setup failures; runtime request failures are
  handled by wrapped methods and callers.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ApiClientConfig` MUST include `clientId`, optional `environment`, optional
  `fetchOptions`, and optional `personalization`/`analytics` per-client overrides.
- **FR-002**: `ApiClient` MUST construct `ExperienceApiClient` and `InsightsApiClient` using shared
  config merged with respective per-client overrides.
- **FR-003**: Top-level `ApiClientConfig` MUST NOT type a shared `baseUrl`; base URLs are
  per-client.
- **FR-004**: `ApiClientBase` MUST default `environment` to `'main'` when omitted.
- **FR-005**: `ApiClientBase` MUST create fetch via
  `Fetch.create({ ...(fetchOptions ?? {}), apiName: name })`.
- **FR-006**: `ApiClientBase.logRequestError` MUST log `AbortError` at warning level.
- **FR-007**: `ApiClientBase.logRequestError` MUST log non-abort `Error` values at error level.
- **FR-008**: `ApiClientBase.logRequestError` MUST no-op for non-`Error` values.
- **FR-009**: `createTimeoutFetchMethod` MUST default `requestTimeout` to `3000`.
- **FR-010**: `createTimeoutFetchMethod` MUST call `onRequestTimeout({ apiName })` when provided,
  otherwise log a timeout error, then abort.
- **FR-011**: `createRetryFetchMethod` MUST default to `retries: 1` and `intervalTimeout: 0`.
- **FR-012**: `createRetryFetchMethod` MUST retry only on HTTP `503`.
- **FR-013**: `createRetryFetchMethod` MUST call `onFailedAttempt` with `apiName`, `attemptNumber`,
  `retriesLeft`, and the retry error for retriable failures.
- **FR-014**: `createRetryFetchMethod` MUST throw
  `${apiName} API request to "<url>" may not be retried.` when no successful response is returned.
- **FR-015**: `createProtectedFetchMethod` MUST compose timeout first, then retry with
  `fetchMethod: timeoutFetchMethod`.
- **FR-016**: `createProtectedFetchMethod` MUST log and rethrow synchronous setup errors for `Error`
  instances (warn for `AbortError`, error otherwise).
- **FR-017**: Root package exports MUST include API client and domain modules; logger and schema
  re-exports MUST be provided through `./logger` and `./api-schemas` subpath exports.
- **FR-018**: Build output MUST include ESM (`.mjs`), CJS (`.cjs`), and dual declarations
  (`.d.mts`/`.d.cts`) for each configured entrypoint.

### Key Entities _(include if feature involves data)_

- **ApiClient**: Aggregated client exposing `.experience` and `.insights`.
- **ApiClientBase**: Shared base class for config defaults, fetch creation, and request error logs.
- **Fetch Wrapper Stack**: Timeout wrapper composed under retry wrapper.
- **Fetch Callback Metadata**: Callback payload fields (`apiName`, `error`, `attemptNumber`,
  `retriesLeft`).
- **Export Surface**: Root module plus explicit `./logger` and `./api-schemas` subpath interfaces.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `ApiClient` tests verify both sub-clients are created and per-client base URLs stay
  isolated.
- **SC-002**: Timeout/retry tests verify timeout callbacks/logging, 503-only retries, and
  non-retriable failures.
- **SC-003**: `ApiClientBase` tests verify abort/error/no-op logging behavior for request failures.
- **SC-004**: Build emits dual runtime and dual declaration outputs for configured entrypoints.
