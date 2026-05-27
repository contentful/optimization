import XCTest

/// Tests offline behavior using runtime network simulation.
///
/// The RN/Detox suite toggles real network state with adb airplane mode. XCUITest
/// cannot toggle network at runtime, so the app exposes test-only `Go Offline` /
/// `Go Online` controls (gated behind `--enable-network-controls`) that call
/// `client.setOnline(false/true)` on the live process. Toggling online state on a
/// running app — rather than relaunching — keeps the in-memory Experience queue
/// intact across the offline/online transition, exactly as a real airplane-mode
/// toggle would, so a queued offline identify can genuinely flush on reconnect.
///
/// Each test preserves the hardened pseudocode contract: identify across an
/// offline/online cycle, relaunch, then gate on the SDK resolving the IDENTIFIED
/// nested variant entry — a no-op SDK cannot pass.
final class OfflineBehaviorTests: XCTestCase {
    let app = XCUIApplication()

    // Time allowed after reconnecting for the SDK online signal to flip and the
    // resulting Experience API queue flush to land before the app is terminated.
    let QUEUE_FLUSH_GRACE_MS = 10000

    // Time allowed after an online identify for the Experience upsert round-trip
    // to complete before the app is terminated.
    let IDENTIFY_SETTLE_MS = 3000

    // Timeout for the post-relaunch variant assertions, generous enough for a
    // cold start to boot, fetch entries, and run resolution.
    let POST_RELAUNCH_TIMEOUT: TimeInterval = 30.0

    // Nested level-0 entry id that only appears once the SDK resolves the
    // identified profile.
    let NESTED_VARIANT_TEST_ID = "entry-text-2KIWllNZJT205BwOSkMINg"

    // Nested level-0 entry id that only appears for an anonymous profile.
    let NESTED_BASELINE_TEST_ID = "entry-text-1JAU028vQ7v6nB2swl3NBo"

    override func setUp() {
        continueAfterFailure = false
        // Launch from clean storage (`--reset`) with the test-only network
        // controls enabled. `--reset` guarantees a true anonymous starting
        // profile; each test identifies and leaves the app identified, so the
        // clean start matters for the next test's baseline resolution.
        app.launchArguments = ["--reset", "--enable-network-controls"]
        app.launch()
        waitForElement(app.buttons["identify-button"], timeout: ELEMENT_VISIBILITY_TIMEOUT)
    }

    /// Read the `events-count` element text and parse the integer event count.
    private func getEventsCount() -> Int {
        return parseEventsCount(getElementTextById("events-count", app: app))
    }

    /// Take the live app offline by tapping the test-only `Go Offline` control.
    /// The process stays alive, so the in-memory Experience queue survives.
    private func goOffline() {
        let button = app.buttons["simulate-offline-button"]
        waitForElement(button, timeout: ELEMENT_VISIBILITY_TIMEOUT)
        button.tap()
    }

    /// Bring the live app back online by tapping the test-only `Go Online`
    /// control, which flips the SDK online signal and flushes queued events.
    private func goOnline() {
        let button = app.buttons["simulate-online-button"]
        waitForElement(button, timeout: ELEMENT_VISIBILITY_TIMEOUT)
        button.tap()
    }

    func testContinuesToTrackEventsWhileOffline() {
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)
        waitForEventsCountAtLeast(1, app: app)

        // Go offline.
        goOffline()
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let eventsBeforeIdentify = getEventsCount()

        // Trigger an identify that generates an Experience API event.
        app.buttons["identify-button"].tap()

        // The SDK must still emit the identify event to its in-process
        // eventStream while offline — the analytics counter advances offline.
        _ = waitForElementText("events-count", app: app, timeout: ELEMENT_VISIBILITY_TIMEOUT) { text in
            parseEventsCount(text) >= eventsBeforeIdentify + 1
        }

        // Counter emission alone is not proof the event was retained. Reconnect
        // so the Experience queue flushes, give the flush round-trip time to
        // land, then relaunch. The identified-only nested variant id can only
        // resolve if the offline identify was genuinely queued and delivered.
        goOnline()
        Thread.sleep(forTimeInterval: Double(QUEUE_FLUSH_GRACE_MS) / 1000.0)
        app.terminate()
        app.launchArguments = []
        app.launch()

