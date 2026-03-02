# Feature Specification: Insights API Client Contracts

**Feature Branch**: `[007-api-client-insights-api]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Send Validated Batch Events to Insights (Priority: P1)

As an analytics integrator, I need batched events to be validated and posted to the Insights ingest
endpoint so invalid payloads fail early and valid payloads are sent consistently.

**Why this priority**: Batched event ingestion is the primary Insights client capability.

**Independent Test**: Send valid/invalid `BatchInsightsEventArray` payloads and verify schema
validation, endpoint URL, headers, and boolean result behavior.

**Acceptance Scenarios**:

1. **Given** valid event batches, **When** `sendBatchEvents` is called without beacon support,
   **Then** the client posts JSON to `/events` and returns `true`.
2. **Given** invalid batch shape, **When** `sendBatchEvents` is called, **Then** payload validation
   fails before request execution.

---

### User Story 2 - Prefer Beacon Queuing When Available (Priority: P1)

As a web runtime developer, I need optional beacon-based queuing so event delivery can use
non-blocking browser transport when available.

**Why this priority**: Beacon transport improves unload-time reliability and runtime performance.

**Independent Test**: Provide beacon handlers at client and per-call scope; verify call precedence
and fallback-to-fetch behavior.

**Acceptance Scenarios**:

1. **Given** a beacon handler that returns `true`, **When** `sendBatchEvents` is called, **Then** no
   fetch request is made and the method resolves `true`.
2. **Given** a beacon handler that returns `false`, **When** `sendBatchEvents` is called, **Then**
   the client logs a warning and falls back to immediate fetch.
3. **Given** both client-level and method-level handlers, **When** `sendBatchEvents` is called with
   method options, **Then** the method-level handler takes precedence.

---

### User Story 3 - Signal Delivery Outcomes Predictably (Priority: P2)

As a caller implementing retry/circuit policy above the client, I need deterministic boolean success
signals so I can decide whether to retain or drop queued analytics batches.

**Why this priority**: Upstream queue policy depends on stable success/failure semantics.

**Independent Test**: Simulate network failures and confirm method returns `false` after logging,
without throwing transport errors.

**Acceptance Scenarios**:

1. **Given** a network error during fetch path, **When** `sendBatchEvents` is called, **Then**
   request failure is logged and the method resolves `false`.
2. **Given** successful fetch or successful beacon queue, **When** `sendBatchEvents` completes,
   **Then** the method resolves `true`.

---

### Edge Cases

- `baseUrl` defaults to `https://ingest.insights.ninetailed.co/` when omitted or falsey.
- Beacon handler receives a `URL` object and validated payload, not raw caller input.
- `sendBatchEvents` can succeed without performing fetch when beacon queuing succeeds.
- Fetch failures return `false` instead of rethrowing.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `InsightsApiClient` MUST default `baseUrl` to `https://ingest.insights.ninetailed.co/`
  when no truthy override is provided.
- **FR-002**: `sendBatchEvents` MUST construct request URL
  `/v1/organizations/{clientId}/environments/{environment}/events` against effective `baseUrl`.
- **FR-003**: `sendBatchEvents` MUST validate `batches` using `BatchInsightsEventArray` prior to
  transmission.
- **FR-004**: `sendBatchEvents` MUST resolve effective `beaconHandler` by preferring per-request
  handler over client-level handler.
- **FR-005**: When effective `beaconHandler` exists, `sendBatchEvents` MUST call it with
  `(url, validatedBody)`.
- **FR-006**: When `beaconHandler` returns `true`, `sendBatchEvents` MUST return `true` without
  fetch.
- **FR-007**: When `beaconHandler` returns `false`, `sendBatchEvents` MUST log a warning and
  continue via fetch transport.
- **FR-008**: Fetch fallback MUST `POST` JSON with `Content-Type: application/json`,
  `keepalive: true`, and `body: JSON.stringify(validatedBody)`.
- **FR-009**: Successful fetch fallback MUST return `true`.
- **FR-010**: Fetch failure MUST invoke shared request error logging and return `false`.
- **FR-011**: `sendBatchEvents` MUST NOT throw transport errors from fetch path; failures are
  represented by `false`.

### Key Entities _(include if feature involves data)_

- **InsightsApiClient**: API client responsible for Insights batch ingestion.
- **BatchInsightsEventArray**: Validated request payload contract for batched profile-scoped events.
- **Beacon Handler**: Optional transport strategy for queued/non-blocking event delivery.
- **Delivery Result**: Boolean contract indicating enqueue/send success (`true`) or failure
  (`false`).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Valid batched events are accepted and sent to the correct ingest path.
- **SC-002**: Beacon success path bypasses fetch while still returning `true`.
- **SC-003**: Beacon failure path logs warning and falls back to fetch successfully.
- **SC-004**: Network failure path logs request failure and returns `false` without throwing.
