package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.PerTestRule
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import org.junit.runner.RunWith

/**
 * `*-entry-id` Text nodes render "Entry: <sys.id>" where sys.id is alphanumeric.
 * Matching this pattern proves the SDK resolved a real entry rather than an empty/default state.
 */
private val ENTRY_ID_TEXT_PATTERN = Regex("""^Entry: [a-zA-Z0-9]+$""")

@RunWith(AndroidJUnit4::class)
class LiveUpdatesTests {
    @get:Rule
    val rule: TestRule = PerTestRule.create()

    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        AppLauncher.launchApp(device)
        clearProfileState(device)

        TestHelpers.waitAndTap(device, By.res("live-updates-test-button"))
        // Android app exposes OptimizedEntry via contentDescription ("*-personalization")
        TestHelpers.waitForElement(device, By.desc("default-personalization"), TestHelpers.EXTENDED_TIMEOUT)
    }

    @After
    fun tearDown() {
        val closeButton = device.findObject(By.res("close-live-updates-test-button"))
        if (closeButton != null) TestHelpers.tapElement(device, closeButton)

        device.wait(
            androidx.test.uiautomator.Until.hasObject(By.res("live-updates-test-button")),
            TestHelpers.ELEMENT_TIMEOUT,
        )
    }

    // -------------------------------------------------------------------------
    // Default behavior (locked on first value)
    // -------------------------------------------------------------------------

    @Test
    fun testDefaultDoesNotUpdateOnIdentifyGlobalLiveUpdatesFalse() {
        TestHelpers.waitForElement(device, By.res("default-entry-id"))
        TestHelpers.waitForElement(device, By.res("live-entry-id"))

        val initialDefaultEntryId = TestHelpers.getElementTextById(device, "default-entry-id")
        val initialLiveEntryId = TestHelpers.getElementTextById(device, "live-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        // The live-entry-id section has liveUpdates=true and MUST re-resolve — this is
        // the live-reference that proves the SDK is actually swapping variants.
        TestHelpers.waitForElementText(device, "live-entry-id") { it != initialLiveEntryId }

        // Default section inherits the global setting (off), so the lock must hold.
        TestHelpers.waitForTextEquals(device, "default-entry-id", initialDefaultEntryId)
    }

    // -------------------------------------------------------------------------
    // Global liveUpdates enabled
    // -------------------------------------------------------------------------

    @Test
    fun testGlobalLiveUpdatesEnablesDefaultComponents() {
        TestHelpers.waitAndTap(device, By.res("toggle-global-live-updates-button"))
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "ON")

        TestHelpers.waitForElement(device, By.res("default-entry-id"))
        val initialDefaultEntryId = TestHelpers.getElementTextById(device, "default-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        // Global=ON means the default section (no per-component prop) MUST re-resolve.
        TestHelpers.waitForElementText(device, "default-entry-id") { it != initialDefaultEntryId }
    }

    @Test
    fun testLockedComponentsIgnoreGlobalLiveUpdates() {
        TestHelpers.waitAndTap(device, By.res("toggle-global-live-updates-button"))
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "ON")

        TestHelpers.waitForElement(device, By.res("locked-entry-id"))
        TestHelpers.waitForElement(device, By.res("default-entry-id"))

        val initialLockedEntryId = TestHelpers.getElementTextById(device, "locked-entry-id")
        val initialDefaultEntryId = TestHelpers.getElementTextById(device, "default-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        // With global=ON the default section (no per-component prop) MUST re-resolve —
        // the live-reference that proves the SDK is actually swapping variants.
        TestHelpers.waitForElementText(device, "default-entry-id") { it != initialDefaultEntryId }

        // Locked section has liveUpdates=false, so it must stay at its captured id.
        TestHelpers.waitForTextEquals(device, "locked-entry-id", initialLockedEntryId)
    }

    // -------------------------------------------------------------------------
    // Per-component liveUpdates=true
    // -------------------------------------------------------------------------

    @Test
    fun testLiveComponentUpdatesRegardlessOfGlobal() {
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "OFF")
        TestHelpers.waitForElement(device, By.res("live-entry-id"))

        val initialLiveEntryId = TestHelpers.getElementTextById(device, "live-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        // Per-component liveUpdates=true must override the global=OFF setting.
        TestHelpers.waitForElementText(device, "live-entry-id") { it != initialLiveEntryId }
    }

    // -------------------------------------------------------------------------
    // Per-component liveUpdates=false
    // -------------------------------------------------------------------------

    @Test
    fun testLockedComponentDoesNotUpdateEvenWhenGlobalOn() {
        TestHelpers.waitAndTap(device, By.res("toggle-global-live-updates-button"))
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "ON")

        TestHelpers.waitForElement(device, By.res("locked-entry-id"))
        TestHelpers.waitForElement(device, By.res("live-entry-id"))

        val initialLockedEntryId = TestHelpers.getElementTextById(device, "locked-entry-id")
        val initialLiveEntryId = TestHelpers.getElementTextById(device, "live-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        // Live section (per-component liveUpdates=true) MUST change — the per-component
        // prop is the path under test: it must override the global=ON setting and keep
        // the locked section stable.
        TestHelpers.waitForElementText(device, "live-entry-id") { it != initialLiveEntryId }
        TestHelpers.waitForTextEquals(device, "locked-entry-id", initialLockedEntryId)
    }

    // -------------------------------------------------------------------------
    // Preview panel simulation
    // -------------------------------------------------------------------------

    @Test
    fun testPreviewPanelEnablesLiveUpdatesForAll() {
        TestHelpers.waitForTextEquals(device, "preview-panel-status", "Closed")
        TestHelpers.waitAndTap(device, By.res("simulate-preview-panel-button"))
        TestHelpers.waitForTextEquals(device, "preview-panel-status", "Open")

        TestHelpers.waitForElement(device, By.res("default-entry-id"))
        TestHelpers.waitForElement(device, By.res("live-entry-id"))
        TestHelpers.waitForElement(device, By.res("locked-entry-id"))

        val initialDefaultEntryId = TestHelpers.getElementTextById(device, "default-entry-id")
        val initialLiveEntryId = TestHelpers.getElementTextById(device, "live-entry-id")
        val initialLockedEntryId = TestHelpers.getElementTextById(device, "locked-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        // While the preview panel is open, the SDK forces shouldLiveUpdate=true for ALL
        // sections, including the per-component liveUpdates=false one.
        TestHelpers.waitForElementText(device, "default-entry-id") { it != initialDefaultEntryId }
        TestHelpers.waitForElementText(device, "live-entry-id") { it != initialLiveEntryId }
        TestHelpers.waitForElementText(device, "locked-entry-id") { it != initialLockedEntryId }
    }

    // -------------------------------------------------------------------------
    // Screen controls
    // -------------------------------------------------------------------------

    @Test
    fun testToggleGlobalLiveUpdates() {
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "OFF")
        TestHelpers.waitAndTap(device, By.res("toggle-global-live-updates-button"))
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "ON")
        TestHelpers.waitAndTap(device, By.res("toggle-global-live-updates-button"))
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "OFF")
    }

    @Test
    fun testTogglePreviewPanel() {
        TestHelpers.waitForTextEquals(device, "preview-panel-status", "Closed")
        TestHelpers.waitAndTap(device, By.res("simulate-preview-panel-button"))
        TestHelpers.waitForTextEquals(device, "preview-panel-status", "Open")
        TestHelpers.waitAndTap(device, By.res("simulate-preview-panel-button"))
        TestHelpers.waitForTextEquals(device, "preview-panel-status", "Closed")
    }

    @Test
    fun testIdentifyAndReset() {
        TestHelpers.waitForTextEquals(device, "identified-status", "No")
        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")
        TestHelpers.waitAndTap(device, By.res("live-updates-reset-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "No")
    }

    // -------------------------------------------------------------------------
    // Three Optimization sections display
    // -------------------------------------------------------------------------

    @Test
    fun testDisplaysAllThreeOptimizationEntrySections() {
        // Android app exposes OptimizedEntry via contentDescription ("*-personalization").
        // iOS uses "*-optimization". Both refer to the same SDK-rendered containers.
        TestHelpers.waitForElement(device, By.desc("default-personalization"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForElement(device, By.desc("live-personalization"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForElement(device, By.desc("locked-personalization"), TestHelpers.ELEMENT_TIMEOUT)

        TestHelpers.waitForElement(device, By.res("default-entry-id"))
        TestHelpers.waitForElement(device, By.res("live-entry-id"))
        TestHelpers.waitForElement(device, By.res("locked-entry-id"))

        val defaultEntryIdText = TestHelpers.getElementTextById(device, "default-entry-id")
        val liveEntryIdText = TestHelpers.getElementTextById(device, "live-entry-id")
        val lockedEntryIdText = TestHelpers.getElementTextById(device, "locked-entry-id")

        Assert.assertTrue(
            "default-entry-id \"$defaultEntryIdText\" did not match ENTRY_ID_TEXT_PATTERN",
            ENTRY_ID_TEXT_PATTERN.matches(defaultEntryIdText),
        )
        Assert.assertTrue(
            "live-entry-id \"$liveEntryIdText\" did not match ENTRY_ID_TEXT_PATTERN",
            ENTRY_ID_TEXT_PATTERN.matches(liveEntryIdText),
        )
        Assert.assertTrue(
            "locked-entry-id \"$lockedEntryIdText\" did not match ENTRY_ID_TEXT_PATTERN",
            ENTRY_ID_TEXT_PATTERN.matches(lockedEntryIdText),
        )
    }

    @Test
    fun testDisplaysEntryContentInAllSections() {
        TestHelpers.waitForElement(device, By.res("default-container"))
        TestHelpers.waitForElement(device, By.res("live-container"))
        TestHelpers.waitForElement(device, By.res("locked-container"))

        val defaultText = TestHelpers.getElementTextById(device, "default-text")
        val liveText = TestHelpers.getElementTextById(device, "live-text")
        val lockedText = TestHelpers.getElementTextById(device, "locked-text")

        Assert.assertTrue("default-text should be non-empty", defaultText.isNotEmpty())
        Assert.assertTrue("live-text should be non-empty", liveText.isNotEmpty())
        Assert.assertTrue("locked-text should be non-empty", lockedText.isNotEmpty())
        Assert.assertNotEquals("default-text should not be 'No content'", "No content", defaultText)
        Assert.assertNotEquals("live-text should not be 'No content'", "No content", liveText)
        Assert.assertNotEquals("locked-text should not be 'No content'", "No content", lockedText)
        // Before any identify/toggle/preview-panel action all three sections wrap the
        // same Contentful entry and MUST resolve to the same variant text.
        Assert.assertEquals("default-text and live-text should match", defaultText, liveText)
        Assert.assertEquals("default-text and locked-text should match", defaultText, lockedText)
    }
}
