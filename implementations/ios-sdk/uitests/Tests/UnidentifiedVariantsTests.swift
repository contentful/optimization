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

    // MARK: - Local helper

    /// Drives the unidentified -> identified round-trip the baseline tests rely
    /// on. The home-screen OptimizedEntry instances lock on their first resolved
    /// value, so a mid-test identify does not re-resolve them; only a relaunch
    /// makes the SDK re-run audience evaluation against the now-identified
    /// profile. That relaunch is exactly what turns a "baseline rendered"
    /// assertion from a no-op-tolerant check into proof the SDK genuinely
    /// evaluated the audience.
    private func identifyAndRelaunch() {
        let identifyButton = app.buttons["identify-button"]
        waitForElement(identifyButton)
        identifyButton.tap()
        waitForElement(app.buttons["reset-button"])
        app.terminate()
        app.launchArguments = []
        app.launch()
        _ = app.wait(for: .runningForeground, timeout: 10)
    }

    // MARK: - common variants

    func testDisplaysMergeTagContentWithResolvedValue() {
        let entry = app.otherElements["entry-text-1MwiFl4z7gkwqGYdvCmr8c"]
        waitForElement(entry)

        // Asserted against the element's label (not via a label subscript) because
        // the merge tag label exceeds XCUITest's 128-character identifier limit.
        let expectedLabel = "This is a merge tag content entry that displays the visitor's continent \"EU\" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]"
        XCTAssertEqual(entry.label, expectedLabel,
                       "Expected merge tag content with resolved continent value")
    }

    func testDisplaysVariantForVisitorsFromEurope() {
        let entry = app.otherElements["entry-text-4ib0hsHWoSOnCVdDkizE8d"]
        waitForElement(entry)

        let expectedLabel = "This is a variant content entry for visitors from Europe. [Entry: 4ib0hsHWoSOnCVdDkizE8d]"
        XCTAssertTrue(app.descendants(matching: .any)[expectedLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected Europe variant content")
    }

    func testDisplaysVariantForDesktopBrowserVisitors() {
        let entry = app.otherElements["entry-text-xFwgG3oNaOcjzWiGe4vXo"]
        waitForElement(entry)

        let expectedLabel = "This is a variant content entry for visitors using a desktop browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]"
        XCTAssertTrue(app.descendants(matching: .any)[expectedLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected desktop-browser variant content")
    }

    // MARK: - unidentified user variants

    func testDisplaysVariantForNewVisitors() {
        let entry = app.otherElements["entry-text-2Z2WLOx07InSewC3LUB3eX"]
        waitForElement(entry)

        let expectedLabel = "This is a variant content entry for new visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]"
        XCTAssertTrue(app.descendants(matching: .any)[expectedLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected new-visitor variant content")
    }

    func testDisplaysVariantBForABCExperiment() {
        let entry = app.otherElements["entry-text-5XHssysWUDECHzKLzoIsg1"]
        waitForElement(entry)

        let expectedLabel = "This is a variant content entry for an A/B/C experiment: B [Entry: 5XHssysWUDECHzKLzoIsg1]"
        XCTAssertTrue(app.descendants(matching: .any)[expectedLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected A/B/C experiment variant B")
    }

    func testDisplaysBaselineForVisitorsWithOrWithoutCustomEvent() {
        // Unidentified visitor: the custom-event audience is unmatched, so the
        // SDK must resolve this entry to its baseline rich-text body.
        let entry = app.otherElements["entry-text-6zqoWXyiSrf0ja7I2WGtYj"]
        waitForElement(entry)

        let baselineLabel = "This is a baseline content entry for all visitors with or without a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]"
        XCTAssertTrue(app.descendants(matching: .any)[baselineLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected baseline custom-event content")

        // The baseline label alone is satisfied even by a no-op SDK: the render
        // pipeline falls through to the untouched entry whenever no variant is
        // selected, so "baseline rendered" and "SDK did nothing" are
        // indistinguishable. Identifying must flip the SAME entry to its
        // custom-event variant, whose body text exists only in the variant and
        // is unreachable without real audience evaluation. Observing the swap
        // retroactively proves the unidentified baseline was a genuine SDK
        // decision rather than a pipeline artifact.
        identifyAndRelaunch()

        let variantLabel = "This is a variant content entry for visitors with a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]"
        XCTAssertTrue(app.descendants(matching: .any)[variantLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected custom-event variant after identify")

        // The baseline copy must be gone — the SDK replaced the rendered body.
        XCTAssertFalse(app.descendants(matching: .any)[baselineLabel].exists,
                       "Baseline custom-event content should be gone after identify")
    }

    func testDisplaysBaselineForAllIdentifiedOrUnidentifiedUsers() {
        // Unidentified visitor: this "all users" experience has no qualifying
        // variant for an anonymous profile, so it must render baseline.
        scrollToElement(testId: "entry-text-7pa5bOx8Z9NmNcr7mISvD",
                        scrollViewId: "main-scroll-view", app: app)
        let entry = app.otherElements["entry-text-7pa5bOx8Z9NmNcr7mISvD"]
        waitForElement(entry)

        let baselineLabel = "This is a baseline content entry for all identified or unidentified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]"
        XCTAssertTrue(app.descendants(matching: .any)[baselineLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected baseline all-users content")

        // "All users" is the most failure-open audience shape: a no-op SDK
        // satisfies the baseline assertion above purely by accident. Identifying
        // must flip this entry to its identified-users variant, whose body text
        // never appears in the baseline. The swap is the evidence that the
        // unidentified baseline was an evaluated outcome, not a fall-through.
        identifyAndRelaunch()

        let variantLabel = "This is a variant content entry for identified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]"
        XCTAssertTrue(app.descendants(matching: .any)[variantLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected identified-users variant after identify")

        XCTAssertFalse(app.descendants(matching: .any)[baselineLabel].exists,
                       "Baseline all-users content should be gone after identify")
    }

    // MARK: - nested optimization baselines

    func testDisplaysLevel0NestedBaselineForNewVisitors() {
        // New (unidentified) visitor: the level-0 nested experience is unmatched,
        // so NestedContentEntry keys its content off the baseline entry.
        scrollToElement(testId: "content-entry-1JAU028vQ7v6nB2swl3NBo",
                        scrollViewId: "main-scroll-view", app: app)
        waitForElement(app.otherElements["content-entry-1JAU028vQ7v6nB2swl3NBo"])

        let baselineLabel = "This is a level 0 nested baseline entry. [Entry: 1JAU028vQ7v6nB2swl3NBo]"
        XCTAssertTrue(app.descendants(matching: .any)[baselineLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 0 nested baseline content")

        // The nested content is keyed off resolvedEntry.sys.id, so the variant id
        // 2KIW... can only enter the tree if the SDK actually selects the level-0
        // variant. A no-op SDK leaves the baseline id in place forever.
        // Identifying must surface 2KIW... and retire 1JAU..., proving the
        // unidentified baseline render was a real resolution decision rather than
        // the entry passing through untouched.
        identifyAndRelaunch()

        let variantLabel = "This is a level 0 nested variant entry. [Entry: 2KIWllNZJT205BwOSkMINg]"
        scrollToElement(testId: variantLabel, scrollViewId: "main-scroll-view", app: app)
        XCTAssertTrue(app.descendants(matching: .any)[variantLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 0 nested variant after identify")

        XCTAssertFalse(app.descendants(matching: .any)[baselineLabel].exists,
                       "Level 0 nested baseline content should be gone after identify")
    }

    func testDisplaysLevel1NestedBaselineForNewVisitors() {
        // New (unidentified) visitor: the level-1 nested experience is unmatched,
        // so the resolved content is the baseline entry.
        scrollToElement(testId: "content-entry-5i4SdJXw9oDEY0vgO7CwF4",
                        scrollViewId: "main-scroll-view", app: app)
        waitForElement(app.otherElements["content-entry-5i4SdJXw9oDEY0vgO7CwF4"])

        let baselineLabel = "This is a level 1 nested baseline entry. [Entry: 5i4SdJXw9oDEY0vgO7CwF4]"
        XCTAssertTrue(app.descendants(matching: .any)[baselineLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 1 nested baseline content")

        // Identifying must re-resolve the level-1 experience to its variant
        // (5a8...), an id the host app never fetches directly — it only enters
        // the tree when the SDK selects it. The baseline id must disappear,
        // confirming the unidentified baseline was an evaluated outcome.
        identifyAndRelaunch()

        let variantLabel = "This is a level 1 nested variant entry. [Entry: 5a8ONfBdanJtlJ39WWnH1w]"
        scrollToElement(testId: variantLabel, scrollViewId: "main-scroll-view", app: app)
        XCTAssertTrue(app.descendants(matching: .any)[variantLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 1 nested variant after identify")

        XCTAssertFalse(app.descendants(matching: .any)[baselineLabel].exists,
                       "Level 1 nested baseline content should be gone after identify")
    }

    func testDisplaysLevel2NestedBaselineForNewVisitors() {
        // New (unidentified) visitor: the deepest nested experience is unmatched,
        // so the resolved content is the baseline entry.
        scrollToElement(testId: "content-entry-uaNY4YJ0HFPAX3gKXiRdX",
                        scrollViewId: "main-scroll-view", app: app)
        waitForElement(app.otherElements["content-entry-uaNY4YJ0HFPAX3gKXiRdX"])

        let baselineLabel = "This is a level 2 nested baseline entry. [Entry: uaNY4YJ0HFPAX3gKXiRdX]"
        XCTAssertTrue(app.descendants(matching: .any)[baselineLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 2 nested baseline content")

        // Identifying must re-resolve the level-2 experience to its variant
        // (4hDi...). Its appearance, paired with the baseline id disappearing,
        // proves the SDK descends and evaluates audiences at every nesting depth
        // rather than leaving deep entries untouched.
        identifyAndRelaunch()

        let variantLabel = "This is a level 2 nested variant entry. [Entry: 4hDiXxYEFrXHXcQgmdL9Uv]"
        scrollToElement(testId: variantLabel, scrollViewId: "main-scroll-view", app: app)
        XCTAssertTrue(app.descendants(matching: .any)[variantLabel].waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
                      "Expected level 2 nested variant after identify")

        XCTAssertFalse(app.descendants(matching: .any)[baselineLabel].exists,
                       "Level 2 nested baseline content should be gone after identify")
    }
}
