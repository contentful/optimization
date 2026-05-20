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

/// Find an element by accessibility identifier across all element types.
func findElement(_ testId: String, app: XCUIApplication) -> XCUIElement {
    // Try staticTexts first, then otherElements, then any descendant
    let staticText = app.staticTexts[testId]
    if staticText.exists { return staticText }

    let other = app.otherElements[testId]
    if other.exists { return other }

    return app.descendants(matching: .any)[testId]
}

/// Extract text from an XCUIElement, checking label and value.
func extractText(_ element: XCUIElement) -> String {
    let label = element.label
    if !label.isEmpty { return label }
    if let value = element.value as? String, !value.isEmpty { return value }
    return ""
}

func getElementTextById(_ testId: String, app: XCUIApplication) -> String {
    let element = findElement(testId, app: app)
    XCTAssertTrue(element.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                  "Element \(testId) not found")
    return extractText(element)
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
        let el = findElement(testId, app: app)
        if el.exists {
            lastText = extractText(el)
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

/// Polls element text until it differs from the supplied baseline.
@discardableResult
func waitForTextChange(_ testId: String, baseline: String, app: XCUIApplication, timeout: TimeInterval = ELEMENT_VISIBILITY_TIMEOUT) -> String {
    return waitForElementText(testId, app: app, timeout: timeout) { $0 != baseline }
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
    let scrollView = app.scrollViews[scrollViewId]

    for _ in 0..<maxSwipes {
        // Check multiple element types
        let target = findElement(testId, app: app)
        if target.exists && target.isHittable { return }
        scrollView.swipeUp()
    }
}

/// Scrolls a scroll view by a precise point offset with no fling momentum, so a
/// tracked entry's on-screen dwell time is predictable. A positive `dy` reveals
/// lower content; a negative `dy` reveals upper content. `swipeUp`/`swipeDown`
/// flings are too coarse and momentum-heavy for dwell-sensitive assertions.
///
/// A larger `velocity` keeps the drag motion-free of fling momentum while still
/// moving the content quickly — useful when an entry must transit the viewport
/// faster than the dwell threshold.
func scrollByOffset(
    scrollViewId: String,
    dy: CGFloat,
    app: XCUIApplication,
    velocity: XCUIGestureVelocity = .default
) {
    let scrollView = app.scrollViews[scrollViewId]
    guard scrollView.exists else { return }
    // Anchor near the bottom when dragging the finger up, near the top when
    // dragging down, so even a near-full-screen drag endpoint stays on screen.
    // The trailing hold cancels fling momentum.
    let startNormalizedY: CGFloat = dy > 0 ? 0.9 : 0.1
    let start = scrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startNormalizedY))
    let end = start.withOffset(CGVector(dx: 0, dy: -dy))
    start.press(forDuration: 0.05, thenDragTo: end, withVelocity: velocity, thenHoldForDuration: 0.2)
}

/// Fraction of `element` that is vertically inside `container` (0...1).
func visibleRatio(of element: XCUIElement, in container: XCUIElement) -> CGFloat {
    guard element.exists, container.exists else { return 0 }
    let e = element.frame
    let c = container.frame
    guard e.height > 0 else { return 0 }
    let top = max(e.minY, c.minY)
    let bottom = min(e.maxY, c.maxY)
    return max(0, bottom - top) / e.height
}

/// Scrolls (momentum-free) until `testId` is at least 85% visible inside the
/// scroll view, so a fresh view-tracking cycle starts at a known instant.
func scrollEntryIntoView(_ testId: String, scrollViewId: String, app: XCUIApplication, maxSteps: Int = 16) {
    let scrollView = app.scrollViews[scrollViewId]
    for _ in 0..<maxSteps {
        let el = findElement(testId, app: app)
        if el.exists && visibleRatio(of: el, in: scrollView) >= 0.85 { return }
        scrollByOffset(scrollViewId: scrollViewId, dy: -260, app: app)
    }
}
