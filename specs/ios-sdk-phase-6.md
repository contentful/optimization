# Phase 6: XCUITest Suite

## Goal

Port the 9 Detox E2E tests to XCUITest, targeting the implementation app built in Phase 5.

## Context from Prior Phases

### Phase 1 (Completed)

Swift Package at `packages/ios/ContentfulOptimization/`.

### Phases 2-4 (Expected)

Full SDK with all bridge methods, SwiftUI components (PersonalizationView, AnalyticsView,
OptimizationScrollView, ViewTrackingController, TapTrackingModifier), lifecycle handlers
(AppStateHandler, NetworkMonitor), and screen tracking.

### Phase 5 (Expected)

Implementation app at `implementations/ios-sdk/` with:

- `MainScreen` (entry list, identify/reset, navigation/live-updates buttons)
- `ContentEntryView` (PersonalizationView or AnalyticsView per entry)
- `AnalyticsEventDisplay` (event count, per-component stats)
- `NavigationTestScreen` (NavigationStack with screen tracking)
- `LiveUpdatesTestScreen` (three PersonalizationViews with different liveUpdates settings)

**Critical**: The app's accessibility identifiers must match the RN app's `testID` values exactly.
These are what the tests query.

---

## Test File Structure

```
implementations/ios-sdk/
  OptimizationAppUITests/
    Support/
      TestHelpers.swift
      XCTestExtensions.swift
    Tests/
      AnalyticsTests.swift
      TapTrackingTests.swift
      LiveUpdatesTests.swift
      ScreenTrackingTests.swift
      ExtendedViewTrackingTests.swift
      FlagViewTrackingTests.swift
      OfflineBehaviorTests.swift
      IdentifiedVariantsTests.swift
      UnidentifiedVariantsTests.swift
```

---

## Detox → XCUITest API Mapping

| Detox                                                    | XCUITest                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `element(by.id('x'))`                                    | `app.staticTexts["x"]` / `app.buttons["x"]` / `app.otherElements["x"]` |
| `waitFor(el).toBeVisible().withTimeout(t)`               | `XCTAssertTrue(el.waitForExistence(timeout: t))`                       |
| `element.tap()`                                          | `element.tap()`                                                        |
| `element(by.text('text'))`                               | `app.staticTexts["text"]`                                              |
| `element(by.id('x')).getAttributes()` → `.text`/`.label` | `element.label` or `element.value as? String`                          |
| `.whileElement(by.id('scroll')).scroll(500, 'down')`     | `app.scrollViews["scroll"].swipeUp()` (repeat as needed)               |
| `device.launchApp({ delete: true })`                     | `app.terminate(); app.launchArguments = ["--reset"]; app.launch()`     |
| `device.sendToHome()`                                    | `XCUIDevice.shared.press(.home)`                                       |
| `device.launchApp({ newInstance: false })`               | `app.activate()`                                                       |
| `device.pressBack()`                                     | `app.navigationBars.buttons.element(boundBy: 0).tap()`                 |

---

## Helper Functions

### `TestHelpers.swift`

**Reference**: `implementations/react-native-sdk/e2e/helpers.js` (185 lines)

