# Feature Specification: Optimization Web State Management

**Feature Branch**: `[015-web-state-management]`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Examine the current functionality in `@contentful/optimization-web`
package and derive SpecKit-compatible specifications."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initialize Runtime State from Persisted Storage (Priority: P1)

As a Web SDK integrator, I need consent, profile, changes, personalizations, and anonymous identity
to be restored from browser persistence so user context survives page reloads.

**Why this priority**: Persisted state continuity is required for stable personalization behavior.

**Independent Test**: Pre-populate localStorage/cookies, initialize `Optimization`, and verify
defaults and anonymous ID migration/reset behavior.

**Acceptance Scenarios**:

1. **Given** persisted localStorage values for consent/profile/changes/personalizations, **When**
   `Optimization` is created, **Then** merged defaults use those values.
2. **Given** a legacy anonymous ID cookie, **When** initialization runs, **Then** the legacy cookie
   is removed and current anonymous ID is derived from the migrated value.
3. **Given** a persisted cookie anonymous ID that differs from in-memory/local state, **When**
   initialization runs, **Then** SDK state is reset and anonymous ID is updated to cookie value.

---

### User Story 2 - Keep Runtime Signals and Persistence in Sync (Priority: P1)

As a maintainer, I need state signal changes mirrored to localStorage/cookies so runtime mutations
from API responses and consent actions are persisted automatically.

**Why this priority**: Without synchronization effects, persisted state diverges from runtime state.

**Independent Test**: Update core signals (`consent`, `profile`, `changes`, `personalizations`) and
assert corresponding LocalStore and cookie writes.

**Acceptance Scenarios**:

1. **Given** `signals.changes` updates, **When** effects run, **Then** `LocalStore.changes` reflects
   latest value.
2. **Given** `signals.profile` updates with `profile.id`, **When** effects run, **Then** anonymous
   ID cookie and LocalStore anonymous ID are updated.
3. **Given** `signals.consent` updates and auto-tracking is enabled, **When** consent changes,
   **Then** auto entry tracking starts on consented state and stops otherwise.

---

### User Story 3 - Reset and Persist Safely Under Storage Failures (Priority: P2)

As a runtime operator, I need storage operations and reset paths to be fault-tolerant so SDK
behavior remains functional even with blocked or malformed browser storage.

**Why this priority**: Browsers often restrict storage access; SDK must continue operating.

**Independent Test**: Force localStorage parse/write/remove failures and invoke reset; verify no
throws and expected cleanup behavior.

**Acceptance Scenarios**:

1. **Given** malformed JSON or schema-invalid cached values, **When** LocalStore reads occur,
   **Then** values resolve as `undefined` and invalid cache entries are removed.
2. **Given** localStorage write/remove exceptions, **When** LocalStore updates occur, **Then**
   errors are swallowed and SDK continues.
3. **Given** `optimization.reset()`, **When** invoked, **Then** entry tracking stops, anonymous ID
   cookie is removed, LocalStore runtime caches are cleared, and core reset is executed.

---

### Edge Cases

- `LocalStore.reset()` defaults to preserving consent and debug flags unless explicitly requested.
- `optimization.reset()` must preserve consent by default because LocalStore reset does not clear it
  and core reset intentionally retains consent.
- Setting anonymous ID to `undefined` must clear both cookie and localStorage anonymous ID key.
- Cookie expiration defaults to 365 days when not provided.
- LocalStore consent values must map `'accepted' -> true`, `'denied' -> false`, anything else ->
  `undefined`.
- Legacy localStorage anonymous ID key must be removed after migration.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Web config merging MUST default `defaults.consent`, `.changes`, `.profile`, and
  `.personalizations` from LocalStore when these defaults are omitted by the caller.
- **FR-002**: `Optimization` MUST read current and legacy anonymous ID cookies during construction.
- **FR-003**: Initialization MUST remove legacy anonymous ID cookie when present.
- **FR-004**: Initialization MUST reset SDK state and apply cookie anonymous ID when persisted
  cookie ID differs from LocalStore anonymous ID.
- **FR-005**: `Optimization` MUST derive cookie attributes from config, using optional `domain` and
  default `expires=365` days when not supplied.
- **FR-006**: `setAnonymousId(undefined)` MUST remove anonymous ID cookie and clear
  `LocalStore.anonymousId`.
- **FR-007**: `setAnonymousId(value)` MUST persist anonymous ID to cookie and LocalStore.
- **FR-008**: Effects MUST synchronize `signals.changes.value` to `LocalStore.changes`.
- **FR-009**: Effects MUST synchronize `signals.consent.value` to `LocalStore.consent`.
- **FR-010**: Effects MUST synchronize `signals.profile.value` to `LocalStore.profile`.
- **FR-011**: Profile synchronization MUST call anonymous ID persistence with `profile?.id`.
- **FR-012**: Effects MUST synchronize `signals.personalizations.value` to
  `LocalStore.personalizations`.
- **FR-013**: Consent effect MUST gate automatic entry view tracking: start when consent truthy and
  `autoTrackEntryViews` is enabled; stop otherwise.
- **FR-014**: `Optimization.reset()` MUST stop auto entry tracking, clear anonymous ID cookie, clear
  LocalStore runtime caches, and delegate to `CoreStateful.reset()`.
- **FR-015**: `Optimization.destroy()` MUST NOT clear persisted user state by default.
- **FR-016**: `LocalStore.anonymousId` getter MUST prefer legacy key when present and remove legacy
  key after read.
- **FR-017**: `LocalStore.getCache()` MUST parse stored JSON with schema validation and return
  `undefined` when absent/invalid.
- **FR-018**: `LocalStore.getCache()` MUST clear storage key when parsing or validation fails.
- **FR-019**: `LocalStore.setCache()` MUST remove key when input is `undefined`; otherwise it MUST
  persist strings verbatim and non-strings as JSON.
- **FR-020**: `LocalStore.setCache()` MUST swallow storage persistence exceptions and log warnings.
- **FR-021**: `LocalStore.reset()` MUST clear anonymous ID, changes, profile, and personalizations,
  and MUST clear consent/debug only when reset options request it.

### Key Entities _(include if feature involves data)_

- **LocalStore**: Browser localStorage abstraction for persisted optimization state.
- **Anonymous ID Persistence**: Cookie + localStorage identity synchronization contract.
- **Signal Synchronization Effects**: Reactive bridges from core signals to browser persistence.
- **Reset Semantics**: Coordinated local and core state cleanup behavior for Web runtime.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Initialization tests confirm persisted localStorage/cookie values are restored and
  legacy cookie migration logic applies correctly.
- **SC-002**: Signal synchronization tests confirm consent/profile/changes/personalizations writes
  are persisted automatically.
- **SC-003**: Reset tests confirm anonymous ID cleanup, LocalStore cleanup, and core reset
  delegation.
- **SC-004**: Fault-injection tests confirm malformed cache values and storage exceptions never
  crash runtime behavior.
