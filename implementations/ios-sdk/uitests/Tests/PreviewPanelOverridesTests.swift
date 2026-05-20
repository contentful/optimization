import XCTest

/// 1:1 port of `preview-panel-overrides.test.js`.
///
/// The preview panel lets developers override audience membership and
/// experience variant selection at runtime so they can preview each variant
/// without changing the underlying visitor profile. This suite verifies that
/// an audience override can activate an unqualified audience or deactivate a
/// qualified one, that a per-experience variant index can be forced, that
/// overrides can be reset individually or in bulk, that audience overrides
/// survive an in-panel API refresh, and that a cold relaunch with cleared
/// storage wipes all overrides so the identified-visitor baseline renders
/// again.
///
/// Scenario names, accessibility identifiers, expected text, and ordering
/// mirror the RN Detox suite and the platform-agnostic
/// `preview-panel-overrides-pseudocode.md` contract. Two scenarios use an
/// iOS-correct mechanism for a step the contract describes generically:
///
/// - Scenario 5: the per-experience reset (`reset-variant-<exp>`) is a plain
///   row-action button on iOS (no confirmation alert), so iOS taps it
///   directly. RN wraps the same action in `Alert.alert`.
/// - Scenario 6: the reset-all control (`reset-all-overrides`) triggers a
///   native `.alert` on iOS, so iOS confirms via `app.alerts.buttons["Reset"]`
///   rather than the RN inline `reset-all-confirm` view.
final class PreviewPanelOverridesTests: XCTestCase {
    let app = XCUIApplication()

    static let AUDIENCE_ID = "4yIqY7AWtzeehCZxtQSDB"
    static let EXPERIENCE_ID = "7DyidZaPB7Jr1gWKjoogg0"
    static let VARIANT_ENTRY_ID = "5a8ONfBdanJtlJ39WWnH1w"
    static let BASELINE_ENTRY_ID = "5i4SdJXw9oDEY0vgO7CwF4"

    // Scenario 1 reuses the Mobile Browser audience, which the identified user
    // does NOT qualify for. The associated experience is the first entry in the
    // `nt_experiences` array of baseline xFwgG3oNaOcjzWiGe4vXo, so
    // `OptimizedEntryResolver` picks it deterministically once activated.
    // xFwgG3oNaOcjzWiGe4vXo renders through the demo app's top-level content
    // entry, whose identifier is keyed on the *original* entry id and stays
    // constant across resolution — so scenario 1 asserts on the resolved
    // entry's accessibility label (variant text + original baseline id).
    static let UNQUALIFIED_AUDIENCE_ID = "3MRuZPQ5EdwDqzUDRgOo7c"
    static let MOBILE_VARIANT_LABEL =
        "This is a variant content entry for visitors using a mobile browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]"

    override func setUp() {
        continueAfterFailure = false
        // Relaunch the app as a new instance with fresh storage so prior modal
        // and override state cannot leak in.
        app.relaunchClean()
        clearProfileState(app: app)
        identifyAndRelaunch()
    }

    // MARK: - Local helpers

