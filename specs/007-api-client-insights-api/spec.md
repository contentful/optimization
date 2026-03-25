# Feature Specification: Insights API Client Contracts

**Feature Branch**: `[007-api-client-insights-api]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Send Validated Insights Batches (Priority: P1)

As an Insights API integrator, I need batch payloads validated and sent to the Insights ingest
endpoint so malformed data fails before transport.

**Why this priority**: `sendBatchEvents` is the core Insights API client surface.

**Independent Test**: Call `sendBatchEvents` with valid/invalid `BatchInsightsEventArray` payloads.

**Acceptance Scenarios**:

1. **Given** valid batches and no effective beacon success, **When** `sendBatchEvents` runs,
   **Then** it sends JSON to `/events` and returns `true`.
2. **Given** invalid batch input, **When** `sendBatchEvents` runs, **Then** schema parsing fails
   before fetch.

---

### User Story 2 - Prefer Beacon Queueing When Available (Priority: P1)

As a web runtime developer, I need optional beacon dispatch so events can be queued without blocking
normal page lifecycle flow.

**Why this priority**: Beacon queueing is the low-latency fast path for client-side Insights API
delivery.

**Independent Test**: Use client-level and per-call beacon handlers and verify precedence/fallback.

**Acceptance Scenarios**:

1. **Given** a beacon handler that returns `true`, **When** `sendBatchEvents` runs, **Then** it
   returns `true` without fetch fallback.
2. **Given** a beacon handler that returns `false`, **When** `sendBatchEvents` runs, **Then** it
   logs a warning and sends via fetch.
3. **Given** both client-level and per-call handlers, **When** per-call options are provided,
   **Then** the per-call handler is used.

---

### User Story 3 - Return Deterministic Delivery Status (Priority: P2)

As a caller managing queue retention policy, I need stable boolean success semantics from
`sendBatchEvents`.

**Why this priority**: Higher-level retry/drop behavior depends on this return value.

**Independent Test**: Simulate fetch success and fetch network failure.

**Acceptance Scenarios**:

1. **Given** fetch transport failure, **When** `sendBatchEvents` runs, **Then** it logs via
   `logRequestError` and returns `false`.
2. **Given** successful beacon queue or successful fetch fallback, **When** `sendBatchEvents`
   completes, **Then** it returns `true`.

---

### Edge Cases

- `baseUrl` defaults to `https://ingest.insights.ninetailed.co/` for falsey overrides.
- Beacon handlers receive `(url: URL, data: BatchInsightsEventArray)` where `data` is already
  schema-validated.
- Fetch-path failures return `false`; they are not rethrown from the fetch `try/catch`.
- Exceptions thrown during validation or inside `beaconHandler` are not caught by fetch error
  handling and can propagate.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `InsightsApiClient` MUST default `baseUrl` to `https://ingest.insights.ninetailed.co/`
  when `config.baseUrl` is falsey.
- **FR-002**: `sendBatchEvents` MUST build URL
  `/v1/organizations/{clientId}/environments/{environment}/events` against effective `baseUrl`.
- **FR-003**: `sendBatchEvents` MUST validate `batches` with
  `parseWithFriendlyError(BatchInsightsEventArray, batches)`.
- **FR-004**: `sendBatchEvents` MUST resolve effective `beaconHandler` using
  `options.beaconHandler ?? this.beaconHandler`.
- **FR-005**: When a handler exists, `sendBatchEvents` MUST call it with `(url, validatedBody)`.
- **FR-006**: If handler returns `true`, `sendBatchEvents` MUST return `true` and skip fetch
  fallback.
- **FR-007**: If handler returns `false`, `sendBatchEvents` MUST log a warning and continue to
  fetch.
- **FR-008**: Fetch fallback MUST `POST` with `Content-Type: application/json`, `keepalive: true`,
  and `body: JSON.stringify(validatedBody)`.
- **FR-009**: Successful fetch fallback MUST return `true`.
- **FR-010**: Fetch fallback failure MUST call
  `logRequestError(error, { requestName: 'Event Batches' })`.
- **FR-011**: After fetch fallback failure, `sendBatchEvents` MUST return `false`.

### Key Entities _(include if feature involves data)_

- **InsightsApiClient**: Transport client for Insights API event ingestion.
- **BatchInsightsEventArray**: Validated request payload for profile-scoped event batches.
- **Beacon Handler**: Optional synchronous function returning queue success/failure.
- **Delivery Result**: Boolean method result (`true` success, `false` fetch-path failure).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Valid batches are posted to the correct ingest endpoint and return `true`.
- **SC-002**: Beacon success path bypasses fetch and returns `true`.
- **SC-003**: Beacon failure path logs warning, falls back to fetch, and can still return `true`.
- **SC-004**: Network failure on fetch path logs request error and returns `false`.
