import XCTest

/// Cross-platform preview-panel override scenarios (iOS side).
///
/// Scenario shape mirrors `implementations/PREVIEW_PANEL_SCENARIOS.md` and the
/// RN Detox suite `preview-panel-overrides.test.js`, but the iOS asserts the
/// **top-level** swap (1JAU → 2KIW via experience 1FHhEY) rather than the
/// nested swap (5i4S → 5a8O via experience 7Dyid). Two reasons:
///
/// 1. SwiftUI accessibility merges OptimizedEntry's outer
///    `accessibilityIdentifier("content-entry-<baseline>")` over its inner
///    content's `entry-text-<resolved>` identifier, so XCUI cannot query
///    `entry-text-<resolved-id>` at all on iOS. The resolved id only surfaces
///    in the wrapper element's `.label` (formatted by NestedEntryText as
///    `"<text> [Entry: <resolved-id>]"`).
/// 2. The same audience (4yIqY) gates both experiences, so the override
///    scenarios still exercise the audience/variant override surface; the
///    top-level swap is the externally observable signal of identified-state
///    propagation through the JS↔Swift bridge.
///
/// Cross-platform parity with Android/RN is documented in
/// `triage-preview-panel-overrides.md` as a known divergence until those
/// suites are migrated to the same assertion shape.
final class PreviewPanelOverridesTests: XCTestCase {
    let app = XCUIApplication()

    static let AUDIENCE_ID = "4yIqY7AWtzeehCZxtQSDB"
    // Parent experience that drives the top-level 1JAU → 2KIW swap.
    static let EXPERIENCE_ID = "1FHhEY0xkcCC9R5WCmnjRr"
    // Top-level baseline / variant pair (NOT the nested 5i4S/5a8O).
    static let BASELINE_ENTRY_ID = "1JAU028vQ7v6nB2swl3NBo"
    static let VARIANT_ENTRY_ID = "2KIWllNZJT205BwOSkMINg"

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

