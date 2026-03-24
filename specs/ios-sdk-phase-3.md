# Phase 3: SwiftUI Components

## Goal

Build SwiftUI equivalents of `OptimizationRoot`, `PersonalizationView`, `AnalyticsView`, and
`OptimizationScrollView`, plus viewport tracking and tap tracking.

## Context from Prior Phases

### Phase 1 (Completed)

Created the Swift Package at `packages/ios/ContentfulOptimization/` with `OptimizationClient` as the
main `@MainActor ObservableObject` entry point. Published state: `state` (OptimizationState),
`isInitialized`.

### Phase 2 (Expected State)

After Phase 2, `OptimizationClient` will have the full API:

- Async: `identify`, `page`, `screen`, `flush`, `trackView`, `trackClick`
- Sync: `consent`, `reset`, `setOnline`, `personalizeEntry`, `getProfile`, `getState`, `destroy`
- Published: `state`, `isInitialized`, `selectedPersonalizations`
- `eventPublisher: AnyPublisher<[String: Any], Never>` for event stream
- Types: `TrackViewPayload`, `TrackClickPayload`, `PersonalizedResult`

---

## Files to Create

```
Sources/ContentfulOptimization/
  Views/
    OptimizationRoot.swift
    PersonalizationView.swift
    AnalyticsView.swift
    OptimizationScrollView.swift
  Tracking/
    ViewTrackingController.swift
    ViewTrackingModifier.swift
    TapTrackingModifier.swift
  Environment/
    OptimizationEnvironment.swift
    TrackingEnvironment.swift
```

---

## SwiftUI ↔ React Native Pattern Mapping

| React Native                                          | SwiftUI                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `<OptimizationProvider>` + React Context              | `OptimizationRoot` + `@EnvironmentObject`                       |
| `<Personalization>{(entry) => ...}</Personalization>` | `PersonalizationView { entry in ... }` with `@ViewBuilder`      |
| `<OptimizationScrollProvider>`                        | `OptimizationScrollView` with named coordinate space            |
| `useViewportTracking` hook                            | `ViewTrackingController` class + `ViewModifier`                 |
| `useTapTracking` hook                                 | `TapTrackingModifier` with `.simultaneousGesture(TapGesture())` |
| `onLayout` + scroll math                              | `GeometryReader` + `.frame(in: .named("optimization-scroll"))`  |
| `testID`                                              | `.accessibilityIdentifier()`                                    |

---

## Component Specifications

### `OptimizationEnvironment.swift`

```swift
import SwiftUI

// EnvironmentObject key for the client
// Users access via @EnvironmentObject var client: OptimizationClient

// EnvironmentKey for tracking config
struct TrackingConfigKey: EnvironmentKey {
    static let defaultValue = TrackingConfig()
}

public struct TrackingConfig {
    public var trackViews: Bool = true
    public var trackTaps: Bool = false
    public var liveUpdates: Bool = false
}

extension EnvironmentValues {
    public var trackingConfig: TrackingConfig { get/set }
}
```

### `TrackingEnvironment.swift`

```swift
// EnvironmentKey for scroll context (provided by OptimizationScrollView)
struct ScrollContextKey: EnvironmentKey {
    static let defaultValue: ScrollContext? = nil
}

public struct ScrollContext {
    public var scrollY: CGFloat = 0
    public var viewportHeight: CGFloat = 0
}

extension EnvironmentValues {
    var scrollContext: ScrollContext? { get/set }
}
```

### `OptimizationRoot.swift`

The top-level wrapper that initializes the client and injects it into the SwiftUI environment.

**Reference**: `packages/react-native-sdk/src/context/OptimizationContext.tsx`

```swift
public struct OptimizationRoot<Content: View>: View {
    let config: OptimizationConfig
    let trackViews: Bool
    let trackTaps: Bool
    let liveUpdates: Bool
    @ViewBuilder let content: () -> Content

    @StateObject private var client = OptimizationClient()

    public init(
        config: OptimizationConfig,
        trackViews: Bool = true,
        trackTaps: Bool = false,
        liveUpdates: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    )

    public var body: some View {
        Group {
            if client.isInitialized {
                content()
            } else {
                ProgressView()
            }
        }
        .environmentObject(client)
        .environment(\.trackingConfig, TrackingConfig(trackViews: trackViews, trackTaps: trackTaps, liveUpdates: liveUpdates))
        .task { try? client.initialize(config: config) }
    }
}
```

