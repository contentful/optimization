import XCTest

/// Flag View Tracking
///
/// Verifies that when an app subscribes to a flag through the SDK, the SDK emits a
/// view event for that flag so the value's exposure can be measured downstream.
///
/// Platform note: both iOS implementation app shells subscribe to the `boolean`
/// flag on launch through the native SDK wrapper so this E2E test can assert
/// the SDK-emitted flag view event without app-level consent workarounds.
final class FlagViewTrackingTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        // beforeEach: clear profile state with a fresh app instance.
        clearProfileState(app: app, requireFreshAppInstance: true)
    }

    /// "should emit flag view events for the subscribed boolean flag"
    ///
    /// Verifies: subscribing to the `boolean` flag on app launch produces at least
    /// one view event for that flag.
    func testEmitsFlagViewEventsForSubscribedBooleanFlag() {
        // 1. Wait until the "Analytics Events" text is visible.
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // 2. Wait until flag `boolean` has at least 1 view event.
        waitForComponentEventCount("boolean", minCount: 1, app: app, timeout: ELEMENT_VISIBILITY_TIMEOUT)
    }
}