        // Wait for the wrapper to mount. We do not assert on its label yet —
        // OptimizedEntry's lock-on-first-non-nil-emission race ("Bug A") can
        // latch onto pre-identify personalizations on the first scenario, and
        // the lock only re-snapshots when the preview panel closes. Each
        // scenario opens/closes the panel and asserts on the post-action
        // label, which reflects the re-snapshotted state.
        let wrapper = app.otherElements["content-entry-\(Self.BASELINE_ENTRY_ID)"]
        XCTAssertTrue(wrapper.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "content-entry-\(Self.BASELINE_ENTRY_ID) wrapper missing — entries never mounted")
    }

    private func openPanel() {
        let fab = app.buttons["preview-panel-fab"]
        waitForElement(fab)
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

    /// Scrolls the preview-panel scroll view until the element identified by
    /// `id` is hittable, mirroring `scrollToElement`. The panel can grow
    /// taller than the screen once definitions, audiences, and the overrides
    /// section are all rendered, so audience-toggle buttons frequently start
    /// below the fold.
    private func scrollPanelToElement(_ identifier: String) {
        let target = app.buttons[identifier]
        if target.exists && target.isHittable { return }
        let panel = app.scrollViews["preview-panel-list"]
        if !panel.exists { return }
        for _ in 0..<10 {
            if target.exists && target.isHittable { return }
            panel.swipeUp()
        }
    }

    /// Variant pickers live inside the expanded `AudienceItem` body. Tap the
    /// audience header to expand it first, then scroll to and tap the index-0
    /// variant picker for the configured experience.
    private func expandAudienceAndTapVariantPicker0() {
        let expandId = "audience-expand-\(Self.AUDIENCE_ID)"
        scrollPanelToElement(expandId)
        let expand = app.buttons[expandId]
        XCTAssertTrue(expand.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "audience-expand-\(Self.AUDIENCE_ID) not found")
        expand.tap()

        let pickerId = "variant-picker-\(Self.EXPERIENCE_ID)-0"
        scrollPanelToElement(pickerId)
        let picker = app.buttons[pickerId]
        XCTAssertTrue(picker.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "variant-picker-\(Self.EXPERIENCE_ID)-0 not found after expanding audience")
        picker.tap()
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

    /// Poll the baseline wrapper's accessibility label until it contains the
    /// `[Entry: <expectedResolvedId>]` marker NestedEntryText writes for the
    /// resolved entry id. Dumps every visible content-entry-* label on
    /// failure so the cross-resolution snapshot is captured in the test log.
    private func assertResolvedEntry(_ expectedResolvedId: String, message: String) {
        let wrapper = app.otherElements["content-entry-\(Self.BASELINE_ENTRY_ID)"]
        XCTAssertTrue(wrapper.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "\(message): wrapper content-entry-\(Self.BASELINE_ENTRY_ID) missing")
        let token = "[Entry: \(expectedResolvedId)]"
        let deadline = Date().addingTimeInterval(ELEMENT_VISIBILITY_TIMEOUT)
        var lastLabel = ""
        while Date() < deadline {
            lastLabel = wrapper.label
            if lastLabel.contains(token) { return }
            Thread.sleep(forTimeInterval: 0.2)
        }
        let allContentEntryLabels = app.otherElements
            .matching(NSPredicate(format: "identifier BEGINSWITH 'content-entry-'"))
            .allElementsBoundByIndex
            .map { "\($0.identifier) -> \($0.label)" }
        XCTFail("""
            \(message)
            Wrapper content-entry-\(Self.BASELINE_ENTRY_ID) label: \"\(lastLabel)\"
            Expected to contain: \"\(token)\"
            All content-entry-* labels:
            \(allContentEntryLabels.joined(separator: "\n            "))
            """)
    }

    // MARK: - Scenarios

    func testScenario2DeactivatingQualifiedAudienceRendersBaseline() {
        openPanel()
        let toggleId = "audience-toggle-\(Self.AUDIENCE_ID)-off"
        scrollPanelToElement(toggleId)
        let toggle = app.buttons[toggleId]
        if !toggle.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT) {
            let panelTexts = app.staticTexts.allElementsBoundByIndex
                .map { $0.label }
                .filter { !$0.isEmpty }
            let panelButtons = app.buttons.allElementsBoundByIndex
                .map { "[\($0.identifier)] \($0.label)" }
                .filter { !$0.isEmpty }
            XCTFail("""
                Off toggle not found for audience (\(toggleId)).
                Visible static texts: \(panelTexts.prefix(60))
                Visible buttons: \(panelButtons.prefix(40))
                """)
            return
        }
        toggle.tap()
        closePanel()

        assertResolvedEntry(Self.BASELINE_ENTRY_ID,
                            message: "Expected baseline entry after deactivating audience")
    }

    func testScenario3ResettingAudienceOverrideRestoresVariant() {
        // Set up by first deactivating, then resetting to default.
        openPanel()
        let offId = "audience-toggle-\(Self.AUDIENCE_ID)-off"
        scrollPanelToElement(offId)
        app.buttons[offId].tap()
        app.buttons["audience-toggle-\(Self.AUDIENCE_ID)-default"].tap()
        closePanel()

        assertResolvedEntry(Self.VARIANT_ENTRY_ID,
                            message: "Expected variant entry after resetting audience override")
    }

    func testScenario4SettingVariantOverrideToZeroRendersBaseline() {
        openPanel()
        expandAudienceAndTapVariantPicker0()
        closePanel()

        assertResolvedEntry(Self.BASELINE_ENTRY_ID,
                            message: "Expected baseline after variant-0 override")
    }

    func testScenario6ResetAllRestoresVariantContent() {
        // Apply a variant override, then reset all.
        openPanel()
        expandAudienceAndTapVariantPicker0()
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

        assertResolvedEntry(Self.VARIANT_ENTRY_ID,
                            message: "Expected variant entry after reset-all")
    }

    // TODO: scenarios 1, 5, 7, 8 — see implementations/PREVIEW_PANEL_SCENARIOS.md.
    // - 1 (activate unqualified audience) requires a mock audience the identified user does not qualify for.
    // - 5 (reset single variant override) taps the per-item reset button in the Overrides section.
    // - 7 (override survives API refresh) drives preview-refresh-button between open/close.
    // - 8 (destroy/remount) uses app.terminate() + app.launch().
}
