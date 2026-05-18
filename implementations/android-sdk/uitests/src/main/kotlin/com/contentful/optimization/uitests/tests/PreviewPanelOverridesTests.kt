package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import androidx.test.uiautomator.Until
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PreviewPanelOverridesTests {
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
    }

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        AppLauncher.launchApp(device)
        clearProfileState(device)
        identifyAndWaitForVariant()
    }

    private fun identifyAndWaitForVariant() {
        TestHelpers.waitAndTap(device, By.res("identify-button"))
        TestHelpers.waitForElement(device, By.res("reset-button"), TestHelpers.EXTENDED_TIMEOUT)
        // Identified-visitor profile should render the variant entry by default.
        // Asserting this here turns a previously-silent setup misalignment into
        // a clear precondition failure if the mock data ever drifts.
        assertEntryVisible(VARIANT_ENTRY_ID, "Expected variant entry to render after identify")
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
        val panel = device.findObject(By.desc("preview-panel-list"))
        val bounds = panel?.visibleBounds

        val centerX = bounds?.centerX() ?: (device.displayWidth / 2)
        val startY = bounds?.let { it.top + (it.height() * 3 / 4) } ?: (device.displayHeight * 3 / 4)
        val endY = bounds?.let { it.top + (it.height() / 4) } ?: (device.displayHeight / 4)

        for (i in 0 until 8) {
            // Wait for any in-flight scroll/animation to settle. Compose batches
            // accessibility-tree updates during a fling and the tree we query
            // here would otherwise be stale.
            device.waitForIdle(1500L)
            val el = device.wait(Until.hasObject(By.descContains(desc)), 500L)?.let {
                device.findObject(By.descContains(desc))
            }
            if (el != null) {
                val elBounds = el.visibleBounds
                if (elBounds.height() >= 5 && bounds != null &&
                    elBounds.top >= bounds.top && elBounds.bottom <= bounds.bottom
                ) {
                    return
                }
            }
            device.swipe(centerX, startY, centerX, endY, 25)
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

    @Test
    fun testScenario2DeactivatingQualifiedAudienceRendersBaseline() {
        openPanel()
        waitForDefinitionsLoaded()
        scrollPanelToElement("audience-toggle-$AUDIENCE_ID-off")
        // singleClick: deactivating the audience demotes it in `sortAudiences`,
        // so the row re-sorts between the accessibility click and the default
        // coordinate-click fallback, landing the second tap on whichever audience
        // now occupies the original screen position.
        TestHelpers.waitAndTap(device, By.desc("audience-toggle-$AUDIENCE_ID-off"), singleClick = true)
        closePanel()

        assertEntryVisible(BASELINE_ENTRY_ID, "Expected baseline entry after deactivating audience")
    }

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

    @Test
    fun testScenario4SettingVariantOverrideToZeroRendersBaseline() {
        openPanel()
        expandTargetAudienceAndTapVariant()
        closePanel()

        assertEntryVisible(BASELINE_ENTRY_ID, "Expected baseline after variant-0 override")
    }

    @Test
    fun testScenario6ResetAllRestoresVariantContent() {
        openPanel()
        expandTargetAudienceAndTapVariant()

        TestHelpers.waitAndTap(device, By.desc("reset-all-overrides"))
        TestHelpers.waitAndTap(device, By.text("Reset"))

        closePanel()

        assertEntryVisible(VARIANT_ENTRY_ID, "Expected variant entry after reset-all")
    }
}
