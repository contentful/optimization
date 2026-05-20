import XCTest

/// Insights API Events
///
/// Verifies that the SDK's analytics layer automatically emits entry view events
/// through the Insights API event stream when entries become visible in the UI.
final class AnalyticsTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launch()
        clearProfileState(app: app)
    }

    /// "should track entry view events for visible entries"
    ///
    /// When the Analytics Events screen is open, the SDK emits at least one Insights API
    /// event and a per-entry stats element for the tracked merge tag entry becomes visible
    /// after scrolling.
    func testTracksEntryViewEventsForVisibleEntries() {
        // 1. Wait until the "Analytics Events" text is visible, using the default
        //    element visibility timeout.
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // 2. Wait until the recorded Insights API event count is at least 1.
        waitForEventsCountAtLeast(1, app: app)

        // 3. Scroll the `main-scroll-view` until the per-entry stats summary element for
        //    the merge tag entry becomes visible.
        let statsId = "entry-stats-1MwiFl4z7gkwqGYdvCmr8c"
        scrollToElement(testId: statsId, scrollViewId: "main-scroll-view", app: app)
        waitForElement(findElement(statsId, app: app), timeout: ELEMENT_VISIBILITY_TIMEOUT)
    }
}
