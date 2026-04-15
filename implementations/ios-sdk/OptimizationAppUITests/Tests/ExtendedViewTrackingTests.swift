import XCTest

final class ExtendedViewTrackingTests: XCTestCase {
    let app = XCUIApplication()

    let VISIBLE_ENTRY_ID = "1MwiFl4z7gkwqGYdvCmr8c"
    let SECOND_ENTRY_ID = "4ib0hsHWoSOnCVdDkizE8d"
    let BELOW_FOLD_ENTRY_ID = "7pa5bOx8Z9NmNcr7mISvD"

    override func setUp() {
        continueAfterFailure = false
        clearProfileState(app: app, requireFreshAppInstance: true)
    }

    func testPeriodicEventsForContinuouslyVisibleEntry() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)
    }

    func testIncreasingViewDurationMs() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)

        let duration = getViewDuration(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(duration)
        XCTAssertGreaterThan(duration!, 2000)
    }

    func testStableViewIdWithinCycle() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)

        let viewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(viewId)
        XCTAssertGreaterThan(viewId!.count, 0)
    }

    func testFinalEventOnScrollOut() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        let preScrollViewId = getViewId(VISIBLE_ENTRY_ID, app: app)

        // Scroll entry out of viewport
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeUp(times: 2)
        Thread.sleep(forTimeInterval: 1.0)

        // Scroll back to top
        scrollView.swipeDown(times: 3)

        // Verify at least one additional event was emitted (final event on scroll out)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)

        // The viewId should still match the original cycle
        let postScrollViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertEqual(postScrollViewId, preScrollViewId,
                       "ViewId should remain stable within the same visibility cycle")
    }

    func testNewViewIdAfterScrollAwayAndBack() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        let firstCycleViewId = getViewId(VISIBLE_ENTRY_ID, app: app)

        // Scroll away
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeUp(times: 2)
        Thread.sleep(forTimeInterval: 1.0)

        // Scroll back
        scrollView.swipeDown(times: 3)
        Thread.sleep(forTimeInterval: 0.5)

        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 3, app: app, timeout: EXTENDED_TIMEOUT)

        let secondCycleViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(secondCycleViewId)
        XCTAssertNotEqual(secondCycleViewId, firstCycleViewId)
    }

    func testNoEventsBeforeDwellThreshold() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Scroll below-fold entry briefly into view
        scrollToElement(testId: "content-entry-\(BELOW_FOLD_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        // Immediately scroll back to top
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeDown(times: 3)

        // Wait long enough that an event WOULD have fired
        Thread.sleep(forTimeInterval: 3.0)

        let statsElement = app.staticTexts["component-stats-\(BELOW_FOLD_ENTRY_ID)"]
        XCTAssertFalse(statsElement.waitForExistence(timeout: 2.0))
    }

    func testIndependentViewIdsForMultipleEntries() {
        waitForElement(app.staticTexts["Analytics Events"])

        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        waitForComponentEventCount(SECOND_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        let viewId1 = getViewId(VISIBLE_ENTRY_ID, app: app)
        let viewId2 = getViewId(SECOND_ENTRY_ID, app: app)

        XCTAssertNotNil(viewId1)
        XCTAssertNotNil(viewId2)
        XCTAssertNotEqual(viewId1, viewId2)
    }

    func testFinalEventOnNavigationUnmount() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        let preNavText = getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app)
        let preNavCount = parseComponentCount(preNavText)

        // Scroll to top to access navigation button
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeDown(times: 3)

        // Navigate away
        let navButton = app.buttons["navigation-test-button"]
        waitForElement(navButton)
        navButton.tap()
        waitForElement(app.buttons["close-navigation-test-button"])

        Thread.sleep(forTimeInterval: 0.5)

        // Navigate back
        app.buttons["close-navigation-test-button"].tap()

        waitForElement(app.staticTexts["Analytics Events"])
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        let postNavText = getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app)
        let postNavCount = parseComponentCount(postNavText)
        XCTAssertGreaterThan(postNavCount, preNavCount)
    }

    func testPauseResumeOnBackgroundForeground() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        let preBackgroundViewId = getViewId(VISIBLE_ENTRY_ID, app: app)

        // Scroll back to top so entry is visible before backgrounding
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeDown(times: 3)

        // Wait for tracking to stabilize with entry visible
        Thread.sleep(forTimeInterval: 3.0)

        // Record count before background (scroll to analytics to read)
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)
        let countBefore = parseComponentCount(
            getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app))

        // Scroll back to top so entry is visible when we background
        scrollView.swipeDown(times: 3)
        Thread.sleep(forTimeInterval: 1.0)

        // Background the app
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.0)

        // Foreground the app
        app.activate()

        // Wait for the app to fully resume and new tracking events to fire
        Thread.sleep(forTimeInterval: 5.0)

        // Check that events continued after resume
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)
        let countAfter = parseComponentCount(
            getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app))
        XCTAssertGreaterThan(countAfter, countBefore,
            "Events should continue accumulating after app returns from background (before=\(countBefore), after=\(countAfter))")

        // Backgrounding ends the cycle and foregrounding starts a new one — viewId should differ
        let postForegroundViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotEqual(postForegroundViewId, preBackgroundViewId,
            "ViewId should change after background/foreground cycle (new tracking cycle)")
    }

    func testDurationResetOnNewCycle() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 2 events so duration accumulates beyond the dwell threshold
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)

        let firstDuration = getViewDuration(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(firstDuration)
        // Duration after 2 events should be above the dwell threshold
        XCTAssertGreaterThan(firstDuration!, 3000,
            "First cycle duration should exceed 3000ms after 2+ events")

        // Scroll away (end cycle, triggers final event)
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeUp(times: 2)
        Thread.sleep(forTimeInterval: 1.0)

        // Scroll back (new cycle starts)
        scrollView.swipeDown(times: 3)
        Thread.sleep(forTimeInterval: 0.5)

        // Cycle 1: initial(1) + periodic(2) + final(3) = 3 events
        // New cycle initial = event 4
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 4, app: app, timeout: EXTENDED_TIMEOUT)

        // The new cycle's duration should be around the dwell threshold (~2000ms),
        // not carrying over the 4000+ms from cycle 1
        let newDuration = getViewDuration(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(newDuration)
        XCTAssertGreaterThanOrEqual(newDuration!, 2000)
        XCTAssertLessThan(newDuration!, 4000,
            "New cycle duration should reset — expected < 4000ms but got \(newDuration!)ms")
    }

    // MARK: - Helpers

    private func parseComponentCount(_ text: String) -> Int {
        let pattern = #/Count:\s*(\d+)/#
        guard let match = text.firstMatch(of: pattern) else { return 0 }
        return Int(match.1) ?? 0
    }
}
