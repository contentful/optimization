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
