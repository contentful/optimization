# Feature Specification: Contentful Optimization Web State Management

**Feature Branch**: `[015-web-state-management]`  
**Created**: 2026-02-27  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-25).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initialize Runtime State from Persisted Storage (Priority: P1)

As a Web SDK integrator, I need consent, profile, changes, selected optimizations, and anonymous
identity restored from browser persistence so user context survives page reloads.

**Why this priority**: Persisted state continuity is required for stable optimization behavior.

**Independent Test**: Pre-populate localStorage/cookies, initialize `ContentfulOptimization`, and
verify merged defaults plus anonymous ID cookie initialization behavior.

**Acceptance Scenarios**:

1. **Given** persisted localStorage values for consent/profile/changes/selected optimizations,
   **When** `ContentfulOptimization` is created, **Then** merged defaults use those values.
2. **Given** a legacy anonymous ID cookie, **When** initialization runs, **Then** the legacy cookie
   is removed.
3. **Given** a resolved cookie anonymous ID that differs from LocalStore anonymous ID, **When**
   initialization runs, **Then** SDK state is reset and anonymous ID persistence is updated to the
   cookie value.

---

### User Story 2 - Keep Runtime Signals and Persistence in Sync (Priority: P1)

As a maintainer, I need signal changes mirrored to localStorage/cookies so runtime mutations from
API responses and consent actions are persisted automatically.

**Why this priority**: Without synchronization effects, persisted state diverges from runtime state.

**Independent Test**: Update core signals (`consent`, `profile`, `changes`, `selectedOptimizations`)
and assert corresponding LocalStore/cookie writes and consent-gated interaction runtime behavior.

**Acceptance Scenarios**:

1. **Given** `signals.changes` updates, **When** effects run, **Then** `LocalStore.changes` reflects
   latest value.
2. **Given** `signals.profile` updates with `profile.id`, **When** effects run, **Then** anonymous
   ID cookie and `LocalStore.anonymousId` are updated.
3. **Given** `signals.selectedOptimizations` updates, **When** effects run, **Then**
   `LocalStore.selectedOptimizations` reflects latest value.
4. **Given** `signals.consent` updates and auto-tracked entry interactions are configured, **When**
   consent changes, **Then** configured interactions are synchronized through
   `syncAutoTrackedEntryInteractions(!!consent)`.

---

### User Story 3 - Reset and Persist Safely Under Storage Failures (Priority: P2)

As a runtime operator, I need storage operations and reset paths to be fault-tolerant so SDK
behavior remains functional even with malformed cached values or write/remove failures.

**Why this priority**: Browser storage behavior can be inconsistent; runtime should continue.

**Independent Test**: Force localStorage parse/write/remove failures and invoke reset; verify no
throws and expected cleanup behavior.

**Acceptance Scenarios**:

1. **Given** malformed JSON or schema-invalid cached values, **When** LocalStore cached reads occur,
   **Then** values resolve as `undefined` and invalid cache entries are removed.
2. **Given** localStorage write/remove exceptions, **When** LocalStore updates occur, **Then**
   errors are swallowed and SDK continues.
3. **Given** `contentfulOptimization.reset()`, **When** invoked, **Then** entry interaction tracking
   stops, anonymous ID cookie is removed, LocalStore runtime caches are cleared, and core reset is
   executed.

---

### Edge Cases

- `LocalStore.reset()` defaults to preserving consent and debug flags unless explicitly requested.
- `contentfulOptimization.reset()` preserves consent by default because `LocalStore.reset()` does
  not clear it and core reset intentionally retains consent.
- Setting anonymous ID to `undefined` clears both cookie and localStorage anonymous ID state.
- Cookie expiration defaults to 365 days when not provided.
- LocalStore consent values map `'accepted' -> true`, `'denied' -> false`, and other values ->
  `undefined`.
