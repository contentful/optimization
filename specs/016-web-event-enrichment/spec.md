# Feature Specification: Optimization Web Event Enrichment

**Feature Branch**: `[016-web-event-enrichment]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in `@contentful/optimization-web`
package and derive SpecKit-compatible specifications."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Enrich Events with Web Context by Default (Priority: P1)

As an integrator, I need events emitted from the Web SDK to include browser context metadata without
writing custom enrichment code for locale, page, and user-agent fields.

**Why this priority**: Event observability and analysis depend on consistent context enrichment.

**Independent Test**: Initialize `Optimization` with minimal config, emit events, and verify
event-builder defaults for channel/library/locale/page/user-agent are applied.

**Acceptance Scenarios**:

1. **Given** default Web SDK configuration, **When** events are built, **Then** event builder uses
   `channel: 'web'` and Web SDK library metadata.
2. **Given** browser context with languages and location data, **When** enrichers run, **Then**
   locale, page properties, and user-agent values are provided from browser APIs.
3. **Given** app metadata in configuration, **When** events are built, **Then** app metadata is
   included in event builder defaults.

---

### User Story 2 - Preserve Robust Fallbacks for Enrichment Inputs (Priority: P1)

As a maintainer, I need enrichment helpers to fail safely so event building continues even when
window/document access is unavailable or throws.

**Why this priority**: Browser APIs can fail under SSR-like, test, or restricted runtime conditions.

**Independent Test**: Force browser API failures in `getPageProperties` and verify fallback payload
shape and error-handling behavior.

**Acceptance Scenarios**:

1. **Given** `getPageProperties` can read browser globals, **When** it executes, **Then** it returns
   full page metadata including dimensions/hash/query/title/referrer.
2. **Given** `getPageProperties` throws while reading browser globals, **When** it executes,
   **Then** it logs an error and returns a minimal safe fallback payload.
3. **Given** URL query parameters exist, **When** query building runs, **Then** query entries are
   flattened into a plain dictionary.

---

### User Story 3 - Support Extensible and Reliable Delivery Metadata (Priority: P2)

As an SDK extender, I need configurable event-builder overrides and a beacon transport helper so I
can customize enrichment while preserving default Web event-delivery behavior.

**Why this priority**: Extensibility and lifecycle-safe delivery improve adoption across host apps.

**Independent Test**: Supply event-builder overrides and invoke beacon handler; verify override
merge behavior and sendBeacon payload format.

**Acceptance Scenarios**:

1. **Given** user-supplied event-builder overrides, **When** config merge runs, **Then** defaults
   are merged with user values rather than dropped.
2. **Given** a batch insights payload, **When** `beaconHandler` executes, **Then** data is
   serialized as JSON blob (`text/plain`) and sent via `navigator.sendBeacon`.
3. **Given** build-time constants are missing, **When** library metadata is read, **Then** fallback
   package name/version constants are used.

---

### Edge Cases

- Locale resolution must prefer `navigator.languages[0]` and fall back to `navigator.language`.
- `getPageProperties` fallback payload omits hash/width/height but must still include stable
  string/query keys.
- Query extraction preserves one string value per key based on URLSearchParams iteration behavior.
- Beacon helper returns the browser-provided boolean from `sendBeacon` without additional retries.
- Build-time constant replacements are optional; fallback constants must keep event metadata valid.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Web config merging MUST default event-builder channel to `'web'`.
- **FR-002**: Web config merging MUST default event-builder library metadata to
  `OPTIMIZATION_WEB_SDK_NAME` and `OPTIMIZATION_WEB_SDK_VERSION`.
- **FR-003**: Web config merging MUST include optional configured `app` metadata in event-builder
  defaults.
- **FR-004**: Web config merging MUST default event-builder enrichers to `getLocale`,
  `getPageProperties`, and `getUserAgent`.
- **FR-005**: Web config merging MUST allow user-supplied event-builder overrides via deep merge.
- **FR-006**: `getLocale()` MUST return `navigator.languages[0]` when present, otherwise
  `navigator.language`.
- **FR-007**: `getPageProperties()` MUST return page metadata with `hash`, `height`, `path`,
  `query`, `referrer`, `search`, `title`, `url`, and `width` when browser globals are accessible.
- **FR-008**: `getPageProperties()` MUST derive `query` by iterating URL search params into a plain
  dictionary.
- **FR-009**: `getPageProperties()` MUST catch runtime errors, log the error, and return fallback
  payload `{ path: '', query: {}, referrer: '', search: '', title: '', url: '' }`.
- **FR-010**: `getUserAgent()` MUST return `navigator.userAgent`.
- **FR-011**: `beaconHandler(url, events)` MUST serialize events as JSON into a Blob with MIME type
  `text/plain`.
- **FR-012**: `beaconHandler` MUST return the boolean result of `window.navigator.sendBeacon`.
- **FR-013**: `OPTIMIZATION_WEB_SDK_NAME` MUST resolve to build-time replacement when available,
  otherwise `'@contentful/optimization-web'`.
- **FR-014**: `OPTIMIZATION_WEB_SDK_VERSION` MUST resolve to build-time replacement when available,
  otherwise `'0.0.0'`.

### Key Entities _(include if feature involves data)_

- **Web Event Builder Defaults**: Channel/library/app/enricher configuration injected at runtime.
- **Page Enrichment Payload**: Browser-derived page context object attached to page-related events.
- **Beacon Transport Payload**: Serialized `BatchInsightsEventArray` sent through Beacon API.
- **SDK Metadata Constants**: Build-time-replaced or fallback library identification values.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Default initialization tests confirm web channel/library metadata and enrichers are
  present in event builder config.
- **SC-002**: Enricher tests confirm locale/page/user-agent helpers produce expected browser-derived
  values and fallback payloads.
- **SC-003**: Override tests confirm custom event-builder fields can be merged without losing
  defaults.
- **SC-004**: Beacon transport tests confirm serialized batch payloads are queued via `sendBeacon`.