### `OptimizationScrollView.swift`

Wraps a `ScrollView` with a named coordinate space and tracks scroll position.

**Reference**: `packages/react-native-sdk/src/context/OptimizationScrollContext.tsx`

```swift
public struct OptimizationScrollView<Content: View>: View {
    let accessibilityIdentifier: String?
    @ViewBuilder let content: () -> Content

    @State private var scrollY: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0

    static let coordinateSpaceName = "optimization-scroll"

    public var body: some View {
        ScrollView {
            content()
                .background(GeometryReader { geo in
                    Color.clear.preference(
                        key: ScrollOffsetPreferenceKey.self,
                        value: -geo.frame(in: .named(Self.coordinateSpaceName)).origin.y
                    )
                })
        }
        .coordinateSpace(name: Self.coordinateSpaceName)
        .onPreferenceChange(ScrollOffsetPreferenceKey.self) { scrollY = $0 }
        .background(GeometryReader { geo in
            Color.clear.onAppear { viewportHeight = geo.size.height }
        })
        .environment(\.scrollContext, ScrollContext(scrollY: scrollY, viewportHeight: viewportHeight))
        .accessibilityIdentifier(accessibilityIdentifier ?? "")
    }
}
```

### `PersonalizationView.swift`

Resolves the personalized variant of an entry and renders content via a ViewBuilder.

**Reference**: `packages/react-native-sdk/src/components/Personalization.tsx` (265 lines)

Key behaviors to port:

1. Calls `client.personalizeEntry(baseline:personalizations:)` to resolve variant
2. **Variant locking**: By default, locks to the first resolved variant (prevents UI flashing).
   Unlocks when `liveUpdates: true` or preview panel is open.
3. Attaches view tracking (via `ViewTrackingModifier`) and tap tracking (via `TapTrackingModifier`)
4. `trackViews`/`trackTaps` can be set per-component or inherited from environment

```swift
public struct PersonalizationView<Content: View>: View {
    let baselineEntry: [String: Any]
    let viewTimeMs: Int
    let threshold: Double
    let viewDurationUpdateIntervalMs: Int
    let liveUpdates: Bool?        // nil = inherit from environment
    let trackViews: Bool?         // nil = inherit from environment
    let trackTaps: Bool?          // nil = inherit from environment
    let accessibilityIdentifier: String?
    @ViewBuilder let content: ([String: Any]) -> Content

    @EnvironmentObject private var client: OptimizationClient
    @Environment(\.trackingConfig) private var trackingConfig

    // Variant locking state
    @State private var lockedPersonalizations: [[String: Any]]? = nil
    @State private var isLocked: Bool = false
}
```

Defaults: `viewTimeMs = 2000`, `threshold = 0.8`, `viewDurationUpdateIntervalMs = 5000`.

### `AnalyticsView.swift`

For non-personalized entries — provides view and tap tracking without variant resolution.

```swift
public struct AnalyticsView<Content: View>: View {
    let entry: [String: Any]
    let trackViews: Bool?
    let trackTaps: Bool?
    let accessibilityIdentifier: String?
    @ViewBuilder let content: ([String: Any]) -> Content
}
```

---

## Viewport Tracking

### `ViewTrackingController.swift`

Port of `packages/react-native-sdk/src/hooks/useViewportTracking.ts` (574 lines).

This is an `ObservableObject` class that implements the three-phase event lifecycle:

1. **Initial event**: After accumulated visible time reaches `viewTimeMs` (default 2000ms)
2. **Periodic updates**: Every `viewDurationUpdateIntervalMs` (default 5000ms) while visible
3. **Final event**: When visibility ends (only if at least one event was already emitted)

**State machine** (per visibility cycle):

```
INVISIBLE → (visibility ratio ≥ threshold) → VISIBLE
  └→ Start timer for dwellTimeMs
  └→ Generate new viewId (UUID)
  └→ Start accumulating time

VISIBLE → timer fires → EMIT EVENT
  └→ Increment attempts counter
  └→ Call client.trackView(payload)
  └→ Schedule next fire at viewDurationUpdateIntervalMs

VISIBLE → (visibility ratio < threshold) → INVISIBLE
  └→ Cancel timer
  └→ Pause time accumulation
  └→ If attempts > 0, emit final event
  └→ Reset cycle state
```

