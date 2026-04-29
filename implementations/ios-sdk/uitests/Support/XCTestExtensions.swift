import XCTest

extension XCUIElement {
    func swipeUp(times: Int) {
        for _ in 0..<times { swipeUp() }
    }

    func swipeDown(times: Int) {
        for _ in 0..<times { swipeDown() }
    }
}

extension XCUIApplication {
    /// Relaunch the app with clean state.
    func relaunchClean() {
        terminate()
        launchArguments = ["--reset"]
        launch()
        _ = wait(for: .runningForeground, timeout: 10)
    }
}

/// Reset profile state: try in-app reset first, fall back to relaunch.
func clearProfileState(app: XCUIApplication, requireFreshAppInstance: Bool = false) {
    if requireFreshAppInstance {
        app.relaunchClean()
        waitForElement(app.buttons["identify-button"])
        return
    }

    // Try closing sub-screens first
    let closeLiveUpdates = app.buttons["close-live-updates-test-button"]
    if closeLiveUpdates.exists { closeLiveUpdates.tap() }

    let closeNavigation = app.buttons["close-navigation-test-button"]
    if closeNavigation.exists { closeNavigation.tap() }

    // Try in-app reset
    let resetButton = app.buttons["reset-button"]
    if resetButton.waitForExistence(timeout: 1.5) {
        resetButton.tap()
        waitForElement(app.buttons["identify-button"])
        return
    }

    if app.buttons["identify-button"].waitForExistence(timeout: 1.5) {
        return
    }

    // Fallback: relaunch
    app.relaunchClean()
    waitForElement(app.buttons["identify-button"])
}
