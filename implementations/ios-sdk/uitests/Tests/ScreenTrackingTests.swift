import XCTest

final class ScreenTrackingTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        clearProfileState(app: app, requireFreshAppInstance: true)
    }

    /// Reads the `screen-event-log` element and returns its visible text
    /// (falling back to its accessibility label) as a string.
    private func getScreenEventLogText() -> String {
        let element = findElement("screen-event-log", app: app)
        XCTAssertTrue(element.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Element screen-event-log not found")
        return extractText(element)
    }

    func testTrackSingleViewVisit() {
        waitForElement(app.buttons["navigation-test-button"])
        app.buttons["navigation-test-button"].tap()

        waitForElement(app.buttons["go-to-view-one-button"])
        app.buttons["go-to-view-one-button"].tap()

        waitForElement(app.otherElements["navigation-view-test-one"])
        waitForElement(findElement("screen-event-log", app: app))

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
        waitForElement(findElement("screen-event-log", app: app))

        let logText = waitForElementText("screen-event-log", app: app) { text in
            text.contains("NavigationViewTwo")
        }

        let viewOneIndex = logText.range(of: "NavigationViewOne").map {
            logText.distance(from: logText.startIndex, to: $0.lowerBound)
        } ?? -1
        let viewTwoIndex = logText.range(of: "NavigationViewTwo").map {
            logText.distance(from: logText.startIndex, to: $0.lowerBound)
        } ?? -1

        XCTAssertGreaterThanOrEqual(viewOneIndex, 0)
        XCTAssertGreaterThan(viewTwoIndex, viewOneIndex)
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

        // Trigger platform back navigation to return to view one
        app.navigationBars.buttons.element(boundBy: 0).tap()

        waitForElement(app.otherElements["navigation-view-test-one"])
        waitForElement(findElement("screen-event-log", app: app))

        waitForTextEquals(
            "screen-event-log",
            expected: "NavigationHome,NavigationViewOne,NavigationViewTwo,NavigationViewOne",
            app: app
        )
    }
}
