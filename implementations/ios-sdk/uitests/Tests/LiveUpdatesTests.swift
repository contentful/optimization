import XCTest

final class LiveUpdatesTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launch()
        clearProfileState(app: app)

        waitForElement(app.buttons["live-updates-test-button"])
        app.buttons["live-updates-test-button"].tap()

        waitForElement(app.otherElements["default-personalization"])
    }

    override func tearDown() {
        let closeButton = app.buttons["close-live-updates-test-button"]
        if closeButton.exists { closeButton.tap() }

        let mainButton = app.buttons["live-updates-test-button"]
        _ = mainButton.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT)
    }

    // MARK: - Default behavior (locked on first value)

    func testDefaultDoesNotUpdateOnIdentify() {
        waitForElement(app.staticTexts["default-entry-id"])
        let initialText = getElementTextById("default-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)
        waitForTextEquals("default-entry-id", expected: initialText, app: app)
    }

    // MARK: - Global liveUpdates enabled

    func testGlobalLiveUpdatesEnablesDefaultComponents() {
        app.buttons["toggle-global-live-updates-button"].tap()
        waitForTextEquals("global-live-updates-status", expected: "ON", app: app)

        waitForElement(app.staticTexts["default-entry-id"])
        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        XCTAssertTrue(app.staticTexts["default-entry-id"].exists)
    }

    func testLockedComponentsIgnoreGlobalLiveUpdates() {
        app.buttons["toggle-global-live-updates-button"].tap()
        waitForTextEquals("global-live-updates-status", expected: "ON", app: app)

        waitForElement(app.staticTexts["locked-entry-id"])
        let initialText = getElementTextById("locked-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)
        waitForTextEquals("locked-entry-id", expected: initialText, app: app)
    }

    // MARK: - Per-component liveUpdates=true

    func testLiveComponentUpdatesRegardlessOfGlobal() {
        waitForTextEquals("global-live-updates-status", expected: "OFF", app: app)
        waitForElement(app.staticTexts["live-entry-id"])

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        XCTAssertTrue(app.staticTexts["live-entry-id"].exists)
    }

    // MARK: - Per-component liveUpdates=false

    func testLockedComponentDoesNotUpdateEvenWhenGlobalOn() {
        app.buttons["toggle-global-live-updates-button"].tap()
        waitForTextEquals("global-live-updates-status", expected: "ON", app: app)

        waitForElement(app.staticTexts["locked-entry-id"])
        let initialText = getElementTextById("locked-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)
        waitForTextEquals("locked-entry-id", expected: initialText, app: app)
    }

    // MARK: - Preview panel simulation

    func testPreviewPanelEnablesLiveUpdatesForAll() {
        waitForTextEquals("preview-panel-status", expected: "Closed", app: app)
        app.buttons["simulate-preview-panel-button"].tap()
        waitForTextEquals("preview-panel-status", expected: "Open", app: app)

        waitForElement(app.staticTexts["default-entry-id"])
        waitForElement(app.staticTexts["live-entry-id"])
        waitForElement(app.staticTexts["locked-entry-id"])

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        XCTAssertTrue(app.staticTexts["default-entry-id"].exists)
        XCTAssertTrue(app.staticTexts["live-entry-id"].exists)
        XCTAssertTrue(app.staticTexts["locked-entry-id"].exists)
    }

    // MARK: - Screen controls

    func testToggleGlobalLiveUpdates() {
        waitForTextEquals("global-live-updates-status", expected: "OFF", app: app)
        app.buttons["toggle-global-live-updates-button"].tap()
        waitForTextEquals("global-live-updates-status", expected: "ON", app: app)
        app.buttons["toggle-global-live-updates-button"].tap()
        waitForTextEquals("global-live-updates-status", expected: "OFF", app: app)
    }

    func testTogglePreviewPanel() {
        waitForTextEquals("preview-panel-status", expected: "Closed", app: app)
        app.buttons["simulate-preview-panel-button"].tap()
        waitForTextEquals("preview-panel-status", expected: "Open", app: app)
        app.buttons["simulate-preview-panel-button"].tap()
        waitForTextEquals("preview-panel-status", expected: "Closed", app: app)
    }

    func testIdentifyAndReset() {
        waitForTextEquals("identified-status", expected: "No", app: app)
        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)
        app.buttons["live-updates-reset-button"].tap()
        waitForTextEquals("identified-status", expected: "No", app: app)
    }

    // MARK: - Three Personalization sections display

    func testDisplaysAllThreePersonalizationComponents() {
        waitForElement(app.otherElements["default-personalization"])
        waitForElement(app.otherElements["live-personalization"])
        waitForElement(app.otherElements["locked-personalization"])
    }

    func testDisplaysEntryContentInAllSections() {
        waitForElement(app.staticTexts["default-text"])
        waitForElement(app.staticTexts["live-text"])
        waitForElement(app.staticTexts["locked-text"])
        XCTAssertTrue(app.staticTexts["default-entry-id"].exists)
        XCTAssertTrue(app.staticTexts["live-entry-id"].exists)
        XCTAssertTrue(app.staticTexts["locked-entry-id"].exists)
    }
}
