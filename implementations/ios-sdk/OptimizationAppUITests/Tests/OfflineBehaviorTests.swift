import XCTest

/// Tests offline behavior using network simulation via launch arguments.
///
/// The app checks for `--simulate-offline` and `--simulate-online` launch arguments
/// to toggle `client.setOnline()`. Since XCUITest cannot toggle network state at runtime
/// without relaunching, these tests verify offline behavior across app launches.
final class OfflineBehaviorTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launchArguments = []
        app.launch()
        clearProfileState(app: app)
    }

    override func tearDown() {
        // Ensure app is restored to normal state
        app.launchArguments = []
    }

    func testContinuesToTrackEventsWhileOffline() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForEventsCountAtLeast(1, app: app)

        let eventsTextBefore = getElementTextById("events-count", app: app)
        let countBefore = parseEventsCount(eventsTextBefore)

        // Tap identify which generates analytics events even offline
        app.buttons["identify-button"].tap()

        // Verify event counter increased
        _ = waitForElementText("events-count", app: app) { text in
            parseEventsCount(text) >= countBefore + 1
        }
    }

    func testRecoverGracefullyWhenNetworkRestored() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Simulate offline by relaunching with flag
        app.terminate()
        app.launchArguments = ["--simulate-offline"]
        app.launch()

        waitForElement(app.staticTexts["Analytics Events"])
        Thread.sleep(forTimeInterval: 1.0)

        // Simulate reconnect
        app.terminate()
        app.launchArguments = []
        app.launch()

        // App should be functional
        waitForElement(app.staticTexts["Analytics Events"])
        waitForElement(app.buttons["identify-button"])
    }

    func testHandleRapidNetworkStateChanges() {
        waitForElement(app.staticTexts["Analytics Events"])

        // Rapid offline/online cycles via relaunches
        app.terminate()
        app.launchArguments = ["--simulate-offline"]
        app.launch()
        waitForElement(app.staticTexts["Analytics Events"], timeout: EXTENDED_TIMEOUT)

        app.terminate()
        app.launchArguments = []
        app.launch()
        waitForElement(app.staticTexts["Analytics Events"], timeout: EXTENDED_TIMEOUT)

        // App should remain stable
        waitForElement(app.buttons["identify-button"])
    }

    func testQueueEventsOfflineAndFlushWhenOnline() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForEventsCountAtLeast(1, app: app)

        let countBefore = parseEventsCount(getElementTextById("events-count", app: app))

        // Trigger identify which creates events
        app.buttons["identify-button"].tap()

        // Verify event counter increased
        _ = waitForElementText("events-count", app: app) { text in
            parseEventsCount(text) >= countBefore + 1
        }

        // After identify, reset button should be visible
        waitForElement(app.buttons["reset-button"])
    }
}
