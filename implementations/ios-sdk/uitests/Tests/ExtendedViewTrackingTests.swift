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

    func testVisibleEntryProducesViewAndScrollOutUpdate() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Observe the qualified start without scrolling the entry out of view.
        let eventCountId = "event-count-\(VISIBLE_ENTRY_ID)"
        let startText = waitForElementText(eventCountId, app: app, timeout: EXTENDED_TIMEOUT) {
            self.parseComponentCount($0) >= 1
        }
        let startCount = parseComponentCount(startText)

        // Scrolling to the stats ends the active visibility cycle.
        scrollToElement(testId: eventCountId, scrollViewId: "main-scroll-view", app: app)
        _ = waitForElementText(eventCountId, app: app, timeout: EXTENDED_TIMEOUT) {
            self.parseComponentCount($0) >= startCount + 1
        }
    }

    func testTracksEntryAgainAfterScrollAwayAndBack() {
        waitForElement(app.staticTexts["Analytics Events"])

        let eventCountId = "event-count-\(VISIBLE_ENTRY_ID)"
        let startText = waitForElementText(eventCountId, app: app, timeout: EXTENDED_TIMEOUT) {
            self.parseComponentCount($0) >= 1
        }
        let startCount = parseComponentCount(startText)

        // Scroll the first exposure out of view and observe its update.
        app.scrollViews["main-scroll-view"].swipeUp(times: 2)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: startCount + 1,
                                   app: app, timeout: EXTENDED_TIMEOUT)
        let countAfterScroll = parseComponentCount(getElementTextById(eventCountId, app: app))

        // The visible entry can be observed again after returning.
        scrollEntryIntoView("content-entry-\(VISIBLE_ENTRY_ID)",
                            scrollViewId: "main-scroll-view", app: app)
        Thread.sleep(forTimeInterval: 2.6)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: countAfterScroll + 1,
                                   app: app, timeout: EXTENDED_TIMEOUT)
    }

    func testNoEventsBeforeDwellThreshold() {
        let scrollView = app.scrollViews["main-scroll-view"]
        waitForElement(scrollView, timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // On a tall simulator the "below-fold" entry can render just inside the
        // viewport at launch. Sweep it up and out with large, fast momentum-free
        // drags: each single drag carries the entry all the way through the 0.1
        // tracked-visibility band in a few hundred milliseconds and ends with it
        // below that band, so it never rests on screen — between XCUITest
        // gestures or otherwise — long enough to trip the 1000 ms dwell timer. The wider
        // visibility band and shorter dwell make this test more sensitive to driver timing.
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

    func testTracksMultipleVisibleEntries() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 1 event from each visible entry
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        waitForComponentEventCount(SECOND_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
    }

    func testRecordsViewActivityAcrossNavigation() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Wait for at least 1 tracking event (active cycle with emitted event)
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)

        // Record the current event count
        let preNavText = getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app)
        let preNavCount = parseComponentCount(preNavText)

        // Scroll back to top so the Navigation Test button is accessible
        let scrollView = app.scrollViews["main-scroll-view"]
        scrollView.swipeDown(times: 3)

        // Navigate away and back to exercise the visible entry's lifecycle.
        let navButton = app.buttons["navigation-test-button"]
        waitForElement(navButton)
        navButton.tap()
        waitForElement(app.buttons["close-navigation-test-button"])

        // Allow the navigation transition to settle before returning.
        Thread.sleep(forTimeInterval: 0.5)

        // Navigate back to main screen
        app.buttons["close-navigation-test-button"].tap()

        // Wait for the events display to reappear (screen remounts with persisted state)
        waitForElement(app.staticTexts["Analytics Events"])
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        // View activity remains observable across navigation.
        let postNavText = getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app)
        let postNavCount = parseComponentCount(postNavText)
        XCTAssertGreaterThan(postNavCount, preNavCount)
    }

    func testResumesViewTrackingAfterBackground() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Cycle 1: entry 0 is visible on launch. Wait for its initial event;
        // reading the stats then scrolls it off, which ends cycle 1.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 1, app: app, timeout: EXTENDED_TIMEOUT)
        let countBeforeBackground = parseComponentCount(
            getElementTextById("event-count-\(VISIBLE_ENTRY_ID)", app: app))

        // Return the entry to view and let it qualify before backgrounding.
        scrollEntryIntoView("content-entry-\(VISIBLE_ENTRY_ID)",
                            scrollViewId: "main-scroll-view", app: app)
        Thread.sleep(forTimeInterval: 3.0)

        // Backgrounding can end the active exposure.
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.0)

        // Return to the app and let the visible entry qualify again.
        app.activate()
        waitForElement(app.staticTexts["Analytics Events"])

        // Scroll the stats into view to read the updated count.
        Thread.sleep(forTimeInterval: 3.0)
        scrollToElement(testId: "event-count-\(VISIBLE_ENTRY_ID)",
                        scrollViewId: "main-scroll-view", app: app)

        // Backgrounding ended the pre-background cycle with a final event and
        // foregrounding started a fresh one with its own initial event, so the
        // count must advance by at least 2.
        waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: countBeforeBackground + 2,
                                   app: app, timeout: EXTENDED_TIMEOUT)
    }

    // MARK: - Helpers

    private func parseComponentCount(_ text: String) -> Int {
        let pattern = #/Count:\s*(\d+)/#
        guard let match = text.firstMatch(of: pattern) else { return 0 }
        return Int(match.1) ?? 0
    }
}
