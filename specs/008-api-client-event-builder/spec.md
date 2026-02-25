# Feature Specification: Event Builder Contracts

**Feature Branch**: `[008-api-client-event-builder]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Derive SpecKit-compatible specs from current Event Builder
functionality in `@contentful/optimization-api-client`."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Build Shared Event Metadata Automatically (Priority: P1)

As an SDK consumer, I need a reusable builder that injects consistent universal event metadata so
all event types share channel, timestamps, and context defaults.

**Why this priority**: Universal metadata consistency is required for both Experience and Insights
event ingestion.

**Independent Test**: Construct an `EventBuilder` with minimal config and verify universal fields
and fallback values on built events.

**Acceptance Scenarios**:

1. **Given** only required builder config (`channel`, `library`), **When** `buildTrack` is called,
   **Then** timestamps, message ID, GDPR consent, locale default, and default page context are
   populated.
2. **Given** optional overrides in method args (`locale`, `campaign`, `page`, etc.), **When** events
   are built, **Then** overrides are used in universal context.

---

### User Story 2 - Build Typed Event Variants with Safe Defaults (Priority: P1)

As an application developer, I need specialized builder methods for component, flag, identify, page,
screen, and track events so event payloads conform to schema contracts with minimal boilerplate.

**Why this priority**: Typed builder methods are the main ergonomics layer for producing valid
events.

**Independent Test**: Call each builder method with valid and invalid inputs and verify output
discriminators, required fields, and defaulted values.

**Acceptance Scenarios**:

1. **Given** valid component args without variant index, **When** `buildComponentView` is called,
   **Then** `variantIndex` defaults to `0` and `componentType` is `'Entry'`.
2. **Given** valid component args, **When** `buildFlagView` is called, **Then** event type remains
   `component` and `componentType` is `'Variable'`.
3. **Given** identify args without traits, **When** `buildIdentify` is called, **Then** `traits`
   defaults to an empty object.
4. **Given** track args without properties, **When** `buildTrack` is called, **Then** `properties`
   defaults to an empty object.

---

### User Story 3 - Enforce Context-Specific Event Shape (Priority: P2)

As a maintainer, I need page and screen events to normalize context shape correctly so page events
do not carry screen-only context and screen events do not carry page-only context.

**Why this priority**: Context normalization avoids mixed-context payloads and schema drift.

**Independent Test**: Build page/screen events with mixed universal args and verify context pruning
and schema parsing behavior.

**Acceptance Scenarios**:

1. **Given** page-view inputs, **When** `buildPageView` is called, **Then** output context is parsed
   as `PageEventContext` and excludes screen context.
2. **Given** screen-view inputs, **When** `buildScreenView` is called, **Then** output context is
   parsed as `ScreenEventContext` and excludes page context.
3. **Given** invalid method arguments, **When** a builder method is called, **Then** argument
   parsing fails with friendly schema errors.

---

### Edge Cases

- If `getLocale` returns `undefined`, locale must fall back to `'en-US'`.
- If base page properties omit `title`, page view payload must fall back to empty-string title.
- Page view properties are deep-merged with base page properties rather than replaced.
- `buildScreenView` requires `properties` input (no default object at method level).
- Universal timestamp fields (`originalTimestamp`, `sentAt`, `timestamp`) are generated from the
  same instant.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `EventBuilder` constructor MUST require `channel` and `library`.
- **FR-002**: Constructor MUST allow optional `app`, `getLocale`, `getPageProperties`, and
  `getUserAgent`.
- **FR-003**: Constructor defaults MUST be: `getLocale: () => 'en-US'`,
  `getPageProperties: () => DEFAULT_PAGE_PROPERTIES`, `getUserAgent: () => undefined`.
- **FR-004**: `DEFAULT_PAGE_PROPERTIES` MUST include: `path`, `query`, `referrer`, `search`,
  `title`, `url` with empty defaults.
- **FR-005**: Universal event building MUST set `channel`, `context.app`, `context.campaign`,
  `context.gdpr.isConsentGiven=true`, `context.library`, `context.locale`, optional
  location/page/screen/userAgent, `messageId`, and ISO timestamp fields.
- **FR-006**: `messageId` MUST be generated using `crypto.randomUUID()`.
- **FR-007**: `buildComponentView` MUST validate args, emit `type: 'component'`,
  `componentType: 'Entry'`, and default `variantIndex` to `0` when omitted.
- **FR-008**: `buildFlagView` MUST reuse `buildComponentView` output and override
  `componentType: 'Variable'`.
- **FR-009**: `buildIdentify` MUST require `userId` and default missing `traits` to `{}`.
- **FR-010**: `buildPageView` MUST accept optional args and default to `{}`.
- **FR-011**: `buildPageView` MUST merge page properties from `getPageProperties()` with provided
  partial overrides and fallback title to `DEFAULT_PAGE_PROPERTIES.title` when needed.
- **FR-012**: `buildPageView` MUST remove screen context and validate resulting context with
  `PageEventContext`.
- **FR-013**: `buildScreenView` MUST require `name` and `properties`.
- **FR-014**: `buildScreenView` MUST remove page context and validate resulting context with
  `ScreenEventContext`.
- **FR-015**: `buildTrack` MUST require `event` and default missing `properties` to `{}`.
- **FR-016**: All builder methods MUST validate input arguments using schema parsing with friendly
  error semantics.

### Key Entities _(include if feature involves data)_

- **EventBuilder**: Helper for creating typed events compatible with Experience/Insights contracts.
- **UniversalEventBuilderArgs**: Optional shared overrides applied to all event variants.
- **ComponentViewBuilderArgs / IdentifyBuilderArgs / PageViewBuilderArgs / ScreenViewBuilderArgs /
  TrackBuilderArgs**: Method-specific validated argument contracts.
- **DEFAULT_PAGE_PROPERTIES**: Canonical fallback page context object used across builder methods.
- **UniversalEventProperties**: Shared emitted fields attached to every built event.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every builder method returns a payload matching its expected event discriminator and
  required properties.
- **SC-002**: Default behaviors (locale, page fields, traits/properties, variant index) are
  deterministic when optional inputs are omitted.
- **SC-003**: Page and screen events emit context compatible with their respective context schemas.
- **SC-004**: Invalid arguments are rejected during builder invocation with actionable validation
  errors.
