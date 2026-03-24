# Phase 5: Implementation App

## Goal

Build a SwiftUI app at `implementations/ios-sdk/` that imports the Swift Package locally and mirrors
the RN implementation app's functionality. This app serves as both a demo and the test target for
XCUITests in Phase 6.

## Context from Prior Phases

### Phase 1 (Completed)

Swift Package at `packages/ios/ContentfulOptimization/` with the core bridge, polyfills, and basic
API.

### Phase 2 (Expected)

Full API: `identify`, `page`, `screen`, `flush`, `trackView`, `trackClick`, `consent`, `reset`,
`setOnline`, `personalizeEntry`. Event publisher via Combine. `selectedPersonalizations` published
property.

### Phase 3 (Expected)

SwiftUI components: `OptimizationRoot`, `PersonalizationView`, `AnalyticsView`,
`OptimizationScrollView`. View tracking with `ViewTrackingController`/`ViewTrackingModifier`. Tap
tracking with `TapTrackingModifier`.

### Phase 4 (Expected)

`AppStateHandler` (flush on background), `NetworkMonitor` (NWPathMonitor → setOnline),
`.trackScreen(name:)` ViewModifier.

---

## App Structure

```
implementations/ios-sdk/
  OptimizationApp.xcodeproj/
  OptimizationApp/
    App.swift
    Config.swift
    Screens/
      MainScreen.swift
      NavigationTestScreen.swift
      LiveUpdatesTestScreen.swift
    Components/
      ContentEntryView.swift
      AnalyticsEventDisplay.swift
    Utils/
      ContentfulFetcher.swift
```

### Xcode Project Setup

- Create via `xcodebuild` or Xcode — SwiftUI App template, iOS 15+
- Local Swift Package dependency pointing to: `../../packages/ios/ContentfulOptimization`
- The app will need the mock server running (`lib/mocks/`) for API calls at localhost

---

## File Specifications

### `Config.swift`

```swift
struct AppConfig {
    static let clientId = "mock-client-id"
    static let environment = "master"
    static let experienceBaseUrl = "http://localhost:8000/experience/"
    static let insightsBaseUrl = "http://localhost:8000/insights/"

    // Entry IDs matching the RN app's ENV_CONFIG.entries
    static let entryIds = [
        "1MwiFl4z7gkwqGYdvCmr8c",  // mergeTag
        "4ib0hsHWoSOnCVdDkizE8d",
        "xFwgG3oNaOcjzWiGe4vXo",
        "2Z2WLOx07InSewC3LUB3eX",  // personalized
        "5XHssysWUDECHzKLzoIsg1",
        "6zqoWXyiSrf0ja7I2WGtYj",
        "7pa5bOx8Z9NmNcr7mISvD",
    ]
}
```

### `App.swift`

**Reference**: `implementations/react-native-sdk/App.tsx` (170 lines)

```swift
import ContentfulOptimization
import SwiftUI

@main
struct OptimizationDemoApp: App {
    var body: some Scene {
        WindowGroup {
            OptimizationRoot(
                config: OptimizationConfig(
                    clientId: AppConfig.clientId,
                    environment: AppConfig.environment,
                    experienceBaseUrl: AppConfig.experienceBaseUrl,
                    insightsBaseUrl: AppConfig.insightsBaseUrl
                ),
                trackViews: true,
                trackTaps: true
            ) {
                MainScreen()
            }
        }
    }
}
```

### `MainScreen.swift`

**Reference**: `App.tsx`'s `AppContent` component

Features:

- Fetches entries from Contentful CDA on profile state change
- Identify/Reset buttons (toggle between them based on `isIdentified` state)
- Navigation Test button → `NavigationTestScreen`
- Live Updates Test button → `LiveUpdatesTestScreen`
- `OptimizationScrollView` wrapping a `LazyVStack` of `ContentEntryView`s
- `AnalyticsEventDisplay` at the bottom of the scroll view

