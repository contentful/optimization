import XCTest

/// Cross-platform preview-panel override scenarios (iOS side).
///
/// Scenarios mirror `implementations/PREVIEW_PANEL_SCENARIOS.md` and the RN
/// Detox suite `preview-panel-overrides.test.js`. Keep test names and fixture
/// IDs identical across platforms so cross-platform regressions are visible.
final class PreviewPanelOverridesTests: XCTestCase {
    let app = XCUIApplication()

    static let AUDIENCE_ID = "4yIqY7AWtzeehCZxtQSDB"
    static let EXPERIENCE_ID = "7DyidZaPB7Jr1gWKjoogg0"
    static let VARIANT_ENTRY_ID = "5a8ONfBdanJtlJ39WWnH1w"
    static let BASELINE_ENTRY_ID = "5i4SdJXw9oDEY0vgO7CwF4"

    override func setUp() {
        continueAfterFailure = false
        app.launch()
        clearProfileState(app: app)
        identifyAndWaitForEntries()
    }

    // MARK: - Helpers

    private func identifyAndWaitForEntries() {
        let identifyButton = app.buttons["identify-button"]
        waitForElement(identifyButton)
        identifyButton.tap()
        waitForElement(app.buttons["reset-button"])

        // Identified-visitor profile should render variant entries by default.
        let variantEntry = findElement("entry-text-\(Self.VARIANT_ENTRY_ID)", app: app)
        XCTAssertTrue(variantEntry.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected variant entry to render after identify")
    }

    private func openPanel() {
        let fab = app.buttons["preview-panel-fab"]
        waitForElement(fab)
        fab.tap()
        XCTAssertTrue(app.staticTexts["Preview Panel"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Preview Panel did not appear")
    }

    private func closePanel() {
        // The panel sheet is dismissed via the drag handle or close button;
        // sheets can also be dismissed by swiping down on the header.
        let dismissGesture = app.navigationBars.buttons.firstMatch
        if dismissGesture.exists {
            dismissGesture.tap()
            return
        }
        // Fallback: swipe down from top of sheet to dismiss.
        app.swipeDown()
    }

    private func assertEntryVisible(_ entryId: String, message: String) {
        let entry = findElement("entry-text-\(entryId)", app: app)
        XCTAssertTrue(entry.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT), message)
    }

    // MARK: - Scenarios

    func testScenario2DeactivatingQualifiedAudienceRendersBaseline() {
        openPanel()
        let toggle = app.buttons["audience-toggle-\(Self.AUDIENCE_ID)-off"]
        XCTAssertTrue(toggle.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Off toggle not found for audience")
        toggle.tap()
        closePanel()

        assertEntryVisible(Self.BASELINE_ENTRY_ID,
                           message: "Expected baseline entry after deactivating audience")
    }

    func testScenario3ResettingAudienceOverrideRestoresVariant() {
        // Set up by first deactivating, then resetting to default.
        openPanel()
        app.buttons["audience-toggle-\(Self.AUDIENCE_ID)-off"].tap()
        app.buttons["audience-toggle-\(Self.AUDIENCE_ID)-default"].tap()
        closePanel()

        assertEntryVisible(Self.VARIANT_ENTRY_ID,
                           message: "Expected variant entry after resetting audience override")
    }

    func testScenario4SettingVariantOverrideToZeroRendersBaseline() {
        openPanel()
        let picker = app.buttons["variant-picker-\(Self.EXPERIENCE_ID)-0"]
        XCTAssertTrue(picker.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Variant picker baseline option not found")
        picker.tap()
        closePanel()

        assertEntryVisible(Self.BASELINE_ENTRY_ID,
                           message: "Expected baseline after variant-0 override")
    }

    func testScenario6ResetAllRestoresVariantContent() {
        // Apply a variant override, then reset all.
        openPanel()
        app.buttons["variant-picker-\(Self.EXPERIENCE_ID)-0"].tap()
        let resetAll = app.buttons["reset-all-overrides"]
        XCTAssertTrue(resetAll.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Reset-all button not found")
        resetAll.tap()

        // Confirm the alert.
        let resetButton = app.alerts.buttons["Reset"]
        XCTAssertTrue(resetButton.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Reset confirmation button not found")
        resetButton.tap()
        closePanel()

        assertEntryVisible(Self.VARIANT_ENTRY_ID,
                           message: "Expected variant entry after reset-all")
    }

    // TODO: scenarios 1, 5, 7, 8 — see implementations/PREVIEW_PANEL_SCENARIOS.md.
    // - 1 (activate unqualified audience) requires a mock audience the identified user does not qualify for.
    // - 5 (reset single variant override) taps the per-item reset button in the Overrides section.
    // - 7 (override survives API refresh) drives preview-refresh-button between open/close.
    // - 8 (destroy/remount) uses app.terminate() + app.launch().
}
