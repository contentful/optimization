import XCTest

final class PreviewPanelTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launch()
        clearProfileState(app: app)
        waitForElement(app.buttons["identify-button"])
    }

    // MARK: - Helpers

    private func openPreviewPanel() {
        let fab = app.buttons["preview-panel-fab"]
        waitForElement(fab)
        fab.tap()

        let title = app.staticTexts["Preview Panel"]
        XCTAssertTrue(title.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Preview Panel sheet did not appear")
    }

    /// Scrolls the preview panel list until the target element is visible.
    /// SwiftUI List renders as collectionView; plain ScrollView as scrollView.
    /// Prefer an identifier match; fall back to the first match of either type.
    private func scrollToPreviewElement(_ testId: String, maxSwipes: Int = 10) {
        let listById = app.collectionViews["preview-panel-list"]
        let scrollById = app.scrollViews["preview-panel-list"]
        let scrollContainer: XCUIElement
        if listById.exists {
            scrollContainer = listById
        } else if scrollById.exists {
            scrollContainer = scrollById
        } else if app.collectionViews.firstMatch.exists {
            scrollContainer = app.collectionViews.firstMatch
        } else {
            scrollContainer = app.scrollViews.firstMatch
        }
        for _ in 0..<maxSwipes {
            let target = findElement(testId, app: app)
            if target.exists && target.isHittable { return }
            scrollContainer.swipeUp()
        }
    }

    // MARK: - FAB Visibility

    func testFABIsVisible() {
        let fab = app.buttons["preview-panel-fab"]
        XCTAssertTrue(fab.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Preview panel FAB should be visible on main screen")
    }

    // MARK: - Profile Data Loading

    func testShowsProfileData() {
        openPreviewPanel()

        let noData = app.staticTexts["no-profile-data"]
        _ = noData.waitForExistence(timeout: 2.0)
        XCTAssertFalse(noData.exists,
                       "Should not show 'No profile data' after initialization")
    }

    func testShowsAllExpectedProfileKeys() {
        openPreviewPanel()

        let expectedKeys = ["audiences", "id", "location", "random", "session", "stableId", "traits"]
        for key in expectedKeys {
            scrollToPreviewElement("profile-item-\(key)")
            let item = findElement("profile-item-\(key)", app: app)
            XCTAssertTrue(item.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                          "Expected profile key '\(key)' not found in preview panel")
        }
    }

    func testShowsLocationData() {
        openPreviewPanel()

        scrollToPreviewElement("profile-item-location")
        let locationItem = findElement("profile-item-location", app: app)
        XCTAssertTrue(locationItem.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Profile location item not found")

        let label = extractText(locationItem)
        XCTAssertTrue(label.contains("Berlin") || label.contains("DE"),
                      "Expected location to contain Berlin or DE, got: \(label)")
    }

    // MARK: - Debug Section

    func testShowsConsentAccepted() {
        openPreviewPanel()

        scrollToPreviewElement("debug-consent")
        let consent = findElement("debug-consent", app: app)
        XCTAssertTrue(consent.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Debug consent element not found")
        let text = extractText(consent)
        XCTAssertTrue(text.contains("Accepted"),
                      "Expected consent to contain 'Accepted', got: \(text)")
    }

    func testShowsCanPersonalize() {
        openPreviewPanel()

        scrollToPreviewElement("debug-can-personalize")
        let canPersonalize = findElement("debug-can-personalize", app: app)
        XCTAssertTrue(canPersonalize.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Debug canPersonalize element not found")
        let text = extractText(canPersonalize)
        XCTAssertTrue(text.contains("Yes"),
                      "Expected canPersonalize to contain 'Yes', got: \(text)")
    }

    // MARK: - Refresh

    func testRefreshButtonWorks() {
        openPreviewPanel()

        scrollToPreviewElement("preview-refresh-button")
        let refreshButton = app.buttons["preview-refresh-button"]
        XCTAssertTrue(refreshButton.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Refresh button should exist")
        refreshButton.tap()

        let noData = app.staticTexts["no-profile-data"]
        _ = noData.waitForExistence(timeout: 2.0)
        XCTAssertFalse(noData.exists,
                       "Profile data should persist after refresh")
    }

    // MARK: - Profile After Identify

    func testProfileUpdatesAfterIdentify() {
        app.buttons["identify-button"].tap()
        waitForElement(app.buttons["reset-button"])

        openPreviewPanel()

        let noData = app.staticTexts["no-profile-data"]
        _ = noData.waitForExistence(timeout: 2.0)
        XCTAssertFalse(noData.exists,
                       "Should show profile data after identify")

        let idItem = findElement("profile-item-id", app: app)
        XCTAssertTrue(idItem.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Profile id should be present after identify")
    }
}