        waitForElement(findElement(NESTED_VARIANT_TEST_ID, app: app), timeout: POST_RELAUNCH_TIMEOUT)
        XCTAssertFalse(findElement(NESTED_BASELINE_TEST_ID, app: app).exists,
                       "Baseline nested entry \(NESTED_BASELINE_TEST_ID) should not exist after identified flush")
    }

    func testRecoverGracefullyWhenNetworkRestored() {
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // Take the SDK through an offline -> online transition.
        goOffline()
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)
        Thread.sleep(forTimeInterval: 1.0)
        goOnline()

        // Real proof of recovery is that the SDK can still complete an
        // end-to-end identify pipeline after the blip. The identify runs while
        // online, so let the connectivity transition settle first.
        Thread.sleep(forTimeInterval: Double(IDENTIFY_SETTLE_MS) / 1000.0)
        app.buttons["identify-button"].tap()
        waitForElement(app.buttons["reset-button"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // Give the Experience upsert round-trip time to land, then relaunch to
        // observe the resolved profile.
        Thread.sleep(forTimeInterval: Double(IDENTIFY_SETTLE_MS) / 1000.0)
        app.terminate()
        app.launchArguments = []
        app.launch()

        waitForElement(findElement(NESTED_VARIANT_TEST_ID, app: app), timeout: POST_RELAUNCH_TIMEOUT)
        XCTAssertFalse(findElement(NESTED_BASELINE_TEST_ID, app: app).exists,
                       "Baseline nested entry \(NESTED_BASELINE_TEST_ID) should not exist after recovery identify")
    }

    func testHandleRapidNetworkStateChanges() {
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        // Rapidly toggle network state, ending online.
        goOffline()
        Thread.sleep(forTimeInterval: 0.5)
        goOnline()
        Thread.sleep(forTimeInterval: 0.5)
        goOffline()
        Thread.sleep(forTimeInterval: 0.5)
        goOnline()

        // Prove the SDK is still fully operational after the churn: a complete
        // identify pipeline must still resolve the identified-only nested
        // variant after relaunch. A wedged SDK would resolve the baseline.
        Thread.sleep(forTimeInterval: Double(IDENTIFY_SETTLE_MS) / 1000.0)
        app.buttons["identify-button"].tap()
        waitForElement(app.buttons["reset-button"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        Thread.sleep(forTimeInterval: Double(IDENTIFY_SETTLE_MS) / 1000.0)
        app.terminate()
        app.launchArguments = []
        app.launch()

        waitForElement(findElement(NESTED_VARIANT_TEST_ID, app: app), timeout: POST_RELAUNCH_TIMEOUT)
        XCTAssertFalse(findElement(NESTED_BASELINE_TEST_ID, app: app).exists,
                       "Baseline nested entry \(NESTED_BASELINE_TEST_ID) should not exist after rapid toggles")
    }

    func testQueueEventsOfflineAndFlushWhenOnline() {
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)
        waitForEventsCountAtLeast(1, app: app)

        // Go offline.
        goOffline()
        waitForElement(app.staticTexts["Analytics Events"], timeout: ELEMENT_VISIBILITY_TIMEOUT)

        let eventsBeforeIdentify = getEventsCount()

        // Trigger identify, which creates an Experience API event.
        app.buttons["identify-button"].tap()

        // Verify event counter increased while still offline.
        _ = waitForElementText("events-count", app: app, timeout: ELEMENT_VISIBILITY_TIMEOUT) { text in
            parseEventsCount(text) >= eventsBeforeIdentify + 1
        }

        // Go back online so the offline Experience queue flushes, and give the
        // flush round-trip time to reach the server before the app is killed.
        goOnline()
        Thread.sleep(forTimeInterval: Double(QUEUE_FLUSH_GRACE_MS) / 1000.0)

        // Relaunch and verify the queued-then-flushed identify took effect end
        // to end: the identified-only nested variant resolves and `reset-button`
        // renders only for a rehydrated identified profile.
        app.terminate()
        app.launchArguments = []
        app.launch()

        waitForElement(findElement(NESTED_VARIANT_TEST_ID, app: app), timeout: POST_RELAUNCH_TIMEOUT)
        XCTAssertFalse(findElement(NESTED_BASELINE_TEST_ID, app: app).exists,
                       "Baseline nested entry \(NESTED_BASELINE_TEST_ID) should not exist after queued flush")
        waitForElement(app.buttons["reset-button"], timeout: POST_RELAUNCH_TIMEOUT)
    }
}
