# Feature Specification: Optimization React Native State Management

**Feature Branch**: `[020-react-native-state-management]`  
**Created**: 2026-02-26  
**Status**: Current (Pre-release)  
**Input**: Repository behavior review for the current pre-release implementation (validated
2026-03-12).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Hydrate Runtime Defaults from AsyncStorage at Initialization (Priority: P1)

As a mobile SDK integrator, I need persisted state loaded before runtime construction so consent,
profile, changes, and optimizations survive app restarts.

**Why this priority**: Startup state continuity is required for predictable personalization and
event guard behavior.

**Independent Test**: Seed AsyncStorage keys, call `ContentfulOptimization.create(...)`, and verify
merged defaults/log-level/allow-list behavior.

**Acceptance Scenarios**:

1. **Given** persisted consent/profile/changes/optimizations, **When** create-time merge runs,
   **Then** those values are used when caller defaults are omitted.
2. **Given** caller-provided defaults for consent/profile/changes/optimizations, **When**
   create-time merge runs, **Then** caller defaults override persisted values.
3. **Given** persisted debug flag resolves true, **When** config merge runs, **Then** resolved
   `logLevel` is forced to `'debug'`.
4. **Given** no `allowedEventTypes` override, **When** React Native merge runs, **Then**
   `allowedEventTypes` resolves to `['identify', 'screen']`.
5. **Given** caller-provided `allowedEventTypes`, **When** merge runs, **Then** caller values are
   preserved.

---

### User Story 2 - Persist Core Signal Changes Back to AsyncStorage (Priority: P1)

As a maintainer, I need runtime signal updates mirrored into AsyncStorage-backed state so storage
and in-memory state remain aligned.

**Why this priority**: Signal/storage drift breaks profile continuity and personalization behavior
across sessions.

**Independent Test**: Mutate relevant core signals and verify corresponding `AsyncStorageStore`
getters/setters and persistence calls.

**Acceptance Scenarios**:

1. **Given** `signals.changes.value` updates, **When** effects run, **Then**
   `AsyncStorageStore.changes` is updated.
2. **Given** `signals.consent.value` updates, **When** effects run, **Then**
   `AsyncStorageStore.consent` is updated using accepted/denied mapping.
3. **Given** `signals.profile.value` updates, **When** effects run, **Then**
   `AsyncStorageStore.profile` is updated and anonymous ID is synchronized using
   `profile?.id ?? storedAnonymousId`.
4. **Given** `signals.selectedOptimizations.value` updates, **When** effects run, **Then**
   `AsyncStorageStore.optimizations` is updated.

---

### User Story 3 - Handle Corrupt Storage Data and Storage I/O Failures Safely (Priority: P2)

As an operator, I need parse/validation/storage failures handled without crashes so SDK runtime
stays available even when device storage is corrupted or unreliable.

**Why this priority**: Mobile storage corruption and transient I/O failures are common in
production.

**Independent Test**: Inject malformed JSON, schema-invalid values, and rejected AsyncStorage
operations and verify invalidation/logging/no-throw behavior.

**Acceptance Scenarios**:

1. **Given** malformed JSON for structured cache keys, **When** store initialization runs, **Then**
   the key is invalidated and removed.
2. **Given** schema-invalid structured values, **When** initialization or getter validation runs,
   **Then** the key is invalidated and removed.
3. **Given** AsyncStorage `setItem` or `removeItem` rejects, **When** persistence/invalidation runs,
   **Then** errors are logged and execution continues.
4. **Given** AsyncStorage initialization (`multiGet`) fails, **When** create-time merge runs,
   **Then** initialization failure is logged and SDK creation flow continues.

---

### Edge Cases

- Store initialization is idempotent after first successful load (`initialized` short-circuit).
- Structured getters re-validate cached values and invalidate stale invalid data on access.
- Consent mapping is strict: `'accepted' -> true`, `'denied' -> false`, all other values ->
  `undefined`.
- `setCache(key, undefined)` removes in-memory cache and AsyncStorage key.
- React Native instance `destroy()` does not clear persisted AsyncStorage values.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: React Native merge logic MUST await `AsyncStorageStore.initialize()` before building
  merged runtime config.
