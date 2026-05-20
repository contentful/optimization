import XCTest

final class ExtendedViewTrackingTests: XCTestCase {
    let app = XCUIApplication()

    // The merge tag entry is always first in the list and visible immediately on launch.
    let VISIBLE_ENTRY_ID = "1MwiFl4z7gkwqGYdvCmr8c"

    // Second entry visible on launch (immediately after the merge tag entry).
    let SECOND_ENTRY_ID = "4ib0hsHWoSOnCVdDkizE8d"

    // An entry that starts below the fold (not visible on launch).
    let BELOW_FOLD_ENTRY_ID = "7pa5bOx8Z9NmNcr7mISvD"

    override func setUp() {
        continueAfterFailure = false
        clearProfileState(app: app, requireFreshAppInstance: true)
    }

    func testPeriodicEventsForContinuouslyVisibleEntry() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for the initial event (after dwell threshold ~2s)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        // Wait for at least one periodic update (dwell 2s + update interval 5s = ~7s total)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)
    }

    func testIncreasingViewDurationMs() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 2 events so we can check duration is increasing
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)

        let duration = getViewDuration(VISIBLE_ENTRY_ID, app: app)

        // Duration should exceed the dwell threshold (2000ms) since we've had at least 2 events
        XCTAssertNotNil(duration)
        XCTAssertGreaterThan(duration!, 2000)
    }

    func testStableViewIdWithinCycle() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Capture the viewId from the FIRST event of the cycle, before any periodic
        // update can overwrite latestViewId.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        let firstEventViewId = getViewId(VISIBLE_ENTRY_ID, app: app)

        XCTAssertNotNil(firstEventViewId)
        XCTAssertGreaterThan(firstEventViewId!.count, 0)

        // Wait for the next periodic event in the SAME visibility cycle and re-read.
        // A correct SDK reuses one viewId for the whole cycle, so the second read
        // must equal the first.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)
        let secondEventViewId = getViewId(VISIBLE_ENTRY_ID, app: app)

        XCTAssertEqual(secondEventViewId, firstEventViewId)
    }

    func testFinalEventOnScrollOut() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 1 event from the visible entry
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        let preScrollViewId = getViewId(VISIBLE_ENTRY_ID, app: app)

        // Scroll the entry out of the viewport
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeUp(times: 2)

        // Give the final event time to fire
        Thread.sleep(forTimeInterval: 1.0)

        // Scroll back to the top so the stats elements become visible again
        scrollView.swipeDown(times: 3)

        // Scroll to the events display to read updated stats
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        // The event count should have incremented by the final event
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // The viewId should still match the original cycle
        let postScrollViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertEqual(postScrollViewId, preScrollViewId)
    }

    func testNewViewIdAfterScrollAwayAndBack() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 1 event in the first visibility cycle
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        let firstCycleViewId = getViewId(VISIBLE_ENTRY_ID, app: app)

        // Scroll the entry out of the viewport
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeUp(times: 2)
        Thread.sleep(forTimeInterval: 1.0)

        // Scroll back to the top to make the entry visible again
        scrollView.swipeDown(times: 3)
        Thread.sleep(forTimeInterval: 0.5)

        // Wait for new events from the second visibility cycle
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 3, app: app, timeout: EXTENDED_TIMEOUT)

        let secondCycleViewId = getViewId(VISIBLE_ENTRY_ID, app: app)

        // The second cycle should have a different viewId
        XCTAssertNotNil(secondCycleViewId)
        XCTAssertNotEqual(secondCycleViewId, firstCycleViewId)
    }

    func testNoEventsBeforeDwellThreshold() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Scroll down to bring the below-fold entry into view briefly
        scrollToElement(testId: "content-entry-\(BELOW_FOLD_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        // Immediately scroll back to top — the entry was visible for well under 2s
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeDown(times: 3)

        // Wait long enough that an event WOULD have fired if tracking hadn't been cancelled
        Thread.sleep(forTimeInterval: 3.0)

        // The stats element only renders when an entry view event has fired.
        // It should not exist for the below-fold entry since it wasn't visible long enough.
        let statsElement = app.otherElements["entry-stats-\(BELOW_FOLD_ENTRY_ID)"]
        XCTAssertFalse(statsElement.waitForExistence(timeout: 2.0))
    }

    func testIndependentViewIdsForMultipleEntries() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 1 event from each visible entry
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        waitForComponentEventCount(SECOND_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        // Get viewIds for both entries
        let viewId1 = getViewId(VISIBLE_ENTRY_ID, app: app)
        let viewId2 = getViewId(SECOND_ENTRY_ID, app: app)

        // Both should have non-null, distinct viewIds
        XCTAssertNotNil(viewId1)
        XCTAssertNotNil(viewId2)
        XCTAssertNotEqual(viewId1, viewId2)
    }

    func testFinalEventOnNavigationUnmount() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 1 tracking event (active cycle with emitted event)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        // Record the current event count
        let preNavText = getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app)
        let preNavCount = parseComponentCount(preNavText)

        // Scroll back to top so the Navigation Test button is accessible
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeDown(times: 3)

        // Navigate away: this unmounts all tracked entries, triggering cleanup
        let navButton = app.buttons["navigation-test-button"]
        waitForElement(navButton)
        navButton.tap()
        waitForElement(app.buttons["close-navigation-test-button"])

        // Give the final event time to fire
        Thread.sleep(forTimeInterval: 0.5)

        // Navigate back to main screen
        app.buttons["close-navigation-test-button"].tap()

        // Wait for the events display to reappear (screen remounts with persisted state)
        waitForElement(app.staticTexts["Analytics Events"])
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        // The event count should have increased (final event emitted during unmount)
        let postNavText = getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app)
        let postNavCount = parseComponentCount(postNavText)
        XCTAssertGreaterThan(postNavCount, preNavCount)
    }

    func testPauseResumeOnBackgroundForeground() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Establish the first visibility cycle and prove its viewId is stable
        // across two events BEFORE backgrounding.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        let firstCycleViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)
        XCTAssertEqual(getViewId(VISIBLE_ENTRY_ID, app: app), firstCycleViewId)

        // Record the cycle's event count so the post-resume assertion can require
        // a concrete delta rather than an arbitrary absolute threshold.
        let preBackgroundText = getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app)
        let countBeforeBackground = parseComponentCount(preBackgroundText)

        // Send app to background
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.0)

        // Bring app back to foreground (resume from background, no state reset)
        app.activate()

        // Wait for the stats display to be visible again
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        // Backgrounding must end the cycle with a final event and foregrounding
        // must start a fresh one with its own initial event, so the count must
        // advance by at least 2.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: countBeforeBackground + 2,
                                   app: app, timeout: EXTENDED_TIMEOUT)

        // The resumed cycle must carry a different viewId than the first cycle.
        let postForegroundViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotEqual(postForegroundViewId, firstCycleViewId,
            "ViewId should change after background/foreground cycle (new tracking cycle)")
    }

    func testDurationResetOnNewCycle() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 2 events so duration accumulates beyond the dwell threshold
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)

        let firstCycleDuration = getViewDuration(VISIBLE_ENTRY_ID, app: app)

        // Duration after 2 events should be well above the dwell threshold
        XCTAssertNotNil(firstCycleDuration)
        XCTAssertGreaterThan(firstCycleDuration!, 4000)

        // Scroll entry out of view (end cycle, triggers final event)
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeUp(times: 2)
        Thread.sleep(forTimeInterval: 1.0)

        // Scroll back to top (entry visible again, new cycle starts)
        scrollView.swipeDown(times: 3)
        Thread.sleep(forTimeInterval: 0.5)

        // Wait for the new cycle's initial event
        // Cycle 1: initial(1) + periodic(2) + final(3) = 3 events
        // New cycle initial = event 4
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 4, app: app, timeout: EXTENDED_TIMEOUT)

        // The new cycle's duration should be around the dwell threshold (~2000ms),
        // not carrying over the 4000+ms from cycle 1
        let secondCycleDuration = getViewDuration(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(secondCycleDuration)
        XCTAssertGreaterThanOrEqual(secondCycleDuration!, 2000)
        XCTAssertLessThan(secondCycleDuration!, 4000,
            "New cycle duration should reset — expected < 4000ms but got \(secondCycleDuration!)ms")
    }

    // MARK: - Helpers

    private func parseComponentCount(_ text: String) -> Int {
        let pattern = #/Count:\s*(\d+)/#
        guard let match = text.firstMatch(of: pattern) else { return 0 }
        return Int(match.1) ?? 0
    }
}
