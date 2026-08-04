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

    // [NT-3829] regression: a Button nested inside an OptimizedEntry with
    // trackTaps: true must still receive its own tap.
    func testTappingNestedButtonWithTrackTapsEnabled() {
        let openButton = app.buttons["nested-button-tap-test-button"]
        waitForElement(openButton)
        openButton.tap()

        let bookButton = app.buttons["book-button"]
        waitForElement(bookButton)
        bookButton.tap()

        waitForTextEquals("book-tap-count", expected: "Book taps: 1", app: app)

        app.buttons["close-nested-button-test-button"].tap()
    }
}
