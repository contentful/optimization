# Phase 2: Extend JS Bridge for Full API Coverage

## Goal

Add all missing `CoreStateful` methods to the TypeScript bridge and expose them in Swift, achieving
full API parity with the React Native SDK.

## Context from Phase 1

Phase 1 created a Swift Package at `packages/ios/ContentfulOptimization/` with:

- **`OptimizationClient`** as the public `@MainActor ObservableObject` entry point
- **`JSContextManager`** (internal) managing the JSContext lifecycle with
  `callAsync(method:payload:completion:)` and `callSync(method:args:)` helpers
- **`BridgeCallbackManager`** (internal) handling callback ID generation and auto-cleanup
- The JS bridge (`packages/ios/ios-jsc-bridge/src/index.ts`) currently only exposes: `initialize`,
  `identify`, `page`, `getProfile`, `getState`, `destroy`
- State pushed via `__nativeOnStateChange` with fields: `profile`, `consent`, `canPersonalize`,
  `changes`

The `JSContextManager.callAsync()` pattern makes adding new async bridge methods straightforward —
register callbacks via `BridgeCallbackManager`, call
`ctx.evaluateScript("__bridge.methodName(...)")`.

## JS Bridge Changes

### File: `packages/ios/ios-jsc-bridge/src/index.ts`

**Extend the `Bridge` interface** with these methods:

```typescript
interface Bridge {
  // Existing
  initialize(config: BridgeConfig): void
  identify(payload, onSuccess, onError): void
  page(payload, onSuccess, onError): void
  getProfile(): string | null
  getState(): string
  destroy(): void

  // NEW — async with callbacks
  screen(
    payload: { name: string; properties?: Record<string, unknown> },
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ): void
  flush(onSuccess: (json: string) => void, onError: (error: string) => void): void
  trackView(
    payload: TrackViewPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ): void
  trackClick(
    payload: TrackClickPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ): void

  // NEW — synchronous
  consent(accept: boolean): void
  reset(): void
  personalizeEntry(baselineJSON: string, personalizationsJSON?: string): string
  setOnline(isOnline: boolean): void
}
```

**TrackViewPayload** (matches `CoreStateful.trackView` params):

```typescript
interface TrackViewPayload {
  componentId: string
  viewId: string
  experienceId?: string
  variantIndex: number
  viewDurationMs: number
  sticky?: boolean
}
```

**TrackClickPayload** (matches `CoreStateful.trackClick` params):

```typescript
interface TrackClickPayload {
  componentId: string
  experienceId?: string
  variantIndex: number
}
```

### Implementation patterns

**Async methods** follow the existing `identify`/`page` pattern:

```typescript
screen(payload, onSuccess, onError) {
  if (!instance) { onError('SDK not initialized...'); return }
  instance.screen(payload)
    .then((data) => onSuccess(JSON.stringify(data ?? null)))
    .catch((err) => onError(err instanceof Error ? err.message : String(err)))
},
```

**Sync methods** call directly on the instance:

```typescript
consent(accept: boolean) {
  if (!instance) return
  instance.consent(accept)
},
reset() {
  if (!instance) return
  instance.reset()
},
setOnline(isOnline: boolean) {
  if (!instance) return
  instance.online = isOnline
},
```

**`personalizeEntry`** — calls `instance.personalizeEntry()` and returns serialized JSON:

```typescript
personalizeEntry(baselineJSON: string, personalizationsJSON?: string): string {
  if (!instance) return JSON.stringify({ entry: JSON.parse(baselineJSON) })
  const baseline = JSON.parse(baselineJSON)
  const personalizations = personalizationsJSON ? JSON.parse(personalizationsJSON) : undefined
  const result = instance.personalizeEntry(baseline, personalizations)
  return JSON.stringify(result)
},
```

### Extend state effect to include `selectedPersonalizations`

In the `effect()` inside `initialize()`:

```typescript
disposeEffect = effect(() => {
  const state = {
    profile: signals.profile.value ?? null,
    consent: signals.consent.value,
    canPersonalize: signals.canPersonalize.value,
    changes: signals.changes.value ?? null,
    selectedPersonalizations: signals.selectedPersonalizations.value ?? null, // NEW
  }
  // ...push to native
})
```

### Add event stream observation

Add a second effect in `initialize()` to observe the event stream signal and push events to native:

```typescript
const disposeEventEffect = effect(() => {
  const evt = signals.eventStream.value
  if (evt && typeof g.__nativeOnEventEmitted === 'function') {
    ;(g.__nativeOnEventEmitted as (json: string) => void)(JSON.stringify(evt))
  }
})
```

Update `destroy()` to also dispose this second effect.

### Build

After changes, rebuild the UMD bundle:

