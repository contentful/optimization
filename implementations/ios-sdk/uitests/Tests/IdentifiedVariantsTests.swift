import XCTest

/// 1:1 port of `displays-identified-user-variants.test.js`.
///
/// Verifies that once a visitor has been identified and the app has been
/// relaunched, the SDK resolves and renders the correct variant for each
/// optimized entry on screen. Covers common variants (merge tag, continent,
/// device), identified-user-only variants (return visitor, A/B/C bucket,
/// custom-event audience, identified audience), and nested optimization
/// variants across three levels of depth.
final class IdentifiedVariantsTests: XCTestCase {
    let app = XCUIApplication()

    override class func setUp() {
        let app = XCUIApplication()
        app.launch()
        clearProfileState(app: app)

        waitForElement(app.buttons["identify-button"], timeout: ELEMENT_VISIBILITY_TIMEOUT)
        app.buttons["identify-button"].tap()
        waitForElement(app.buttons["reset-button"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // Relaunch as a new instance so the identified state is rehydrated from
        // persistent storage. The relaunched app derives the identify/reset
        // control from the rehydrated identified profile, so `reset-button`
        // (not `identify-button`) appears. Waiting for it both confirms the
        // relaunch finished loading and proves the identified profile actually
        // survived the cold start — the precondition every test in this suite
        // needs.
        app.terminate()
        app.launch()
        waitForElement(app.buttons["reset-button"], timeout: ELEMENT_VISIBILITY_TIMEOUT)
    }

    // MARK: - common variants

    func testShouldDisplayMergeTagContentWithResolvedValue() {
        let element = app.otherElements["entry-text-1MwiFl4z7gkwqGYdvCmr8c"]
        waitForElement(element, timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // Asserted against the element's label (not via a label subscript) because
        // the merge tag label exceeds XCUITest's 128-character identifier limit.
        let expected = "This is a merge tag content entry that displays the visitor's continent \"EU\" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]"
        XCTAssertEqual(element.label, expected, "Expected merge tag variant label to be visible")
    }

    func testShouldDisplayVariantForVisitorsFromEurope() {
        waitForElement(app.otherElements["entry-text-4ib0hsHWoSOnCVdDkizE8d"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a variant content entry for visitors from Europe. [Entry: 4ib0hsHWoSOnCVdDkizE8d]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected Europe continent variant label to be visible")
    }

    func testShouldDisplayVariantForDesktopBrowserVisitors() {
        waitForElement(app.otherElements["entry-text-xFwgG3oNaOcjzWiGe4vXo"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a variant content entry for visitors using a desktop browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected desktop browser variant label to be visible")
    }

    // MARK: - identified user variants

    func testShouldDisplayVariantForReturnVisitors() {
        waitForElement(app.otherElements["entry-text-2Z2WLOx07InSewC3LUB3eX"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a variant content entry for return visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected return visitor variant label to be visible")
    }

    func testShouldDisplayVariantBForABCExperiment() {
        waitForElement(app.otherElements["entry-text-5XHssysWUDECHzKLzoIsg1"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a variant content entry for an A/B/C experiment: B [Entry: 5XHssysWUDECHzKLzoIsg1]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected A/B/C experiment variant B label to be visible")
    }

    func testShouldDisplayVariantForVisitorsWithCustomEvent() {
        waitForElement(app.otherElements["entry-text-6zqoWXyiSrf0ja7I2WGtYj"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a variant content entry for visitors with a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected custom event variant label to be visible")
    }

    func testShouldDisplayVariantForIdentifiedUsers() {
        waitForElement(app.otherElements["entry-text-7pa5bOx8Z9NmNcr7mISvD"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a variant content entry for identified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected identified users variant label to be visible")
    }

    // MARK: - nested optimization variants

    func testShouldDisplayLevel0NestedVariantForReturnVisitors() {
        waitForElement(app.otherElements["entry-text-2KIWllNZJT205BwOSkMINg"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a level 0 nested variant entry. [Entry: 2KIWllNZJT205BwOSkMINg]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 0 nested variant label to be visible")
    }

    func testShouldDisplayLevel1NestedVariantForReturnVisitors() {
        waitForElement(app.otherElements["entry-text-5a8ONfBdanJtlJ39WWnH1w"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a level 1 nested variant entry. [Entry: 5a8ONfBdanJtlJ39WWnH1w]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 1 nested variant label to be visible")
    }

    func testShouldDisplayLevel2NestedVariantForReturnVisitors() {
        waitForElement(app.otherElements["entry-text-4hDiXxYEFrXHXcQgmdL9Uv"],
                       timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let expected = "This is a level 2 nested variant entry. [Entry: 4hDiXxYEFrXHXcQgmdL9Uv]"
        XCTAssertTrue(app.otherElements[expected].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 2 nested variant label to be visible")
    }
}
