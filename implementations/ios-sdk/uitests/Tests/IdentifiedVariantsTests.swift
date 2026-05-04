import XCTest

final class IdentifiedVariantsTests: XCTestCase {
    let app = XCUIApplication()

    override class func setUp() {
        let app = XCUIApplication()
        app.launch()
        clearProfileState(app: app)

        waitForElement(app.buttons["identify-button"])
        app.buttons["identify-button"].tap()
        waitForElement(app.buttons["reset-button"])

        // Relaunch to test persistence of identified state
        app.terminate()
        app.launch()
        waitForElement(app.buttons["identify-button"])
    }

    func testDisplaysMergeTagEntry() {
        let entry = app.otherElements["content-entry-1MwiFl4z7gkwqGYdvCmr8c"]
        waitForElement(entry)
        XCTAssertFalse(entry.label.isEmpty, "Entry should have content")
    }

    func testDisplaysContinentBasedEntry() {
        let entry = app.otherElements["content-entry-4ib0hsHWoSOnCVdDkizE8d"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("continent") || entry.label.contains("Europe"),
                      "Expected continent-based content, got: \(entry.label)")
    }

    func testDisplaysDeviceBasedEntry() {
        let entry = app.otherElements["content-entry-xFwgG3oNaOcjzWiGe4vXo"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("device") || entry.label.contains("desktop"),
                      "Expected device-based content, got: \(entry.label)")
    }

    func testDisplaysReturnVisitorEntry() {
        let entry = app.otherElements["content-entry-2Z2WLOx07InSewC3LUB3eX"]
        waitForElement(entry)
        XCTAssertFalse(entry.label.isEmpty, "Expected return visitor content")
    }

    func testDisplaysABCExperimentEntry() {
        let entry = app.otherElements["content-entry-5XHssysWUDECHzKLzoIsg1"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("A/B/C") || entry.label.contains("experiment"),
                      "Expected A/B/C experiment content, got: \(entry.label)")
    }

    func testDisplaysCustomEventEntry() {
        let entry = app.otherElements["content-entry-6zqoWXyiSrf0ja7I2WGtYj"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("custom event") || entry.label.contains("baseline") || entry.label.contains("variant"),
                      "Expected custom event entry content, got: \(entry.label)")
    }

    func testDisplaysIdentifiedUserEntry() {
        scrollToElement(testId: "content-entry-7pa5bOx8Z9NmNcr7mISvD",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["content-entry-7pa5bOx8Z9NmNcr7mISvD"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("identified") || entry.label.contains("baseline") || entry.label.contains("variant"),
                      "Expected identification entry content, got: \(entry.label)")
    }

    // MARK: - Nested optimization variants
    //
    // Nested entries use the baseline entry ID for their accessibility identifier
    // (set on the OptimizedEntry wrapper). The resolved variant content is displayed
    // inside, so the label reflects the variant text.

    func testDisplaysLevel0NestedVariant() {
        scrollToElement(testId: "content-entry-1JAU028vQ7v6nB2swl3NBo",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["content-entry-1JAU028vQ7v6nB2swl3NBo"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("level 0") || entry.label.contains("nested"),
                      "Expected level 0 nested variant content, got: \(entry.label)")
    }

    func testDisplaysLevel1NestedVariant() {
        scrollToElement(testId: "content-entry-5i4SdJXw9oDEY0vgO7CwF4",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["content-entry-5i4SdJXw9oDEY0vgO7CwF4"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("level 1") || entry.label.contains("nested"),
                      "Expected level 1 nested variant content, got: \(entry.label)")
    }

    func testDisplaysLevel2NestedVariant() {
        scrollToElement(testId: "content-entry-uaNY4YJ0HFPAX3gKXiRdX",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["content-entry-uaNY4YJ0HFPAX3gKXiRdX"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("level 2") || entry.label.contains("nested"),
                      "Expected level 2 nested variant content, got: \(entry.label)")
    }
}