    /// Identifies the visitor, then relaunches so the identified-visitor mock
    /// payload is re-fetched on a fresh app start.
    private func identifyAndRelaunch() {
        let identifyButton = app.buttons["identify-button"]
        waitForElement(identifyButton, timeout: ELEMENT_VISIBILITY_TIMEOUT)
        identifyButton.tap()
        waitForElement(app.buttons["reset-button"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // Terminate + relaunch so the identified-visitor mock payload is
        // re-fetched on a fresh start. Clear `--reset` first: `relaunchClean()`
        // (run in `setUp`) leaves it set, and relaunching with it here would
        // wipe the identified profile this helper just persisted.
        app.terminate()
        app.launchArguments = []
        app.launch()

        // Identified-visitor profile should render variant entries by default.
        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.VARIANT_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "entry-text-\(Self.VARIANT_ENTRY_ID) missing — identified-visitor variant never rendered")
    }

    /// Opens the preview panel modal from the floating action button.
    private func openPanel() {
        let fab = app.buttons["preview-panel-fab"]
        XCTAssertTrue(fab.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "preview-panel-fab did not appear")
        fab.tap()
        XCTAssertTrue(app.staticTexts["Preview Panel"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Preview Panel did not appear")
        waitForDefinitionsLoaded()
    }

    /// `loadDefinitions()` runs async after `openPanel()`. Until it finishes
    /// the audience section is empty (and the audience-toggle / variant-picker
    /// buttons are absent from the accessibility tree). Wait for the
    /// "Loading definitions..." status text to disappear before interacting.
    private func waitForDefinitionsLoaded() {
        let loadingText = app.staticTexts["Loading definitions..."]
        let deadline = Date().addingTimeInterval(EXTENDED_TIMEOUT)
        while Date() < deadline {
            if !loadingText.exists { return }
            Thread.sleep(forTimeInterval: 0.15)
        }
        XCTFail("Definitions did not finish loading within \(EXTENDED_TIMEOUT)s")
    }

    /// Scrolls the preview panel's internal scroll view until the requested
    /// element is visible and hittable. The panel is tall and the target
    /// audiences and controls typically sit below the fold.
    private func scrollPanelToId(_ identifier: String) {
        let panel = app.scrollViews["preview-panel-list"]
        if !panel.exists { return }
        for _ in 0..<10 {
            let target = findElement(identifier, app: app)
            if target.exists && target.isHittable { return }
            panel.swipeUp()
        }
    }

    /// Dismisses the preview panel modal. The panel is a SwiftUI sheet with no
    /// hardware back and no close button, so it is dismissed with a downward
    /// swipe from the top of the sheet.
    private func closePanel() {
        app.swipeDown()
    }

    // MARK: - Scenarios

    /// Scenario 1: turning on an audience that the identified visitor does not
    /// qualify for activates an experience whose variant content then renders
    /// on screen.
    func testScenario1ActivatingUnqualifiedAudienceRendersItsVariant() {
        openPanel()
        let toggleId = "audience-toggle-\(Self.UNQUALIFIED_AUDIENCE_ID)-on"
        scrollPanelToId(toggleId)
        app.buttons[toggleId].tap()
        closePanel()

        XCTAssertTrue(app.otherElements[Self.MOBILE_VARIANT_LABEL].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected mobile variant content after activating Mobile Browser audience")
    }

    /// Scenario 2: turning off an audience the identified visitor does qualify
    /// for forces the experience to fall back to its baseline entry.
    func testScenario2DeactivatingQualifiedAudienceRendersBaseline() {
        openPanel()
        let toggleId = "audience-toggle-\(Self.AUDIENCE_ID)-off"
        scrollPanelToId(toggleId)
        app.buttons[toggleId].tap()
        closePanel()

        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.BASELINE_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "Expected baseline entry after deactivating qualified audience")
    }

    /// Scenario 3: after deactivating a qualified audience, tapping the
    /// audience's default toggle removes the override and restores the original
    /// variant resolution.
    func testScenario3ResettingAudienceOverrideRestoresVariant() {
        openPanel()
        let offId = "audience-toggle-\(Self.AUDIENCE_ID)-off"
        scrollPanelToId(offId)
        app.buttons[offId].tap()
        app.buttons["audience-toggle-\(Self.AUDIENCE_ID)-default"].tap()
        closePanel()

        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.VARIANT_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "Expected variant entry after resetting audience override")
    }

    /// Scenario 4: explicitly picking the index-0 (baseline) variant for an
    /// experience forces that experience to render its baseline entry, even
    /// when the visitor qualifies for a non-baseline variant.
    func testScenario4SettingVariantOverrideToZeroRendersBaseline() {
        openPanel()
        // The audience must be expanded for its experience variant picker to
        // mount; scrolling the off toggle into view also brings the audience
        // row that owns the experience into view.
        scrollPanelToId("audience-toggle-\(Self.AUDIENCE_ID)-off")
        // Tap the audience header row to expand experiences.
        app.staticTexts["Identified Users"].tap()
        let pickerId = "variant-picker-\(Self.EXPERIENCE_ID)-0"
        scrollPanelToId(pickerId)
        app.buttons[pickerId].tap()
        closePanel()

        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.BASELINE_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "Expected baseline entry after setting variant override to 0")
    }

    /// Scenario 5: after forcing a variant override, tapping the per-experience
    /// reset control removes only that override and restores the original
    /// variant resolution. The iOS panel applies the reset synchronously — the
    /// `reset-variant-<exp>` control is a plain row-action button with no
    /// confirmation alert (unlike RN's `Alert.alert`).
    func testScenario5ResettingSingleVariantOverrideRestoresVariant() {
        // Drive scenario 4 first so a variant override exists in the Overrides
        // section.
        openPanel()
        scrollPanelToId("audience-toggle-\(Self.AUDIENCE_ID)-off")
        app.staticTexts["Identified Users"].tap()
        let pickerId = "variant-picker-\(Self.EXPERIENCE_ID)-0"
        scrollPanelToId(pickerId)
        app.buttons[pickerId].tap()

        // Tap the per-experience reset.
        let resetId = "reset-variant-\(Self.EXPERIENCE_ID)"
        scrollPanelToId(resetId)
        app.buttons[resetId].tap()
        closePanel()

        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.VARIANT_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "Expected variant entry after resetting single variant override")
    }

