# Phase 4: App Lifecycle, Network, and Screen Tracking

## Goal

Implement platform handlers for app state changes, network connectivity, and screen tracking — the
iOS equivalents of React Native's `AppState` and `NetInfo` listeners.

## Context from Prior Phases

### Phase 1 (Completed)

Swift Package at `packages/ios/ContentfulOptimization/` with `OptimizationClient`,
`JSContextManager`, polyfills, and resources.

### Phase 2 (Expected)

Full API on `OptimizationClient`: `flush()`, `setOnline()`, `screen()`, `consent()`, `reset()`, plus
`eventPublisher` and `selectedPersonalizations`.

### Phase 3 (Expected)

SwiftUI components: `OptimizationRoot`, `PersonalizationView`, `AnalyticsView`,
`OptimizationScrollView`. Tracking: `ViewTrackingController` with pause/resume support,
`TapTrackingModifier`.

---

## Files to Create

```
Sources/ContentfulOptimization/
  Handlers/
    AppStateHandler.swift
    NetworkMonitor.swift
  Views/
    ScreenTrackingModifier.swift
```

---

## Component Specifications

### `AppStateHandler.swift`

Listens for app lifecycle notifications and triggers SDK actions.

**Reference**: `packages/react-native-sdk/src/handlers.ts` — `createAppStateChangeListener`

The RN SDK flushes analytics when the app backgrounds. The iOS equivalent uses `NotificationCenter`
with `UIApplication` lifecycle notifications.

```swift
import UIKit
import Combine

final class AppStateHandler {
    private var cancellables = Set<AnyCancellable>()
    private weak var client: OptimizationClient?

    var onWillResignActive: (() -> Void)?
    var onDidBecomeActive: (() -> Void)?

    init(client: OptimizationClient) {
        self.client = client

        NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)
            .sink { [weak self] _ in
                self?.handleWillResignActive()
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .sink { [weak self] _ in
                self?.handleDidBecomeActive()
            }
            .store(in: &cancellables)
    }

    private func handleWillResignActive() {
        // Flush analytics queue before backgrounding
        Task { @MainActor in
            try? await client?.flush()
        }
        onWillResignActive?()
    }

    private func handleDidBecomeActive() {
        onDidBecomeActive?()
    }

    func stop() {
        cancellables.removeAll()
    }
}
```

**Integration with OptimizationClient**: Create the handler in `initialize()`, tear down in
`destroy()`. Expose `onWillResignActive`/`onDidBecomeActive` callbacks so viewport tracking
controllers can pause/resume.

### `NetworkMonitor.swift`

Monitors network connectivity and updates the SDK's online state.

**Reference**: `packages/react-native-sdk/src/handlers.ts` — `createOnlineChangeListener` (uses
`@react-native-community/netinfo`)

iOS uses `NWPathMonitor` from the `Network` framework.

```swift
import Network

final class NetworkMonitor {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.contentful.optimization.network")
    private weak var client: OptimizationClient?
    private var wasConnected: Bool = true

    init(client: OptimizationClient) {
        self.client = client

        monitor.pathUpdateHandler = { [weak self] path in
            let isConnected = path.status == .satisfied
            DispatchQueue.main.async {
                self?.handleConnectivityChange(isConnected: isConnected)
            }
        }
        monitor.start(queue: queue)
    }

    private func handleConnectivityChange(isConnected: Bool) {
        client?.setOnline(isConnected)

        // Flush queued events on reconnect
        if isConnected && !wasConnected {
            Task { @MainActor in
                try? await client?.flush()
            }
        }
        wasConnected = isConnected
    }

    func stop() {
        monitor.cancel()
    }
}
```

**Note on macOS compatibility**: `NWPathMonitor` is available on macOS 10.14+, which is covered by
the `.macOS(.v12)` platform in Package.swift. However, `UIApplication` notifications are iOS-only.
Use `#if canImport(UIKit)` guards for the `AppStateHandler`, and provide a macOS stub using
`NSApplication` notifications if needed for testing.

### `ScreenTrackingModifier.swift`

A `ViewModifier` that calls `client.screen(name:)` when the view appears.

**Reference**: The RN app uses `useEffect` with screen name tracking on navigation changes.

```swift
import SwiftUI

public struct ScreenTrackingModifier: ViewModifier {
    let screenName: String

    @EnvironmentObject private var client: OptimizationClient

    public func body(content: Content) -> some View {
        content
            .onAppear {
                Task {
                    try? await client.screen(name: screenName)
                }
            }
    }
}

extension View {
    /// Track a screen view event when this view appears.
    public func trackScreen(name: String) -> some View {
        modifier(ScreenTrackingModifier(screenName: name))
    }
}
```

For `NavigationStack` integration, each destination view uses `.trackScreen(name:)`:

```swift
NavigationStack {
    HomeView()
        .trackScreen(name: "Home")
        .navigationDestination(for: Route.self) { route in
            switch route {
            case .detail:
                DetailView().trackScreen(name: "Detail")
            }
        }
}
```

---

## Integration into OptimizationClient

Update `OptimizationClient` to create and manage these handlers:

```swift
@MainActor
public final class OptimizationClient: ObservableObject {
    // ...existing properties...

    private var appStateHandler: AppStateHandler?
    private var networkMonitor: NetworkMonitor?

    public func initialize(config: OptimizationConfig) throws {
        try bridge.initialize(config: config)
        isInitialized = true

        // Start platform handlers
        appStateHandler = AppStateHandler(client: self)
        networkMonitor = NetworkMonitor(client: self)
    }

    public func destroy() {
        appStateHandler?.stop()
        networkMonitor?.stop()
        appStateHandler = nil
        networkMonitor = nil
        bridge.destroy()
        isInitialized = false
        state = .empty
    }
}
```

Wire app state handler callbacks to viewport tracking pause/resume (details depend on Phase 3
implementation — likely through a notification or environment value that `ViewTrackingController`
observes).

---

## Verification

### Unit tests

- `AppStateHandler` calls flush on `willResignActiveNotification`
- `NetworkMonitor` calls `setOnline(false)` when path becomes unsatisfied
- `NetworkMonitor` calls `flush()` on reconnect
- `ScreenTrackingModifier` calls `screen()` on appear

### Integration tests (require implementation app — Phase 5)

- Background app → analytics events flushed
- Toggle airplane mode → online state updates, queued events flush on reconnect
- Navigate between screens → screen events emitted with correct names

---

## Reference Files

- **RN handlers**: `packages/react-native-sdk/src/handlers.ts` — `createAppStateChangeListener`,
  `createOnlineChangeListener`
- **RN ContentfulOptimization**: `packages/react-native-sdk/src/ContentfulOptimization.ts` — how
  handlers are wired
- **Navigation test screen**: `implementations/react-native-sdk/screens/NavigationTestScreen.tsx`
- **Offline tests**: `implementations/react-native-sdk/e2e/offline-behavior.test.js`
- **Screen tracking tests**:
  `implementations/react-native-sdk/e2e/navigation-screen-tracking.test.js`