```swift
struct MainScreen: View {
    @EnvironmentObject var client: OptimizationClient
    @State private var entries: [[String: Any]] = []
    @State private var isIdentified = false
    @State private var showNavigationTest = false
    @State private var showLiveUpdatesTest = false

    var body: some View {
        if showNavigationTest {
            NavigationTestScreen(onClose: { showNavigationTest = false })
        } else if showLiveUpdatesTest {
            LiveUpdatesTestScreen(onClose: { showLiveUpdatesTest = false })
        } else {
            VStack {
                // Button bar
                HStack {
                    if !isIdentified {
                        Button("Identify") { handleIdentify() }
                            .accessibilityIdentifier("identify-button")
                    } else {
                        Button("Reset") { handleReset() }
                            .accessibilityIdentifier("reset-button")
                    }
                    Button("Navigation Test") { showNavigationTest = true }
                        .accessibilityIdentifier("navigation-test-button")
                    Button("Live Updates Test") { showLiveUpdatesTest = true }
                        .accessibilityIdentifier("live-updates-test-button")
                }
                .padding()

                // Scrollable entry list
                OptimizationScrollView(accessibilityIdentifier: "main-scroll-view") {
                    LazyVStack {
                        ForEach(entries, id: \.entryId) { entry in
                            ContentEntryView(entry: entry)
                        }
                        AnalyticsEventDisplay()
                    }
                }
            }
            .task { await loadEntries() }
        }
    }
}
```

### `ContentEntryView.swift`

**Reference**: `implementations/react-native-sdk/sections/ContentEntry.tsx`

Checks for `nt_experiences` field → if present, wraps in `PersonalizationView`; otherwise, uses
`AnalyticsView`. Both have `trackTaps: true`.

```swift
struct ContentEntryView: View {
    let entry: [String: Any]

    var body: some View {
        let entryId = // extract sys.id
        let hasExperiences = // check for nt_experiences field

        if hasExperiences {
            PersonalizationView(
                baselineEntry: entry,
                trackTaps: true,
                accessibilityIdentifier: "content-entry-\(entryId)"
            ) { resolvedEntry in
                EntryContent(entry: resolvedEntry, entryId: entryId)
            }
        } else {
            AnalyticsView(
                entry: entry,
                trackTaps: true,
                accessibilityIdentifier: "content-entry-\(entryId)"
            ) { entry in
                EntryContent(entry: entry, entryId: entryId)
            }
        }
    }
}

struct EntryContent: View {
    let entry: [String: Any]
    let entryId: String

    var body: some View {
        VStack(alignment: .leading) {
            Text(entry.title ?? "")
                .accessibilityIdentifier("entry-text-\(entryId)")
        }
        .padding()
    }
}
```

### `AnalyticsEventDisplay.swift`

**Reference**: `implementations/react-native-sdk/components/AnalyticsEventDisplay.tsx` (162 lines)

This is critical for E2E tests — it displays event counts and per-component stats with specific
accessibility identifiers that the test suite queries.

**Key behaviors:**

- Subscribes to `client.eventPublisher`
- Maintains module-level persisted state (survives unmount/remount within same app session)
- Tracks per-component stats: count, latest viewDurationMs, latest viewId
- Filters out `component` type events from the main event list display

**Accessibility identifiers** (must match exactly):

- `"events-count"` — displays `"Events: {count}"`
- `"no-events-message"` — displays `"No events tracked yet"` when empty
- `"component-stats-{componentId}"` — wrapper for per-component stats
- `"event-count-{componentId}"` — displays `"Count: {n}"`
- `"event-duration-{componentId}"` — displays `"Duration: {ms}"` or `"Duration: N/A"`
- `"event-view-id-{componentId}"` — displays `"ViewId: {uuid}"` or `"ViewId: N/A"`
- `"event-{type}-{componentId}"` — individual non-component event rows

**Text format matters** — the E2E helpers parse these with regexes:

```
/Events:\s*(\d+)/    → from "events-count"
/Count:\s*(\d+)/     → from "event-count-{id}"
/Duration:\s*(\d+)/  → from "event-duration-{id}"
/ViewId:\s*(.+)/     → from "event-view-id-{id}"
```

