import XCTest

final class UnidentifiedVariantsTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        // These tests assert the new-visitor mock fixture is served, which the
        // mock server routes by the persisted `anonymousId`. An in-app reset
        // via the button only clears state when the user is currently
        // identified — if the simulator already booted into an unidentified
        // surface, `clearProfileState` returns immediately and any stale
        // `anonymousId` stays around, so the mock keeps serving the
        // identified-visitor fixture. `requireFreshAppInstance: true` triggers
        // `--reset`, which wipes the SDK's UserDefaults suite on launch.
        clearProfileState(app: app, requireFreshAppInstance: true)
    }

    func testDisplaysMergeTagEntry() {
        // Merge tag entry uses rich text which renders as "No content" in the iOS app
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

    func testDisplaysBaselineForNewVisitors() {
        let entry = app.otherElements["content-entry-2Z2WLOx07InSewC3LUB3eX"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("baseline") || entry.label.contains("new") || entry.label.contains("all"),
                      "Expected baseline content, got: \(entry.label)")
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
        XCTAssertTrue(entry.label.contains("custom event") || entry.label.contains("baseline"),
                      "Expected custom event entry content, got: \(entry.label)")
    }

    func testDisplaysIdentificationEntry() {
        scrollToElement(testId: "content-entry-7pa5bOx8Z9NmNcr7mISvD",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["content-entry-7pa5bOx8Z9NmNcr7mISvD"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("identified") || entry.label.contains("baseline"),
                      "Expected identification entry content, got: \(entry.label)")
    }

    // MARK: - Nested optimization baselines

    func testDisplaysLevel0NestedBaseline() {
        scrollToElement(testId: "content-entry-1JAU028vQ7v6nB2swl3NBo",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["content-entry-1JAU028vQ7v6nB2swl3NBo"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("level 0") || entry.label.contains("nested") || entry.label.contains("baseline"),
                      "Expected level 0 nested baseline content, got: \(entry.label)")
    }

    func testDisplaysLevel1NestedBaseline() {
        scrollToElement(testId: "content-entry-5i4SdJXw9oDEY0vgO7CwF4",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["content-entry-5i4SdJXw9oDEY0vgO7CwF4"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("level 1") || entry.label.contains("nested") || entry.label.contains("baseline"),
                      "Expected level 1 nested baseline content, got: \(entry.label)")
    }

    func testDisplaysLevel2NestedBaseline() {
        scrollToElement(testId: "content-entry-uaNY4YJ0HFPAX3gKXiRdX",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["content-entry-uaNY4YJ0HFPAX3gKXiRdX"]
        waitForElement(entry)
        XCTAssertTrue(entry.label.contains("level 2") || entry.label.contains("nested") || entry.label.contains("baseline"),
                      "Expected level 2 nested baseline content, got: \(entry.label)")
    }
}
