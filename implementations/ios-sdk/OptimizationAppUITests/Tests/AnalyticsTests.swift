import XCTest

final class AnalyticsTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launch()
        clearProfileState(app: app)
    }

    func testTracksComponentImpressionEventsForVisibleEntries() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForEventsCountAtLeast(1, app: app)
        waitForComponentEventCount("1MwiFl4z7gkwqGYdvCmr8c", minCount: 1, app: app)
    }
}