- **FR-002**: `AsyncStorageStore.initialize()` MUST load known keys for anonymous ID, consent,
  changes, debug flag, profile, and optimizations via `multiGet`.
- **FR-003**: Initialization MUST treat `anonymousId`, `consent`, and `debug` keys as raw string
  values.
- **FR-004**: Initialization MUST parse structured keys (`changes`, `profile`, `optimizations`) as
  JSON and validate against schema parsers.
- **FR-005**: Malformed JSON in structured keys MUST invalidate cache and remove the key from
  AsyncStorage.
- **FR-006**: Schema-invalid structured values MUST invalidate cache and remove the key from
  AsyncStorage.
- **FR-007**: Initialization failures MUST be logged and MUST NOT throw.
- **FR-008**: Merged config MUST default `defaults.consent` from AsyncStorage when caller value is
  omitted.
- **FR-009**: Merged config MUST default `defaults.profile` from AsyncStorage when caller value is
  omitted.
- **FR-010**: Merged config MUST default `defaults.changes` from AsyncStorage when caller value is
  omitted.
- **FR-011**: Merged config MUST default `defaults.selectedOptimizations` from AsyncStorage when
  caller value is omitted.
- **FR-012**: Caller-provided defaults for consent/profile/changes/optimizations MUST override
  storage-derived defaults.
- **FR-013**: Merged config MUST set `logLevel` to `'debug'` when persisted debug resolves true;
  otherwise merged config MUST keep caller-provided `logLevel` value.
- **FR-014**: React Native merged config MUST set `allowedEventTypes` to `['identify', 'screen']`
  when caller omits `allowedEventTypes`.
- **FR-015**: Caller-provided `allowedEventTypes` MUST override React Native default allow-list.
- **FR-016**: Runtime effect wiring MUST persist `signals.changes.value` to
  `AsyncStorageStore.changes`.
- **FR-017**: Runtime effect wiring MUST persist `signals.consent.value` to
  `AsyncStorageStore.consent`.
- **FR-018**: Runtime effect wiring MUST persist `signals.profile.value` to
  `AsyncStorageStore.profile`.
- **FR-019**: Profile persistence effect MUST sync anonymous ID as
  `AsyncStorageStore.anonymousId = profile?.id ?? storedAnonymousId`.
- **FR-020**: Runtime effect wiring MUST persist `signals.selectedOptimizations.value` to
  `AsyncStorageStore.optimizations`.
- **FR-021**: Consent setter MUST map `true -> 'accepted'`, `false -> 'denied'`, and
  `undefined -> remove key`.
- **FR-022**: `getCache` MUST re-validate structured in-memory values and invalidate/remove keys
  that fail validation.
- **FR-023**: `setCache(key, undefined)` MUST delete cache entry and call AsyncStorage `removeItem`.
- **FR-024**: `setCache(key, value)` MUST persist strings verbatim and non-string values as JSON.
- **FR-025**: AsyncStorage write/remove failures in `setCache` and invalidation flows MUST be logged
  and swallowed.

### Key Entities _(include if feature involves data)_

- **AsyncStorageStore**: React Native write-through cache with in-memory map plus AsyncStorage
  backing.
- **Create-Time Merge Contract**: Startup merge behavior that combines persisted values and caller
  config.
- **Signal Persistence Effects**: Runtime synchronization from core signals to persistent state.
- **Structured Cache Validation Contract**: Parse/validate/invalidate behavior for JSON-backed
  structured keys.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Startup tests confirm persisted defaults are applied only when caller defaults are
  omitted.
- **SC-002**: Merge tests confirm debug flag and `allowedEventTypes` default/override behavior.
- **SC-003**: Signal-effect tests confirm changes/consent/profile/optimizations synchronization to
  AsyncStorage-backed state.
- **SC-004**: Corruption tests confirm malformed/schema-invalid structured cache values are removed
  and resolved as undefined.
- **SC-005**: Fault tests confirm AsyncStorage initialize/write/remove failures are logged without
  crashing SDK execution.
