import XCTest

final class TapTrackingTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launch()
        clearProfileState(app: app)
    }

    func testEmitsComponentClickWhenTappingContentEntry() {
        waitForElement(app.staticTexts["Analytics Events"])

        let entry = app.otherElements["content-entry-1MwiFl4z7gkwqGYdvCmr8c"]
        waitForElement(entry)
        entry.tap()

        waitForEventsCountAtLeast(1, app: app)

        let eventElement = app.staticTexts["event-component_click-1MwiFl4z7gkwqGYdvCmr8c"]
        scrollToElement(testId: "event-component_click-1MwiFl4z7gkwqGYdvCmr8c",
                        scrollViewId: "main-scroll-view", app: app)
        XCTAssertTrue(eventElement.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT))
    }

    func testEmitsComponentClickForDifferentEntry() {
        waitForElement(app.staticTexts["Analytics Events"])

        let entry = app.otherElements["content-entry-2Z2WLOx07InSewC3LUB3eX"]
        waitForElement(entry)
        entry.tap()

        waitForEventsCountAtLeast(1, app: app)

        let eventElement = app.staticTexts["event-component_click-2Z2WLOx07InSewC3LUB3eX"]
        scrollToElement(testId: "event-component_click-2Z2WLOx07InSewC3LUB3eX",
                        scrollViewId: "main-scroll-view", app: app)
        XCTAssertTrue(eventElement.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT))
    }

    // [NT-3829] regression test: a Button the app puts *inside* an
    // OptimizedEntry (with trackTaps: true) must still fire its own action
    // when tapped, instead of the SDK's tap-tracking swallowing the touch.
    // See NestedButtonTapTestScreen.swift / NestedButtonTapTestViewController.swift
    // for the on-screen setup this test drives.
    func testTappingNestedButtonWithTrackTapsEnabled() {
        // 1. Open the dedicated test screen from the main screen's button row.
        let openButton = app.buttons["nested-button-tap-test-button"]
        waitForElement(openButton)
        openButton.tap()

        // 2. Tap the "Book" button, which the test screen renders nested
        //    inside an OptimizedEntry with trackTaps: true — this is the
        //    exact shape of the original bug report.
        let bookButton = app.buttons["book-button"]
        waitForElement(bookButton)
        bookButton.tap()

        // 3. If the tap reached the button (bug fixed), its own counter
        //    increments to 1. If the SDK's tap tracking swallowed the touch
        //    (bug present), the counter would stay at 0 and this fails.
        waitForTextEquals("book-tap-count", expected: "Book taps: 1", app: app)

        app.buttons["close-nested-button-test-button"].tap()
    }
}
