import XCTest

/// Pattern that the `*-entry-id` Text nodes render via LiveUpdatesEntryDisplay.
/// The id segment after "Entry: " is a Contentful sys.id (alphanumeric, no spaces).
/// Asserting against this proves the SDK actually resolved an entry rather than
/// rendering an empty/default state.
private let ENTRY_ID_TEXT_PATTERN = #/^Entry: [a-zA-Z0-9]+$/#

final class LiveUpdatesTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launch()
        clearProfileState(app: app)

        waitForElement(app.buttons["live-updates-test-button"])
        app.buttons["live-updates-test-button"].tap()

        waitForElement(app.otherElements["default-optimization"])
    }

    override func tearDown() {
        let closeButton = app.buttons["close-live-updates-test-button"]
        if closeButton.exists { closeButton.tap() }

        let mainButton = app.buttons["live-updates-test-button"]
        _ = mainButton.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT)
    }

    // MARK: - Default behavior (locked on first value)

    func testDefaultDoesNotUpdateOnIdentifyGlobalLiveUpdatesFalse() {
        // Capture the SDK-resolved entry id for both the locked default section
        // and the always-live reference section.
        waitForElement(app.staticTexts["default-entry-id"])
        waitForElement(app.staticTexts["live-entry-id"])

        let initialDefaultEntryIdText = getElementTextById("default-entry-id", app: app)
        let initialLiveEntryIdText = getElementTextById("live-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        // The live-prefixed section has liveUpdates=true, so it MUST re-resolve
        // to a different variant after identify. Without this proof, the
        // "locked stays locked" assertion below would be meaningless.
        waitForTextChange("live-entry-id", baseline: initialLiveEntryIdText, app: app)

        // Default section inherits the global setting (off), so the lock must hold.
        waitForTextEquals("default-entry-id", expected: initialDefaultEntryIdText, app: app)
    }

    // MARK: - Global liveUpdates enabled

    func testGlobalLiveUpdatesEnablesDefaultComponents() {
        app.buttons["toggle-global-live-updates-button"].tap()
        waitForTextEquals("global-live-updates-status", expected: "ON", app: app)

        waitForElement(app.staticTexts["default-entry-id"])
        let initialDefaultEntryIdText = getElementTextById("default-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        waitForTextChange("default-entry-id", baseline: initialDefaultEntryIdText, app: app)
    }

    func testLockedComponentsIgnoreGlobalLiveUpdates() {
        app.buttons["toggle-global-live-updates-button"].tap()
        waitForTextEquals("global-live-updates-status", expected: "ON", app: app)

        waitForElement(app.staticTexts["locked-entry-id"])
        waitForElement(app.staticTexts["default-entry-id"])

        let initialLockedEntryIdText = getElementTextById("locked-entry-id", app: app)
        let initialDefaultEntryIdText = getElementTextById("default-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        // With global=ON the default section (no per-component prop) MUST
        // re-resolve. This is the live-reference that proves the SDK is
        // actually swapping variants.
        waitForTextChange("default-entry-id", baseline: initialDefaultEntryIdText, app: app)

        // Locked section has liveUpdates=false, so it must stay at its captured id.
        waitForTextEquals("locked-entry-id", expected: initialLockedEntryIdText, app: app)
    }

    // MARK: - Per-component liveUpdates=true

    func testLiveComponentUpdatesRegardlessOfGlobal() {
        waitForTextEquals("global-live-updates-status", expected: "OFF", app: app)
        waitForElement(app.staticTexts["live-entry-id"])

        let initialLiveEntryIdText = getElementTextById("live-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        waitForTextChange("live-entry-id", baseline: initialLiveEntryIdText, app: app)
    }

    // MARK: - Per-component liveUpdates=false

    func testLockedComponentDoesNotUpdateEvenWhenGlobalOn() {
        app.buttons["toggle-global-live-updates-button"].tap()
        waitForTextEquals("global-live-updates-status", expected: "ON", app: app)

        waitForElement(app.staticTexts["locked-entry-id"])
        waitForElement(app.staticTexts["live-entry-id"])

        let initialLockedEntryIdText = getElementTextById("locked-entry-id", app: app)
        let initialLiveEntryIdText = getElementTextById("live-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        // Live section (per-component liveUpdates=true) MUST change — the SDK is
        // re-resolving on identify. The per-component prop is the path under
        // test: it must override the global=true setting and keep the locked
        // section stable.
        waitForTextChange("live-entry-id", baseline: initialLiveEntryIdText, app: app)
        waitForTextEquals("locked-entry-id", expected: initialLockedEntryIdText, app: app)
    }

    // MARK: - Preview panel simulation

    func testPreviewPanelEnablesLiveUpdatesForAll() {
        waitForTextEquals("preview-panel-status", expected: "Closed", app: app)
        app.buttons["simulate-preview-panel-button"].tap()
        waitForTextEquals("preview-panel-status", expected: "Open", app: app)

        waitForElement(app.staticTexts["default-entry-id"])
        waitForElement(app.staticTexts["live-entry-id"])
        waitForElement(app.staticTexts["locked-entry-id"])

        let initialDefaultEntryIdText = getElementTextById("default-entry-id", app: app)
        let initialLiveEntryIdText = getElementTextById("live-entry-id", app: app)
        let initialLockedEntryIdText = getElementTextById("locked-entry-id", app: app)

        app.buttons["live-updates-identify-button"].tap()
        waitForTextEquals("identified-status", expected: "Yes", app: app)

        // While the preview panel is open, the SDK forces shouldLiveUpdate=true
        // for ALL sections, including the per-component liveUpdates=false one.
        // All three resolved variants must change.
        waitForTextChange("default-entry-id", baseline: initialDefaultEntryIdText, app: app)
        waitForTextChange("live-entry-id", baseline: initialLiveEntryIdText, app: app)
        waitForTextChange("locked-entry-id", baseline: initialLockedEntryIdText, app: app)
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

    // MARK: - Three Optimization sections display

    func testDisplaysAllThreeOptimizationEntrySections() {
        waitForElement(app.otherElements["default-optimization"])
        waitForElement(app.otherElements["live-optimization"])
        waitForElement(app.otherElements["locked-optimization"])

        // Section wrappers render unconditionally — proving they're mounted is
        // just a smoke check. The SDK responsibility is to feed each section a
        // resolved entry whose sys.id surfaces in the entry-id Text.
        waitForElement(app.staticTexts["default-entry-id"])
        waitForElement(app.staticTexts["live-entry-id"])
        waitForElement(app.staticTexts["locked-entry-id"])

        let defaultEntryIdText = getElementTextById("default-entry-id", app: app)
        let liveEntryIdText = getElementTextById("live-entry-id", app: app)
        let lockedEntryIdText = getElementTextById("locked-entry-id", app: app)

        XCTAssertNotNil(try? ENTRY_ID_TEXT_PATTERN.wholeMatch(in: defaultEntryIdText),
                        "default-entry-id \"\(defaultEntryIdText)\" did not match ENTRY_ID_TEXT_PATTERN")
        XCTAssertNotNil(try? ENTRY_ID_TEXT_PATTERN.wholeMatch(in: liveEntryIdText),
                        "live-entry-id \"\(liveEntryIdText)\" did not match ENTRY_ID_TEXT_PATTERN")
        XCTAssertNotNil(try? ENTRY_ID_TEXT_PATTERN.wholeMatch(in: lockedEntryIdText),
                        "locked-entry-id \"\(lockedEntryIdText)\" did not match ENTRY_ID_TEXT_PATTERN")
    }

    func testDisplaysEntryContentInAllSections() {
        // iOS collapses the RN `*-container` wrapper into the section's
        // accessibility container `*-optimization` — SwiftUI cannot expose a
        // nested accessibility container inside another. The `*-text` assertions
        // below carry the real entry-content verification.
        waitForElement(app.otherElements["default-optimization"])
        waitForElement(app.otherElements["live-optimization"])
        waitForElement(app.otherElements["locked-optimization"])

        let defaultText = getElementTextById("default-text", app: app)
        let liveText = getElementTextById("live-text", app: app)
        let lockedText = getElementTextById("locked-text", app: app)

        // LiveUpdatesEntryDisplay falls back to 'No content' when the resolved
        // entry has no text field — a non-empty text that isn't the fallback
        // proves the SDK fed a real field value.
        XCTAssertGreaterThan(defaultText.count, 0)
        XCTAssertGreaterThan(liveText.count, 0)
        XCTAssertGreaterThan(lockedText.count, 0)
        XCTAssertNotEqual(defaultText, "No content")
        XCTAssertNotEqual(liveText, "No content")
        XCTAssertNotEqual(lockedText, "No content")

        // All three sections wrap the same Contentful entry, so before any
        // identify/toggle/preview-panel actions they MUST resolve to the same
        // variant.
        XCTAssertEqual(defaultText, liveText)
        XCTAssertEqual(defaultText, lockedText)
    }
}
