package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.PerTestRule
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Assert
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PreviewPanelOverridesTests {
    @get:Rule
    val rule: TestRule = PerTestRule.create()

    private lateinit var device: UiDevice

    companion object {
        // Audience + experience these scenarios drive. Both IDs match the
        // iOS suite so cross-platform fixtures and failures stay aligned.
        const val AUDIENCE_ID = "4yIqY7AWtzeehCZxtQSDB"
        const val EXPERIENCE_ID = "7DyidZaPB7Jr1gWKjoogg0"
        // The resolved entries the experience can render. Identified-visitor
        // mock data renders VARIANT_ENTRY_ID by default; overriding to
        // variant-0 / deactivating the audience renders BASELINE_ENTRY_ID.
        const val VARIANT_ENTRY_ID = "5a8ONfBdanJtlJ39WWnH1w"
        const val BASELINE_ENTRY_ID = "5i4SdJXw9oDEY0vgO7CwF4"
        // Scenario 1: the Mobile Browser audience the identified user does NOT
        // qualify for. Activating it surfaces the variant content for the
        // xFwgG3oNaOcjzWiGe4vXo entry.
        const val UNQUALIFIED_AUDIENCE_ID = "3MRuZPQ5EdwDqzUDRgOo7c"
        const val MOBILE_VARIANT_LABEL =
            "This is a variant content entry for visitors using a mobile browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]"
    }

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        // Relaunch the app as a new instance with fresh storage so prior modal
        // and override state cannot leak in.
        AppLauncher.relaunchClean(device)
        clearProfileState(device)
        identifyAndRelaunch()
    }

    // MARK: - Local helpers

    /**
     * Identifies the visitor, then relaunches so the identified-visitor mock
     * payload is re-fetched on a fresh app start.
     *
     * Mirrors the pseudocode `identifyAndRelaunch` helper and the iOS
     * `identifyAndRelaunch()` private function exactly.
     */
    private fun identifyAndRelaunch() {
        TestHelpers.waitAndTap(device, By.res("identify-button"))
        TestHelpers.waitForElement(device, By.res("reset-button"), TestHelpers.EXTENDED_TIMEOUT)
        // Terminate + relaunch so the identified-visitor mock payload is
        // re-fetched on a fresh start. The `reset` extra is NOT set here so
        // the identified profile just persisted is preserved.
        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)
        // Identified-visitor profile should render the variant entry by default.
        // Asserting this here turns a previously-silent setup misalignment into
        // a clear precondition failure if the mock data ever drifts.
        assertEntryVisible(VARIANT_ENTRY_ID, "entry-text-$VARIANT_ENTRY_ID missing — identified-visitor variant never rendered")
    }

    private fun openPanel() {
        TestHelpers.waitAndTap(device, By.desc("preview-panel-fab"))
        TestHelpers.waitForElement(device, By.text("Preview Panel"))
        Thread.sleep(2000)
    }

    private fun closePanel() {
        device.pressBack()
        Thread.sleep(500)
    }

    private fun scrollPanelToElement(desc: String) {
        // Compose's verticalScroll virtualizes its accessibility tree — items
        // outside the viewport are NOT in the tree at all (findObject returns
        // null on off-screen rows). So the loop has to physically scroll the
        // panel until the target row materializes.
        //
        // Use UiObject2.scroll(Direction.DOWN, ...) on the scrollable node
        // directly rather than device.swipe with raw coordinates. A coordinate
        // swipe can be interpreted by the parent ModalBottomSheet as a drag-
        // to-dismiss gesture once the inner scroll exhausts — observed via
        // diagnostic logging: the sheet disappeared mid-scroll and every
        // subsequent findObject returned null because the panel was gone, not
        // because the target was off-screen. A semantic scroll on the inner
        // scrollable node routes the gesture to the inner scroll only and
        // returns false when the scroll cannot proceed further (so we don't
        // spam-scroll past the content).
        fun panel(): androidx.test.uiautomator.UiObject2? = try {
            device.findObject(By.desc("preview-panel-list"))
        } catch (_: Exception) { null }

        fun tryFind(): Boolean {
            device.waitForIdle(2_000L)
            var elBounds: android.graphics.Rect? = null
            repeat(3) {
                val el = try {
                    device.findObject(By.descContains(desc))
                } catch (_: androidx.test.uiautomator.StaleObjectException) {
                    null
                } ?: return@repeat
                val b = try { el.visibleBounds } catch (_: Exception) { null }
                if (b != null) {
                    elBounds = b
                    return@repeat
                }
                Thread.sleep(200)
            }
            val panelBounds = panel()?.let {
                try { it.visibleBounds } catch (_: Exception) { null }
            } ?: return false
            val b = elBounds ?: return false
            return b.height() >= 5 && b.bottom > panelBounds.top && b.top < panelBounds.bottom
        }

        fun scrollOnce(direction: androidx.test.uiautomator.Direction): Boolean {
            val p = panel() ?: return false
            try { p.setGestureMargin((p.visibleBounds.width() * 0.1).toInt()) } catch (_: Exception) {}
            return try { p.scroll(direction, 0.4f) } catch (_: Exception) { false }
        }

        // Phase 1: scroll DOWN searching for the element. The previous element
        // (the test step's first scrollPanelToElement call OR an interleaved
        // tap that triggered a scroll-to-keep-visible) may have left the
        // panel scrolled, so iter 0 might already be near the bottom — but
        // most targets sit above where we currently are. We still try DOWN
        // first because the panel resets to scroll-position-0 on open and the
        // first call from a fresh openPanel always needs to head down.
        repeat(20) {
            if (tryFind()) return
            if (!scrollOnce(androidx.test.uiautomator.Direction.DOWN)) return@repeat
            Thread.sleep(600)
        }
        // Phase 2: scroll UP searching for the element. This recovers when
        // the panel was already past the target on entry. Safe to use bidir
        // here because UiObject2.scroll dispatches a semantic scroll on the
        // inner scrollable Compose node — it does NOT bubble up to the
        // ModalBottomSheet container as a drag-to-dismiss the way a raw
        // device.swipe would once the inner scroll exhausts.
        repeat(25) {
            if (tryFind()) return
            if (!scrollOnce(androidx.test.uiautomator.Direction.UP)) return
            Thread.sleep(600)
        }
    }

    private fun waitForDefinitionsLoaded() {
        val deadline = System.currentTimeMillis() + TestHelpers.EXTENDED_TIMEOUT
        while (System.currentTimeMillis() < deadline) {
            if (device.findObject(By.text("Loading definitions...")) == null) return
            Thread.sleep(150)
        }
    }

    private fun tapVariantPicker(variantDesc: String): Boolean {
        val picker = device.findObject(By.descContains(variantDesc)) ?: return false
        val panel = device.findObject(By.desc("preview-panel-list")) ?: return false
        val panelBounds = panel.visibleBounds
        val pickerBounds = picker.visibleBounds

        if (pickerBounds.height() < 5 ||
            pickerBounds.top < panelBounds.top ||
            pickerBounds.bottom > panelBounds.bottom
        ) {
            return false
        }

        device.click(pickerBounds.centerX(), pickerBounds.centerY())
        Thread.sleep(500)
        return true
    }

    private fun expandTargetAudienceAndTapVariant() {
        waitForDefinitionsLoaded()

        val expandDesc = "audience-expand-$AUDIENCE_ID"
        val variantDesc = "variant-picker-$EXPERIENCE_ID-0"

        scrollPanelToElement(expandDesc)
        // audience-expand is a binary toggle, so single-click only. The default
        // tapElement double-click (accessibility-click + coordinate click 100ms
        // later) would expand then immediately re-collapse it. audience-toggle
        // survives the double-click because it is a set-state radio.
        val expandEl = TestHelpers.waitForElement(
            device, By.descContains(expandDesc), TestHelpers.EXTENDED_TIMEOUT,
        )
        TestHelpers.tapElement(device, expandEl, singleClick = true)
        Thread.sleep(1000)

        scrollPanelToElement(variantDesc)

        val deadline = System.currentTimeMillis() + TestHelpers.EXTENDED_TIMEOUT
        while (System.currentTimeMillis() < deadline) {
            if (tapVariantPicker(variantDesc)) return
            scrollPanelToElement(variantDesc)
            Thread.sleep(500)
        }

        Assert.fail("$variantDesc not found after expanding audience")
    }

    /**
     * Mirrors iOS `assertEntryVisible`: assert that the entry with the given
     * id has its `entry-text-<id>` testTag rendered in main-scroll-view.
     *
     * This is the strong form of the previous `assertEntryContentContains`
     * fuzzy-substring check — it fails when the *wrong* entry was resolved
     * rather than just when some accidental substring is missing.
     */
    private fun assertEntryVisible(entryId: String, message: String) {
        val tag = "entry-text-$entryId"
        // Bring the entry into view if it's offscreen. Swallow the scroll
        // exception so the assertion below produces the clearer failure.
        try {
            UiScrollable(UiSelector().resourceId("main-scroll-view"))
                .apply { setMaxSearchSwipes(10) }
                .scrollIntoView(UiSelector().resourceId(tag))
        } catch (_: Exception) {
        }
        val deadline = System.currentTimeMillis() + TestHelpers.EXTENDED_TIMEOUT
        while (System.currentTimeMillis() < deadline) {
            if (device.findObject(By.res(tag)) != null) return
            Thread.sleep(150)
        }
        val visibleEntryTags = device.findObjects(By.res(java.util.regex.Pattern.compile("entry-text-.*")))
            .mapNotNull { it.resourceName }
        Assert.fail("$message (entry-text-$entryId not found; visible entry-text-* tags: $visibleEntryTags)")
    }

    // MARK: - Scenarios

    /**
     * Scenario 1: turning on an audience that the identified visitor does not
     * qualify for activates an experience whose variant content then renders
     * on screen.
     */
    @Test
    fun testScenario1ActivatingUnqualifiedAudienceRendersItsVariant() {
        openPanel()
        waitForDefinitionsLoaded()
        scrollPanelToElement("audience-toggle-$UNQUALIFIED_AUDIENCE_ID-on")
        // singleClick: the toggle is a set-state radio; singleClick avoids the
        // coordinate-click fallback landing on a different row after re-sort.
        TestHelpers.waitAndTap(device, By.desc("audience-toggle-$UNQUALIFIED_AUDIENCE_ID-on"), singleClick = true)
        closePanel()

        // The variant content for the Mobile Browser experience renders using
        // the *original* baseline entry id (xFwgG3oNaOcjzWiGe4vXo) in the label.
        val deadline = System.currentTimeMillis() + TestHelpers.EXTENDED_TIMEOUT
        while (System.currentTimeMillis() < deadline) {
            if (device.findObject(By.desc(MOBILE_VARIANT_LABEL)) != null) return
            Thread.sleep(150)
        }
        Assert.fail(
            "Expected mobile variant content after activating Mobile Browser audience " +
                "(label: $MOBILE_VARIANT_LABEL)",
        )
    }

    /**
     * Scenario 2: turning off an audience the identified visitor does qualify
     * for forces the experience to fall back to its baseline entry.
     */
    @Test
    fun testScenario2DeactivatingQualifiedAudienceRendersBaseline() {
        openPanel()
        waitForDefinitionsLoaded()
        scrollPanelToElement("audience-toggle-$AUDIENCE_ID-off")
        // singleClick: the audience-toggle is a set-state radio; the default
        // tapElement double-click (accessibility-click + coordinate-click at
        // +100ms) would re-fire the same segment. The panel's sort is now
        // name-only and stable across override flips, so the row stays in
        // place regardless.
        TestHelpers.waitAndTap(device, By.desc("audience-toggle-$AUDIENCE_ID-off"), singleClick = true)
        closePanel()

        assertEntryVisible(BASELINE_ENTRY_ID, "Expected baseline entry after deactivating audience")
    }

    /**
     * Scenario 3: after deactivating a qualified audience, tapping the
     * audience's default toggle removes the override and restores the original
     * variant resolution.
     */
    @Test
    fun testScenario3ResettingAudienceOverrideRestoresVariant() {
        openPanel()
        waitForDefinitionsLoaded()
        scrollPanelToElement("audience-toggle-$AUDIENCE_ID-off")
        TestHelpers.waitAndTap(device, By.desc("audience-toggle-$AUDIENCE_ID-off"), singleClick = true)
        TestHelpers.waitAndTap(device, By.desc("audience-toggle-$AUDIENCE_ID-default"), singleClick = true)
        closePanel()

        assertEntryVisible(VARIANT_ENTRY_ID, "Expected variant entry after resetting audience override")
    }

    /**
     * Scenario 4: explicitly picking the index-0 (baseline) variant for an
     * experience forces that experience to render its baseline entry, even
     * when the visitor qualifies for a non-baseline variant.
     */
    @Test
    fun testScenario4SettingVariantOverrideToZeroRendersBaseline() {
        openPanel()
        expandTargetAudienceAndTapVariant()
        closePanel()

        assertEntryVisible(BASELINE_ENTRY_ID, "Expected baseline after variant-0 override")
    }

    /**
     * Scenario 5: after forcing a variant override, tapping the per-experience
     * reset control removes only that override and restores the original
     * variant resolution. On Android the `reset-variant-<exp>` button invokes
     * the reset directly with no confirmation dialog (same as iOS).
     */
    @Test
    fun testScenario5ResettingSingleVariantOverrideRestoresVariant() {
        openPanel()
        expandTargetAudienceAndTapVariant()

        val resetDesc = "reset-variant-$EXPERIENCE_ID"
        scrollPanelToElement(resetDesc)
        TestHelpers.waitAndTap(device, By.desc(resetDesc))
        closePanel()

        assertEntryVisible(VARIANT_ENTRY_ID, "Expected variant entry after resetting single variant override")
    }

    /**
     * Scenario 6: after forcing a variant override, tapping the panel's
     * reset-all control and confirming via the native AlertDialog clears every
     * override and restores the original variant resolution. On Android the
     * confirmation is a Material3 AlertDialog — confirmed by tapping the
     * button with text "Reset" (no inline `reset-all-confirm` view as in RN).
     */
    @Test
    fun testScenario6ResetAllRestoresVariantContent() {
        openPanel()
        expandTargetAudienceAndTapVariant()

        scrollPanelToElement("reset-all-overrides")
        TestHelpers.waitAndTap(device, By.desc("reset-all-overrides"))
        // Confirm the native AlertDialog. Use the dialog confirm button's
        // testTag rather than By.text("Reset") because the panel beneath the
        // dialog also has per-row "Reset" labels (reset-variant-* /
        // reset-audience-*) and a text-based selector would non-
        // deterministically match one of those first.
        TestHelpers.waitAndTap(device, By.desc("reset-all-confirm"))
        // Wait until the dialog body text is gone before pressing back to
        // close the panel. Without this gate, closePanel's pressBack can race
        // the dialog's dismissal: the back can be consumed by the still-
        // attached dialog window instead of the bottom sheet, leaving the
        // panel open when assertEntryVisible runs and rendering the variant
        // entry unreachable (the modal sheet excludes the activity's entries
        // from the accessibility tree). The dialog title and the panel footer
        // share the "Reset to Actual State" text, so we key off the dialog
        // body copy — which only exists while the dialog is open.
        val dialogBodyPrefix = "This will clear all manual overrides"
        val dialogGoneDeadline = System.currentTimeMillis() + TestHelpers.ELEMENT_TIMEOUT
        while (System.currentTimeMillis() < dialogGoneDeadline) {
            if (device.findObject(By.textStartsWith(dialogBodyPrefix)) == null) break
            Thread.sleep(100)
        }

        closePanel()

        assertEntryVisible(VARIANT_ENTRY_ID, "Expected variant entry after reset-all")
    }

    /**
     * Scenario 7: deactivating an audience and then triggering the in-panel
     * refresh (which re-hits the experience API) keeps the audience override
     * in place so the experience still resolves to its baseline.
     */
    @Test
    fun testScenario7OverrideSurvivesAPIRefresh() {
        openPanel()
        waitForDefinitionsLoaded()
        scrollPanelToElement("audience-toggle-$AUDIENCE_ID-off")
        TestHelpers.waitAndTap(device, By.desc("audience-toggle-$AUDIENCE_ID-off"), singleClick = true)

        scrollPanelToElement("preview-refresh-button")
        TestHelpers.waitAndTap(device, By.desc("preview-refresh-button"))
        closePanel()

        assertEntryVisible(BASELINE_ENTRY_ID, "Expected baseline still rendering after API refresh")
    }

}
