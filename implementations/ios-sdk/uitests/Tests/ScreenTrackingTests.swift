import XCTest

final class ScreenTrackingTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        clearProfileState(app: app, requireFreshAppInstance: true)
    }

    func testTrackSingleViewVisit() {
        waitForElement(app.buttons["navigation-test-button"])
        app.buttons["navigation-test-button"].tap()

        waitForElement(app.buttons["go-to-view-one-button"])
        app.buttons["go-to-view-one-button"].tap()

        waitForElement(app.otherElements["navigation-view-test-one"])
        waitForTextEquals("screen-event-log", expected: "NavigationHome,NavigationViewOne", app: app)
    }

    func testTrackMultipleViewVisitsInOrder() {
        waitForElement(app.buttons["navigation-test-button"])
        app.buttons["navigation-test-button"].tap()

        waitForElement(app.buttons["go-to-view-one-button"])
        app.buttons["go-to-view-one-button"].tap()

        waitForElement(app.otherElements["navigation-view-test-one"])
        waitForElement(app.buttons["go-to-view-two-button"])
        app.buttons["go-to-view-two-button"].tap()

        waitForElement(app.otherElements["navigation-view-test-two"])

        let logText = waitForElementText("screen-event-log", app: app) { text in
            text.contains("NavigationViewTwo")
        }

        let viewOneIndex = logText.range(of: "NavigationViewOne")
        let viewTwoIndex = logText.range(of: "NavigationViewTwo")

        XCTAssertNotNil(viewOneIndex)
        XCTAssertNotNil(viewTwoIndex)
        XCTAssertLessThan(viewOneIndex!.lowerBound, viewTwoIndex!.lowerBound)
    }

    func testTrackRevisitingViewOneAfterViewTwo() {
        waitForElement(app.buttons["navigation-test-button"])
        app.buttons["navigation-test-button"].tap()

        waitForElement(app.buttons["go-to-view-one-button"])
        app.buttons["go-to-view-one-button"].tap()

        waitForElement(app.otherElements["navigation-view-test-one"])
        waitForElement(app.buttons["go-to-view-two-button"])
        app.buttons["go-to-view-two-button"].tap()

        waitForElement(app.otherElements["navigation-view-test-two"])

        // Press back to return to view one
        app.navigationBars.buttons.element(boundBy: 0).tap()

        waitForElement(app.otherElements["navigation-view-test-one"])
        waitForTextEquals(
            "screen-event-log",
            expected: "NavigationHome,NavigationViewOne,NavigationViewTwo,NavigationViewOne",
            app: app
        )
    }
}