- Legacy localStorage anonymous ID key is removed after migration read.
- Legacy anonymous ID cookie removal does not imply unconditional re-write of the current cookie;
  current cookie persistence is re-written when cookie value differs from LocalStore value.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Web config merging MUST default `defaults.consent`, `.changes`, `.profile`, and
  `.selectedOptimizations` from LocalStore (`consent`, `changes`, `profile`,
  `selectedOptimizations`) when these defaults are omitted by the caller.
- **FR-002**: `ContentfulOptimization` MUST read current and legacy anonymous ID cookies during
  construction.
- **FR-003**: Initialization MUST remove legacy anonymous ID cookie when present.
- **FR-004**: Initialization MUST reset SDK state and apply resolved cookie anonymous ID when the
  resolved cookie ID differs from `LocalStore.anonymousId`.
- **FR-005**: `ContentfulOptimization` MUST derive cookie attributes from config, using optional
  `domain` and default `expires=365` days when not supplied.
- **FR-006**: `setAnonymousId(undefined)` MUST remove anonymous ID cookie and clear
  `LocalStore.anonymousId`.
- **FR-007**: `setAnonymousId(value)` MUST persist anonymous ID to cookie and LocalStore.
- **FR-008**: Effects MUST synchronize `signals.changes.value` to `LocalStore.changes`.
- **FR-009**: Effects MUST synchronize `signals.consent.value` to `LocalStore.consent`.
- **FR-010**: Effects MUST synchronize `signals.profile.value` to `LocalStore.profile`.
- **FR-011**: Profile synchronization MUST call anonymous ID persistence with `profile?.id`.
- **FR-012**: Effects MUST synchronize `signals.selectedOptimizations.value` to
  `LocalStore.selectedOptimizations`.
- **FR-013**: Consent synchronization MUST gate automatic tracked entry interactions via
  `syncAutoTrackedEntryInteractions(!!consent)`.
- **FR-014**: `ContentfulOptimization.reset()` MUST reset entry interaction runtime state, clear
  anonymous ID cookie, clear LocalStore runtime caches, and delegate to `CoreStateful.reset()`.
- **FR-015**: `ContentfulOptimization.destroy()` MUST NOT clear persisted user state by default.
- **FR-016**: `LocalStore.anonymousId` getter MUST prefer legacy key when present and remove legacy
  key after read.
- **FR-017**: `LocalStore.getCache()` MUST parse stored JSON with schema validation and return
  `undefined` when absent/invalid.
- **FR-018**: `LocalStore.getCache()` MUST clear storage key when parsing or validation fails.
- **FR-019**: `LocalStore.setCache()` MUST remove key when input is `undefined`; otherwise it MUST
  persist strings verbatim and non-strings as JSON.
- **FR-020**: `LocalStore.setCache()` MUST swallow storage persistence exceptions and log warnings.
- **FR-021**: `LocalStore.reset()` MUST clear anonymous ID, changes, profile, and selected
  optimizations, and MUST clear consent/debug only when reset options request it.
- **FR-022**: `LocalStore.consent` translation MUST persist booleans as `'accepted'|'denied'` and
  read unknown stored values as `undefined`.

### Key Entities _(include if feature involves data)_

- **LocalStore**: Browser localStorage abstraction for persisted optimization state.
- **Anonymous ID Persistence**: Cookie + localStorage identity synchronization contract.
- **Signal Synchronization Effects**: Reactive bridges from core signals to browser persistence and
  consent-gated interaction runtime behavior.
- **Reset Semantics**: Coordinated local and core state cleanup behavior for Web runtime.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: State initialization checks confirm persisted LocalStore defaults are restored and
  anonymous ID cookie initialization behavior is applied.
- **SC-002**: Signal synchronization tests confirm consent/profile/changes/selectedOptimizations
  writes are persisted automatically and consent gates configured auto-tracked interactions.
- **SC-003**: Reset tests confirm anonymous ID cleanup, LocalStore cleanup, entry interaction
  runtime reset, and core reset delegation.
- **SC-004**: Fault-injection tests confirm malformed cache values and storage write/remove
  exceptions do not crash runtime behavior.