```swift
import XCTest

let ELEMENT_VISIBILITY_TIMEOUT: TimeInterval = 10.0
let EXTENDED_TIMEOUT: TimeInterval = 30.0

func sleep(_ ms: Int) async {
    try? await Task.sleep(nanoseconds: UInt64(ms) * 1_000_000)
}

func waitForElement(_ element: XCUIElement, timeout: TimeInterval = ELEMENT_VISIBILITY_TIMEOUT) {
    XCTAssertTrue(element.waitForExistence(timeout: timeout),
                  "Element \(element.identifier) did not appear within \(timeout)s")
}

func getElementText(_ element: XCUIElement) -> String {
    return element.label
}

func getElementTextById(_ testId: String, app: XCUIApplication) -> String {
    let element = app.staticTexts[testId]
    XCTAssertTrue(element.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT))
    return element.label
}

/// Polls element text until predicate returns true or timeout expires.
func waitForElementText(
    _ testId: String,
    app: XCUIApplication,
    timeout: TimeInterval = ELEMENT_VISIBILITY_TIMEOUT,
    predicate: (String) -> Bool
) -> String {
    let deadline = Date().addingTimeInterval(timeout)
    var lastText = ""

    while Date() < deadline {
        let el = app.staticTexts[testId]
        if el.exists {
            lastText = el.label
            if predicate(lastText) { return lastText }
        }
        Thread.sleep(forTimeInterval: 0.15)
    }

    XCTFail("Timed out waiting for text condition on \"\(testId)\". Last text: \"\(lastText)\"")
    return lastText
}

func waitForTextEquals(_ testId: String, expected: String, app: XCUIApplication, timeout: TimeInterval = ELEMENT_VISIBILITY_TIMEOUT) {
    _ = waitForElementText(testId, app: app, timeout: timeout) { $0 == expected }
}

/// Parses "Events: N" text and waits until count >= minCount.
func waitForEventsCountAtLeast(_ minCount: Int, app: XCUIApplication, timeout: TimeInterval = ELEMENT_VISIBILITY_TIMEOUT) {
    _ = waitForElementText("events-count", app: app, timeout: timeout) { text in
        parseEventsCount(text) >= minCount
    }
}

func parseEventsCount(_ text: String) -> Int {
    let pattern = #/Events:\s*(\d+)/#
    guard let match = text.firstMatch(of: pattern) else { return 0 }
    return Int(match.1) ?? 0
}

/// Scrolls analytics stats into view and waits for component event count >= minCount.
func waitForComponentEventCount(
    _ componentId: String,
    minCount: Int,
    app: XCUIApplication,
    timeout: TimeInterval = ELEMENT_VISIBILITY_TIMEOUT
) {
    let testId = "event-count-\(componentId)"

    // Scroll to make the element visible
    scrollToElement(testId: testId, scrollViewId: "main-scroll-view", app: app)

    _ = waitForElementText(testId, app: app, timeout: timeout) { text in
        let pattern = #/Count:\s*(\d+)/#
        guard let match = text.firstMatch(of: pattern) else { return false }
        return (Int(match.1) ?? 0) >= minCount
    }
}

func getViewDuration(_ componentId: String, app: XCUIApplication) -> Int? {
    let text = getElementTextById("event-duration-\(componentId)", app: app)
    let pattern = #/Duration:\s*(\d+)/#
    guard let match = text.firstMatch(of: pattern) else { return nil }
    return Int(match.1)
}

func getViewId(_ componentId: String, app: XCUIApplication) -> String? {
    let text = getElementTextById("event-view-id-\(componentId)", app: app)
    let pattern = #/ViewId:\s*(.+)/#
    guard let match = text.firstMatch(of: pattern) else { return nil }
    let id = String(match.1).trimmingCharacters(in: .whitespaces)
    return id == "N/A" ? nil : id
}

/// Scrolls a scroll view until the target element is visible.
func scrollToElement(testId: String, scrollViewId: String, app: XCUIApplication, maxSwipes: Int = 10) {
    let target = app.staticTexts[testId]
    let scrollView = app.scrollViews[scrollViewId]

    for _ in 0..<maxSwipes {
        if target.isHittable { return }
        scrollView.swipeUp()
    }
}
```

### `XCTestExtensions.swift`

```swift
import XCTest

extension XCUIApplication {
    /// Relaunch the app with clean state.
    func relaunchClean() {
        terminate()
        launchArguments = ["--reset"]
        launch()
    }
}

/// Reset profile state: try in-app reset first, fall back to relaunch.
func clearProfileState(app: XCUIApplication, requireFreshAppInstance: Bool = false) {
    if requireFreshAppInstance {
        app.relaunchClean()
        waitForElement(app.buttons["identify-button"])
        return
    }

    // Try closing sub-screens first
    let closeLiveUpdates = app.buttons["close-live-updates-test-button"]
    if closeLiveUpdates.exists { closeLiveUpdates.tap() }

    let closeNavigation = app.buttons["close-navigation-test-button"]
    if closeNavigation.exists { closeNavigation.tap() }

    // Try in-app reset
    let resetButton = app.buttons["reset-button"]
    if resetButton.waitForExistence(timeout: 1.5) {
        resetButton.tap()
        waitForElement(app.buttons["identify-button"])
        return
    }

    if app.buttons["identify-button"].waitForExistence(timeout: 1.5) {
        return
    }

    // Fallback: relaunch
    app.relaunchClean()
    waitForElement(app.buttons["identify-button"])
}
```

---

## Test Specifications

### 1. `AnalyticsTests.swift`

**Reference**: `e2e/analytics.test.js` (30 lines)

```swift
class AnalyticsTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        app.launch()
        clearProfileState(app: app)
    }

    func testTracksComponentImpressionEventsForVisibleEntries() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForEventsCountAtLeast(1, app: app)
        waitForComponentEventCount("1MwiFl4z7gkwqGYdvCmr8c", minCount: 1, app: app)
    }
}
```

### 2. `TapTrackingTests.swift`

**Reference**: `e2e/tap-tracking.test.js` (43 lines)

Tests:

- `testEmitsComponentClickWhenTappingContentEntry` — tap `content-entry-1MwiFl4z7gkwqGYdvCmr8c`,
  verify `event-component_click-1MwiFl4z7gkwqGYdvCmr8c` appears
- `testEmitsComponentClickForDifferentEntry` — tap `content-entry-2Z2WLOx07InSewC3LUB3eX`, verify
  corresponding event

### 3. `ExtendedViewTrackingTests.swift`

**Reference**: `e2e/extended-view-tracking.test.js` (287 lines) — most complex test file

Constants:

