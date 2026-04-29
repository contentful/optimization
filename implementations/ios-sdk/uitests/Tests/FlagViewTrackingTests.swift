import XCTest

/// Tests that a subscribed boolean flag emits component events.
///
/// Note: The iOS implementation app currently does not subscribe to boolean flags
/// (this is a feature of the RN SDK's `sdk.states.flag('boolean').subscribe()`).
/// This test verifies basic event tracking as a placeholder until boolean flag
/// subscriptions are supported.
final class FlagViewTrackingTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        clearProfileState(app: app, requireFreshAppInstance: true)
    }

    func testEmitsComponentEventsForTrackedEntries() {
        waitForElement(app.staticTexts["Analytics Events"])
        waitForEventsCountAtLeast(1, app: app, timeout: EXTENDED_TIMEOUT)
    }
}