### `NavigationTestScreen.swift`

**Reference**: `implementations/react-native-sdk/screens/NavigationTestScreen.tsx`

Uses `NavigationStack` with `.trackScreen(name:)` on each destination. Displays a screen event log
for testing.

```swift
struct NavigationTestScreen: View {
    let onClose: () -> Void
    @State private var screenLog: [String] = []

    var body: some View {
        NavigationStack {
            VStack {
                Button("Close") { onClose() }
                    .accessibilityIdentifier("close-navigation-test-button")

                NavigationLink("Go to View One", value: "viewOne")
                    .accessibilityIdentifier("go-to-view-one-button")

                Text(screenLog.joined(separator: ","))
                    .accessibilityIdentifier("screen-event-log")
            }
            .trackScreen(name: "NavigationHome")
            .onAppear { screenLog.append("NavigationHome") }
            .navigationDestination(for: String.self) { destination in
                // ViewOne, ViewTwo with their own trackScreen and nav links
            }
        }
    }
}
```

Test IDs needed: `close-navigation-test-button`, `go-to-view-one-button`, `go-to-view-two-button`,
`navigation-view-test-one`, `navigation-view-test-two`, `screen-event-log`.

### `LiveUpdatesTestScreen.swift`

**Reference**: `implementations/react-native-sdk/screens/LiveUpdatesTestScreen.tsx`

Three `PersonalizationView` instances with different `liveUpdates` settings:

1. **Default** (`liveUpdates: nil`) — inherits global setting, locks by default
2. **Live** (`liveUpdates: true`) — always live
3. **Locked** (`liveUpdates: false`) — always locked

Controls: toggle global liveUpdates, simulate preview panel, identify/reset.

Test IDs needed: `close-live-updates-test-button`, `default-personalization`,
`live-personalization`, `locked-personalization`, `default-entry-id`, `live-entry-id`,
`locked-entry-id`, `default-text`, `live-text`, `locked-text`, `default-container`,
`live-container`, `locked-container`, `global-live-updates-status`,
`toggle-global-live-updates-button`, `preview-panel-status`, `simulate-preview-panel-button`,
`identified-status`, `live-updates-identify-button`, `live-updates-reset-button`.

### `ContentfulFetcher.swift`

Fetches entries from Contentful CDA (same as the RN app's `fetchEntries` helper). Makes HTTP GET
requests to the Contentful API with proper auth headers.

---

## Verification

1. **Build**: App builds in Xcode and launches on simulator
2. **Identify**: Tap identify → entries show personalized variants (verify with mock server)
3. **Scroll**: Scroll through entries → viewport tracking events appear in AnalyticsEventDisplay
4. **Tap**: Tap entries → click events fire and appear in event display
5. **Navigation**: Tap Navigation Test → navigate views → screen events emitted (visible in
   screen-event-log)
6. **Live Updates**: Test all three PersonalizationView configs with identify/reset

All accessibility identifiers must be verified to match the expected values — Phase 6 XCUITests
depend on them.

---

## Reference Files

- **RN App.tsx**: `implementations/react-native-sdk/App.tsx` — app structure, button layout, entry
  loading
- **RN ContentEntry**: `implementations/react-native-sdk/sections/ContentEntry.tsx` —
  personalization/analytics wrapper
- **RN AnalyticsEventDisplay**:
  `implementations/react-native-sdk/components/AnalyticsEventDisplay.tsx` — event display with test
  IDs
- **RN NavigationTestScreen**: `implementations/react-native-sdk/screens/NavigationTestScreen.tsx`
- **RN LiveUpdatesTestScreen**: `implementations/react-native-sdk/screens/LiveUpdatesTestScreen.tsx`
- **Mock server**: `lib/mocks/` — the backend the app calls
- **E2E helpers**: `implementations/react-native-sdk/e2e/helpers.js` — regex patterns the tests use
