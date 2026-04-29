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
}