```swift
let VISIBLE_ENTRY_ID = "1MwiFl4z7gkwqGYdvCmr8c"
let SECOND_ENTRY_ID = "4ib0hsHWoSOnCVdDkizE8d"
let BELOW_FOLD_ENTRY_ID = "7pa5bOx8Z9NmNcr7mISvD"
```

Tests (each uses `clearProfileState(requireFreshAppInstance: true)`):

1. **Periodic events for continuously visible entry** — wait for count ≥ 2
2. **Increasing viewDurationMs** — wait for count ≥ 2, assert duration > 2000
3. **Stable viewId within cycle** — wait for count ≥ 2, verify viewId is non-null
4. **Final event on scroll out** — wait for count ≥ 1, scroll down 1500, wait, scroll back, verify
   count increased and viewId unchanged
5. **New viewId after scroll away and back** — wait, scroll away, scroll back, verify different
   viewId
6. **No events before dwell threshold** — scroll below-fold entry into view briefly, scroll back,
   verify no component-stats element
7. **Independent viewIds for multiple entries** — wait for both entries to have events, verify
   different viewIds
8. **Final event on navigation unmount** — record count, navigate away, navigate back, verify count
   increased
9. **Pause/resume on background/foreground** — wait, send to home, reactivate, verify new viewId
10. **Duration reset on new cycle** — wait for count ≥ 2, scroll away, scroll back, verify new
    duration < previous

### 4. `ScreenTrackingTests.swift`

**Reference**: `e2e/navigation-screen-tracking.test.js` (132 lines)

Tests:

1. **Single view visit** — navigate to view one, verify log = `"NavigationHome,NavigationViewOne"`
2. **Multiple view visits** — navigate one → two, verify order in log
3. **Revisiting views** — one → two → back, verify log =
   `"NavigationHome,NavigationViewOne,NavigationViewTwo,NavigationViewOne"`

### 5. `LiveUpdatesTests.swift`

**Reference**: `e2e/live-updates.test.js` (266 lines)

Test groups:

- **Default behavior**: variant doesn't update on identify when liveUpdates=false
- **Global liveUpdates enabled**: default components update, locked components don't
- **Per-component liveUpdates=true**: updates regardless of global setting
- **Per-component liveUpdates=false**: doesn't update even when global=true
- **Preview panel**: all components update when panel is open
- **Screen controls**: toggle global live updates, toggle preview panel, identify/reset

### 6. `FlagViewTrackingTests.swift`

**Reference**: `e2e/flag-view-tracking.test.js`

Simple test that a subscribed boolean flag emits component events.

### 7. `OfflineBehaviorTests.swift`

**Reference**: `e2e/offline-behavior.test.js` (137 lines)

**Network simulation**: Unlike the RN tests which use ADB airplane mode, iOS tests need a different
approach. Options:

1. **URLProtocol subclass** — register in the app's test configuration to intercept/block network
   requests
2. **Launch arguments** — app checks for `--simulate-offline` and uses a stub URLSession
3. **Network Link Conditioner** — not programmable from tests

Recommended: Add a `--simulate-offline` / `--simulate-online` launch environment that the app checks
to toggle `client.setOnline()`.

Tests:

1. **Continue tracking while offline** — go offline, identify, verify event count increases
2. **Recover on reconnect** — go offline, wait, go online, verify app functional
3. **Rapid network changes** — toggle rapidly, verify app stable
4. **Queue and flush** — go offline, identify, verify events tracked, go online, verify reset button
   visible

### 8. `IdentifiedVariantsTests.swift`

**Reference**: `e2e/displays-identified-user-variants.test.js`

Tests that after identifying as "charles", entries show the correct personalized variant content
(merge tags, location variants, device variants, etc.).

### 9. `UnidentifiedVariantsTests.swift`

**Reference**: `e2e/displays-unidentified-user-variants.test.js`

Tests that before identifying, entries show baseline content.

---

## Running Tests

```bash
# From implementations/ios-sdk/
xcodebuild test \
  -project OptimizationApp.xcodeproj \
  -scheme OptimizationApp \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.2' \
  -testPlan OptimizationAppUITests

# Or just the extended view tracking tests:
xcodebuild test \
  -project OptimizationApp.xcodeproj \
  -scheme OptimizationApp \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.2' \
  -only-testing:OptimizationAppUITests/ExtendedViewTrackingTests
```

## Verification

- All 9 test files pass on iOS Simulator
- `xcodebuild test` from command line succeeds
- Tests cover the same behavioral scenarios as the Detox suite

---

## Reference Files

- **All Detox tests**: `implementations/react-native-sdk/e2e/*.test.js` — exact test scenarios
- **Detox helpers**: `implementations/react-native-sdk/e2e/helpers.js` — helper patterns to port
- **Network helpers**: `implementations/react-native-sdk/e2e/networkHelpers.js` — offline simulation
  patterns
- **RN app accessibility IDs**: Cross-reference with `App.tsx`, `ContentEntry.tsx`,
  `AnalyticsEventDisplay.tsx`, `NavigationTestScreen.tsx`, `LiveUpdatesTestScreen.tsx`