    /// Scenario 6: after forcing a variant override, tapping the panel's
    /// reset-all control and confirming clears every override and restores the
    /// original variant resolution. On iOS the reset-all confirmation is a
    /// native `.alert`, so confirmation taps `app.alerts.buttons["Reset"]`.
    func testScenario6ResetAllRestoresVariantContent() {
        openPanel()
        scrollPanelToId("audience-toggle-\(Self.AUDIENCE_ID)-off")
        app.staticTexts["Identified Users"].tap()
        let pickerId = "variant-picker-\(Self.EXPERIENCE_ID)-0"
        scrollPanelToId(pickerId)
        app.buttons[pickerId].tap()

        scrollPanelToId("reset-all-overrides")
        app.buttons["reset-all-overrides"].tap()

        // Confirm the native alert.
        let resetButton = app.alerts.buttons["Reset"]
        XCTAssertTrue(resetButton.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Reset confirmation button not found")
        resetButton.tap()
        closePanel()

        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.VARIANT_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "Expected variant entry after reset-all")
    }

    /// Scenario 7: deactivating an audience and then triggering the in-panel
    /// refresh (which re-hits the experience API) keeps the audience override
    /// in place so the experience still resolves to its baseline.
    func testScenario7OverrideSurvivesAPIRefresh() {
        openPanel()
        let offId = "audience-toggle-\(Self.AUDIENCE_ID)-off"
        scrollPanelToId(offId)
        app.buttons[offId].tap()

        let refreshId = "preview-refresh-button"
        scrollPanelToId(refreshId)
        app.buttons[refreshId].tap()
        closePanel()

        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.BASELINE_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "Expected baseline still rendering after API refresh")
    }

    /// Scenario 8: a cold relaunch with cleared storage discards all overrides
    /// — the variant renders again and the overrides section reports that none
    /// remain.
    func testScenario8DestroyRemountClearsOverrides() {
        openPanel()
        let offId = "audience-toggle-\(Self.AUDIENCE_ID)-off"
        scrollPanelToId(offId)
        app.buttons[offId].tap()
        closePanel()

        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.BASELINE_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "Expected baseline after deactivating audience (pre-relaunch)")

        // Cold relaunch with fresh storage, then re-identify and rehydrate.
        app.relaunchClean()
        identifyAndRelaunch()

        // Override must be gone — variant renders again.
        XCTAssertTrue(
            app.otherElements["entry-text-\(Self.VARIANT_ENTRY_ID)"].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
            "Expected variant entry after destroy/remount cleared overrides")

        // The Overrides section should show its empty state. The empty-state
        // text sits below the fold, so scrolling the reset-all control into
        // view also pulls the Overrides section into the viewport.
        openPanel()
        scrollPanelToId("reset-all-overrides")
        XCTAssertTrue(app.staticTexts["No active overrides"].exists,
                      "Expected 'No active overrides' empty-state text in Overrides section")
        closePanel()
    }
}