**Key calculations:**

```swift
// Visibility ratio (from GeometryReader in scroll coordinate space)
let visibleTop = max(elementY, scrollY)
let visibleBottom = min(elementY + elementHeight, scrollY + viewportHeight)
let visibleHeight = max(0, visibleBottom - visibleTop)
let visibilityRatio = visibleHeight / elementHeight

// Time until next fire
let requiredMs = dwellTimeMs + attempts * viewDurationUpdateIntervalMs
let remainingMs = requiredMs - accumulatedMs
```

**Interface:**

```swift
class ViewTrackingController: ObservableObject {
    @Published var isVisible: Bool = false

    init(client: OptimizationClient, entry: [String: Any], personalization: [String: Any]?,
         threshold: Double, viewTimeMs: Int, viewDurationUpdateIntervalMs: Int)

    func updateVisibility(elementY: CGFloat, elementHeight: CGFloat,
                         scrollY: CGFloat, viewportHeight: CGFloat)
    func onDisappear()  // Emit final event if cycle active
    func pause()        // App backgrounded
    func resume()       // App foregrounded → re-check visibility
}
```

### `ViewTrackingModifier.swift`

A `ViewModifier` that creates a `ViewTrackingController` and uses `GeometryReader` to feed position
data.

```swift
struct ViewTrackingModifier: ViewModifier {
    let entry: [String: Any]
    let personalization: [String: Any]?
    let threshold: Double
    let viewTimeMs: Int
    let viewDurationUpdateIntervalMs: Int
    let enabled: Bool

    @EnvironmentObject private var client: OptimizationClient
    @Environment(\.scrollContext) private var scrollContext
    @StateObject private var controller: ViewTrackingController

    func body(content: Content) -> some View {
        content
            .background(GeometryReader { geo in
                Color.clear.onChange(of: scrollContext?.scrollY) { _ in
                    let frame = geo.frame(in: .named(OptimizationScrollView.coordinateSpaceName))
                    controller.updateVisibility(
                        elementY: frame.origin.y,
                        elementHeight: frame.size.height,
                        scrollY: scrollContext?.scrollY ?? 0,
                        viewportHeight: scrollContext?.viewportHeight ?? UIScreen.main.bounds.height
                    )
                }
            })
            .onDisappear { controller.onDisappear() }
    }
}
```

### `TapTrackingModifier.swift`

```swift
struct TapTrackingModifier: ViewModifier {
    let entry: [String: Any]
    let personalization: [String: Any]?
    let enabled: Bool
    let onTap: (([String: Any]) -> Void)?

    @EnvironmentObject private var client: OptimizationClient

    func body(content: Content) -> some View {
        content
            .simultaneousGesture(TapGesture().onEnded {
                guard enabled else { return }
                let componentId = extractComponentId(from: entry)
                let payload = TrackClickPayload(componentId: componentId, variantIndex: 0)
                Task { try? await client.trackClick(payload) }
                onTap?(entry)
            })
    }
}
```

---

## Verification

1. **Build**: `swift build` succeeds
2. **Unit tests**:
   - `ViewTrackingController` fires initial event after threshold time
   - `ViewTrackingController` fires periodic events at correct intervals
   - `ViewTrackingController` fires final event on disappear
   - `ViewTrackingController` resets viewId on new visibility cycle
   - `PersonalizationView` resolves baseline when no personalizations
3. **Integration test** (in implementation app — Phase 5):
   - `OptimizationRoot { PersonalizationView(...) { entry in Text(...) } }` renders correctly
   - View tracking fires after 2s visibility
   - Tap tracking fires on tap

---

## Reference Files

- **Viewport tracking**: `packages/react-native-sdk/src/hooks/useViewportTracking.ts` — state
  machine, timing logic, visibility calculation
- **Tap tracking**: `packages/react-native-sdk/src/hooks/useTapTracking.ts`
- **Personalization**: `packages/react-native-sdk/src/components/Personalization.tsx` — variant
  locking, live updates, view/tap integration
- **Analytics**: `packages/react-native-sdk/src/components/Analytics.tsx`
- **Scroll context**: `packages/react-native-sdk/src/context/OptimizationScrollContext.tsx`
- **Optimization context**: `packages/react-native-sdk/src/context/OptimizationContext.tsx`
