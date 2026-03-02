# Feature Specification: Optimization React Native State Management

**Feature Branch**: `[020-react-native-state-management]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-02).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Hydrate SDK State from AsyncStorage on Startup (Priority: P1)

As a mobile SDK integrator, I need persisted consent/profile/changes/personalizations restored at
startup so personalization and analytics continuity survives app restarts.

**Why this priority**: Persistent state hydration is foundational for consistent user experience.

**Independent Test**: Pre-populate AsyncStorage keys, run `Optimization.create(...)`, and verify
merged defaults and log-level behavior use stored values when caller defaults are omitted.

**Acceptance Scenarios**:

1. **Given** stored values for consent/profile/changes/personalizations, **When** SDK initializes,
   **Then** those values are used as effective defaults when not overridden.
2. **Given** a stored debug flag set to true, **When** config is merged, **Then** runtime log level
   defaults to `'debug'`.
3. **Given** caller-provided defaults, **When** config is merged, **Then** caller values override
   storage-derived defaults.
4. **Given** no `allowedEventTypes` override, **When** React Native config is merged, **Then**
   `allowedEventTypes` defaults to `['identify', 'screen']`.
5. **Given** caller-provided `allowedEventTypes`, **When** config is merged, **Then** caller values
   override the React Native default allow-list.

---

### User Story 2 - Synchronize Runtime Signals Back to Persistence (Priority: P1)

As a maintainer, I need reactive synchronization from core signals to AsyncStorage so runtime state
mutations are persisted without manual write calls.

**Why this priority**: Signal/storage drift would break profile continuity and personalization.

**Independent Test**: Mutate core signals (`changes`, `consent`, `profile`, `personalizations`) and
verify matching AsyncStorageStore writes.

**Acceptance Scenarios**:

1. **Given** `signals.changes.value` changes, **When** effects run, **Then**
   `AsyncStorageStore.changes` is updated.
2. **Given** `signals.profile.value` changes, **When** effects run, **Then**
   `AsyncStorageStore.profile` is updated and anonymous ID is synchronized from `profile.id` with
   fallback to stored anonymous ID.
3. **Given** `signals.consent.value` or `signals.personalizations.value` changes, **When** effects
   run, **Then** corresponding AsyncStorageStore keys are updated.

---

### User Story 3 - Survive Malformed Cache Data and Storage Failures (Priority: P2)

As an operator, I need storage parsing and persistence to fail safely so the SDK remains functional
when AsyncStorage values are corrupted or storage operations fail.

**Why this priority**: Mobile storage can be unavailable or contain invalid payloads.

**Independent Test**: Inject malformed JSON, schema-invalid values, and rejected AsyncStorage
operations; verify invalid values are removed and runtime avoids throws.

**Acceptance Scenarios**:

1. **Given** malformed JSON in structured cache keys, **When** initialization parses values,
   **Then** invalid keys are removed and treated as undefined.
2. **Given** schema-invalid structured values, **When** initialization or getter validation runs,
   **Then** invalid keys are removed and treated as undefined.
3. **Given** AsyncStorage `setItem`/`removeItem` failures, **When** cache writes or invalidations
   occur, **Then** errors are logged and execution continues.

---

### Edge Cases

- Store initialization may fail entirely (`multiGet` rejection); SDK bootstrap must continue with
  best-effort behavior.
- Structured cache getters must re-validate in-memory values and invalidate stale/invalid entries.
- Consent string mapping must be strict: `'accepted' -> true`, `'denied' -> false`, everything else
  -> `undefined`.
- Destroying the SDK instance must not implicitly clear persisted AsyncStorage values.
- Anonymous ID synchronization must preserve prior stored ID when profile updates do not include an
  `id`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: AsyncStorage-backed state MUST be initialized before merged runtime config is
  computed.
- **FR-002**: Initialization MUST load known cache keys for anonymous ID, consent, debug, changes,
  profile, and personalizations.
- **FR-003**: Initialization MUST treat string keys (`anonymousId`, `consent`, `debug`) as raw
  string values.
- **FR-004**: Initialization MUST parse structured keys (`changes`, `profile`, `personalizations`)
  from JSON and validate them with schema parsers.
- **FR-005**: Malformed structured JSON MUST trigger cache invalidation and AsyncStorage key
  removal.
- **FR-006**: Schema-invalid structured values MUST trigger cache invalidation and AsyncStorage key
  removal.
- **FR-007**: Initialization failures MUST be logged without throwing.
- **FR-008**: Merged config MUST default `defaults.consent` from AsyncStorage when caller value is
  omitted.
- **FR-009**: Merged config MUST default `defaults.profile` from AsyncStorage when caller value is
  omitted.
- **FR-010**: Merged config MUST default `defaults.changes` from AsyncStorage when caller value is
  omitted.
- **FR-011**: Merged config MUST default `defaults.personalizations` from AsyncStorage when caller
  value is omitted.
- **FR-012**: Merged config MUST default `logLevel` to `'debug'` when persisted debug flag is
  truthy; otherwise it MUST preserve caller-provided log level.
- **FR-013**: Runtime effects MUST synchronize `signals.changes.value` to persisted changes state.
- **FR-014**: Runtime effects MUST synchronize `signals.consent.value` to persisted consent state.
- **FR-015**: Runtime effects MUST synchronize `signals.profile.value` to persisted profile state.
- **FR-016**: Profile synchronization MUST update anonymous ID persistence using
  `profile?.id ?? storedAnonymousId`.
- **FR-017**: Runtime effects MUST synchronize `signals.personalizations.value` to persisted
  personalizations state.
- **FR-018**: Consent setter MUST translate booleans to storage strings (`accepted`/`denied`) and
  clear storage when undefined.
- **FR-019**: `getCache` MUST validate in-memory structured values and invalidate/remove keys that
  fail schema validation.
- **FR-020**: `setCache(key, undefined)` MUST remove key from in-memory cache and AsyncStorage.
- **FR-021**: `setCache(key, value)` MUST persist strings verbatim and non-string values as JSON.
- **FR-022**: AsyncStorage write/remove failures during `setCache` or invalidation MUST be logged
  and swallowed.
- **FR-023**: React Native merged config MUST default `allowedEventTypes` to
  `['identify', 'screen']` when caller configuration omits it.
- **FR-024**: Caller-provided `allowedEventTypes` MUST override the React Native default allow-list.

### Key Entities _(include if feature involves data)_

- **AsyncStorageStore**: In-memory + AsyncStorage write-through cache for SDK runtime state.
- **State Hydration Contract**: Startup behavior that merges persisted values into SDK defaults.
- **Signal Persistence Effects**: Reactive synchronizers from core signals to AsyncStorage keys.
- **Structured Cache Parsers**: Schema validators for `changes`, `profile`, and `personalizations`
  data integrity.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Startup tests confirm omitted defaults are hydrated from AsyncStorage-backed state.
- **SC-002**: Effect tests confirm changes/consent/profile/personalizations are persisted when
  signals update.
- **SC-003**: Invalid-cache tests confirm malformed or schema-invalid values are removed and
  resolved as undefined.
- **SC-004**: Fault tests confirm AsyncStorage operation failures do not crash runtime execution.
- **SC-005**: Merge-config tests confirm React Native defaults `allowedEventTypes` to
  `['identify', 'screen']` and preserves caller-provided `allowedEventTypes`.