```bash
cd packages/ios/ios-jsc-bridge && pnpm build
```

Copy the output to the Swift Package resources:

```bash
cp packages/ios/ios-jsc-bridge/dist/optimization-ios-bridge.umd.js \
   packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Resources/
```

---

## Swift Client Changes

### File: `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`

**Add new public methods:**

```swift
// Async methods using CheckedContinuation wrapping callAsync
public func screen(name: String, properties: [String: Any]? = nil) async throws -> [String: Any]?
public func flush() async throws
public func trackView(_ payload: TrackViewPayload) async throws -> [String: Any]?
public func trackClick(_ payload: TrackClickPayload) async throws -> [String: Any]?

// Sync methods using callSync
public func consent(_ accept: Bool)
public func reset()
public func setOnline(_ isOnline: Bool)
public func personalizeEntry(baseline: [String: Any], personalizations: [[String: Any]]?) -> PersonalizedResult
```

**Add new published property:**

```swift
@Published public private(set) var selectedPersonalizations: [[String: Any]]?
```

**Add event publisher via Combine:**

```swift
import Combine

private let eventSubject = PassthroughSubject<[String: Any], Never>()
public var eventPublisher: AnyPublisher<[String: Any], Never> {
    eventSubject.eraseToAnyPublisher()
}
```

### New types to create

**`TrackViewPayload`** — `Sources/ContentfulOptimization/Core/TrackViewPayload.swift`:

```swift
public struct TrackViewPayload {
    public let componentId: String
    public let viewId: String
    public let experienceId: String?
    public let variantIndex: Int
    public let viewDurationMs: Int
    public let sticky: Bool?

    public init(componentId: String, viewId: String, experienceId: String? = nil,
                variantIndex: Int, viewDurationMs: Int, sticky: Bool? = nil) { ... }

    func toJSON() throws -> String { ... }
}
```

**`TrackClickPayload`** — `Sources/ContentfulOptimization/Core/TrackClickPayload.swift`:

```swift
public struct TrackClickPayload {
    public let componentId: String
    public let experienceId: String?
    public let variantIndex: Int

    public init(componentId: String, experienceId: String? = nil, variantIndex: Int) { ... }

    func toJSON() throws -> String { ... }
}
```

**`PersonalizedResult`** — `Sources/ContentfulOptimization/Core/PersonalizedResult.swift`:

```swift
public struct PersonalizedResult {
    public let entry: [String: Any]
    public let personalization: [String: Any]?
}
```

### Register event callback in JSContextManager

In `JSContextManager.initialize()`, register the native event callback alongside state change:

```swift
var onEvent: (([String: Any]) -> Void)?

// Inside initialize():
let onEventEmitted: @convention(block) (String) -> Void = { [weak self] json in
    self?.handleEvent(json)
}
ctx.setObject(onEventEmitted, forKeyedSubscript: "__nativeOnEventEmitted" as NSString)
```

### Update `handleStateUpdate` in OptimizationClient

Parse the new `selectedPersonalizations` field from the state dict:

```swift
private func handleStateUpdate(_ dict: [String: Any]) {
    // ...existing profile, consent, canPersonalize, changes parsing...
    self.selectedPersonalizations = dict["selectedPersonalizations"] as? [[String: Any]]
}
```

Wire the event callback to publish through Combine:

```swift
bridge.onEvent = { [weak self] dict in
    self?.eventSubject.send(dict)
}
```

---

## Verification

1. **Build UMD bundle**: `cd packages/ios/ios-jsc-bridge && pnpm build`
2. **Copy to resources**: `cp dist/*.js ../ContentfulOptimization/Sources/.../Resources/`
3. **Build package**: `cd packages/ios/ContentfulOptimization && swift build`
4. **Run tests**: `swift test`

### Unit tests to add

- Test each new sync method (consent, reset, setOnline) calls through to JS bridge
- Test personalizeEntry returns baseline when no personalizations
- Test TrackViewPayload/TrackClickPayload JSON serialization
- Test event publisher receives events from bridge
- Test selectedPersonalizations published property updates

### Manual integration test

Full lifecycle:
`initialize → identify → page → screen → consent → trackView → trackClick → flush → destroy`

---

## Reference Files

- **CoreStateful API**: `packages/core-sdk/src/CoreStateful.ts` — all methods and their signatures
- **Signals**: `packages/core-sdk/src/signals.ts` — `selectedPersonalizations`, `eventStream`
  signals
- **RN SDK**: `packages/react-native-sdk/src/ContentfulOptimization.ts` — how RN wraps CoreStateful
- **Current bridge**: `packages/ios/ios-jsc-bridge/src/index.ts` — existing bridge to extend
- **Current client**:
  `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`
