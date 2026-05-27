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

        // Cycle 1: wait for the initial event; reading the stats scrolls entry 0
        // off, ending cycle 1 with a final event.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        let firstCycleViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(firstCycleViewId)
        let countAfterCycle1 = parseComponentCount(
            getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app))

        // Scroll entry 0 back into view to start a fresh cycle, and dwell past
        // the threshold so the new cycle emits its initial event.
        scrollEntryIntoView("content-entry-\(VISIBLE_ENTRY_ID)",
                            scrollViewId: "main-scroll-view", app: app)
        Thread.sleep(forTimeInterval: 2.6)

        // Wait for the new cycle's event and confirm it carries a fresh viewId.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: countAfterCycle1 + 1,
                                   app: app, timeout: EXTENDED_TIMEOUT)
        let secondCycleViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(secondCycleViewId)
        XCTAssertNotEqual(secondCycleViewId, firstCycleViewId,
            "Second visibility cycle should have a different viewId")
    }

    func testNoEventsBeforeDwellThreshold() {
        let scrollView = app.scrollViews["main-scroll-view"]
        waitForElement(scrollView, timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // On a tall simulator the "below-fold" entry can render just inside the
        // viewport at launch. Sweep it up and out with large, fast momentum-free
        // drags: each single drag carries the entry all the way through the 0.8
        // tracked-visibility band in a few hundred milliseconds and ends with it
        // below that band, so it never rests on screen — between XCUITest
        // gestures or otherwise — long enough to trip the 2000 ms dwell timer.
        // A fling instead leaves the entry resting mid-viewport during XCUITest's
        // post-gesture idle wait; a slow drag keeps it fully visible for seconds.
        let fast = XCUIGestureVelocity(rawValue: 2500)
        for _ in 0..<5 {
            scrollByOffset(scrollViewId: "main-scroll-view", dy: 700, app: app, velocity: fast)
        }

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

        // Cycle 1: entry 0 is visible on launch. Wait for its initial event;
        // reading the stats then scrolls it off, which ends cycle 1.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        let firstCycleViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(firstCycleViewId)
        let countBeforeBackground = parseComponentCount(
            getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app))

        // Start a cycle that is ACTIVE when the app backgrounds: scroll entry 0
        // back into view and dwell past the threshold so its initial event
        // fires. `pause()` must then emit a final event for this active cycle.
        scrollEntryIntoView("content-entry-\(VISIBLE_ENTRY_ID)",
                            scrollViewId: "main-scroll-view", app: app)
        Thread.sleep(forTimeInterval: 3.0)

        // Send app to background — pause() ends the active cycle with a final event.
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.0)

        // Foreground — resume() re-evaluates the stored geometry (entry 0 was
        // visible at background time) and starts a fresh cycle.
        app.activate()
        waitForElement(app.staticTexts["Analytics Events"])

        // Let the resumed cycle dwell past the threshold so its initial event
        // fires, then scroll the stats into view to read the updated count.
        Thread.sleep(forTimeInterval: 3.0)
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        // Backgrounding ended the pre-background cycle with a final event and
        // foregrounding started a fresh one with its own initial event, so the
        // count must advance by at least 2.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: countBeforeBackground + 2,
                                   app: app, timeout: EXTENDED_TIMEOUT)

        // The resumed cycle must carry a different viewId than the first cycle.
        let postForegroundViewId = getViewId(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotEqual(postForegroundViewId, firstCycleViewId,
            "ViewId should change after background/foreground cycle (new tracking cycle)")
    }

    func testDurationResetOnNewCycle() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Cycle 1: entry 0 is visible on launch. Leave it untouched well past the
        // dwell threshold so cycle 1 accumulates more than 4000 ms of view time.
        Thread.sleep(forTimeInterval: 6.0)

        // Reading the stats scrolls entry 0 off, ending cycle 1 with a final
        // event whose duration is the full ~6 s the entry was continuously
        // visible — comfortably above the 4000 ms contract floor.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, app: app, timeout: EXTENDED_TIMEOUT)
        let firstCycleDuration = getViewDuration(VISIBLE_ENTRY_ID, app: app)
        XCTAssertNotNil(firstCycleDuration)
        XCTAssertGreaterThan(firstCycleDuration!, 4000)

        let countAfterCycle1 = parseComponentCount(
            getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app))

        // Start a fresh, short cycle. Scroll entry 0 back to the top, then reset
        // its tracking cycle to a known start with a quick out-and-in jiggle —
        // measuring from the jiggle (rather than from somewhere inside the slow
        // scroll-in) keeps the new cycle's duration tightly bounded and well
        // under 4000 ms, proving the accumulator reset between cycles.
        let fastVelocity = XCUIGestureVelocity(rawValue: 2500)
        scrollEntryIntoView("content-entry-\(VISIBLE_ENTRY_ID)",
                            scrollViewId: "main-scroll-view", app: app)
        scrollByOffset(scrollViewId: "main-scroll-view", dy: 260, app: app, velocity: fastVelocity)
        scrollByOffset(scrollViewId: "main-scroll-view", dy: -260, app: app, velocity: fastVelocity)
        Thread.sleep(forTimeInterval: 1.4)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: countAfterCycle1 + 1,
                                   app: app, timeout: EXTENDED_TIMEOUT)

        // The new cycle's duration must have reset — it reflects only this short
        // cycle, not the 4000+ ms accumulated in cycle 1.
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
