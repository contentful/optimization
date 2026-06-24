package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
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
class PreviewPanelTests {
    @get:Rule
    val rule: TestRule = PerTestRule.create()

    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        AppLauncher.launchApp(device)
        clearProfileState(device)
        TestHelpers.waitForElement(device, By.res("identify-button"))
    }

    private fun openPreviewPanel() {
        TestHelpers.waitAndTap(device, By.desc("preview-panel-fab"))
        TestHelpers.waitForElement(device, By.text("Preview Panel"))
        Thread.sleep(2000)
    }

    private fun scrollToPreviewElement(testId: String, maxSwipes: Int = 20) {
        for (i in 0 until maxSwipes) {
            if (TestHelpers.findElement(device, testId) != null) return
            val panelBounds = device.findObject(By.desc("preview-panel-list"))?.visibleBounds
            val centerX = panelBounds?.centerX() ?: (device.displayWidth / 2)
            val startY = panelBounds?.let { it.top + (it.height() * 3 / 4) } ?: (device.displayHeight * 3 / 4)
            val endY = panelBounds?.let { it.top + (it.height() / 4) } ?: (device.displayHeight / 4)
            device.swipe(centerX, startY, centerX, endY, 10)
            Thread.sleep(300)
        }
    }

    // FAB Visibility

    @Test
    fun testFABIsVisible() {
        val fab = device.findObject(By.desc("preview-panel-fab"))
        Assert.assertNotNull("Preview panel FAB should be visible on main screen", fab)
    }

    // Profile Data Loading

    @Test
    fun testShowsProfileData() {
        openPreviewPanel()
        Thread.sleep(2000)
        val noData = device.findObject(By.desc("no-profile-data"))
        Assert.assertNull("Should not show 'No profile data' after initialization", noData)
    }

    @Test
    fun testShowsAllExpectedProfileKeys() {
        openPreviewPanel()

        val expectedKeys = listOf("audiences", "id", "location", "random", "session", "stableId", "traits")
        for (key in expectedKeys) {
            scrollToPreviewElement("profile-item-$key")
            val item = TestHelpers.findElement(device, "profile-item-$key")
            Assert.assertNotNull("Expected profile key '$key' not found in preview panel", item)
        }
    }

    @Test
    fun testShowsLocationData() {
        openPreviewPanel()
        scrollToPreviewElement("profile-item-location")

        val locationItem = TestHelpers.findElement(device, "profile-item-location")
        Assert.assertNotNull("Profile location item not found", locationItem)

        val text = TestHelpers.extractText(locationItem!!)
        Assert.assertTrue(
            "Expected location to contain Berlin or DE, got: $text",
            text.contains("Berlin") || text.contains("DE"),
        )
    }

    // Debug Section

    @Test
    fun testShowsConsentAccepted() {
        openPreviewPanel()
        scrollToPreviewElement("debug-consent")

        val consent = TestHelpers.findElement(device, "debug-consent")
        Assert.assertNotNull("Debug consent element not found", consent)

        val text = TestHelpers.extractText(consent!!)
        Assert.assertTrue(
            "Expected consent to contain 'Accepted', got: $text",
            text.contains("Accepted"),
        )
    }

    @Test
    fun testShowsCanOptimize() {
        openPreviewPanel()
        scrollToPreviewElement("debug-can-optimize")

        val canOptimize = TestHelpers.findElement(device, "debug-can-optimize")
        Assert.assertNotNull("Debug canOptimize element not found", canOptimize)

        val text = TestHelpers.extractText(canOptimize!!)
        Assert.assertTrue(
            "Expected canOptimize to contain 'Yes', got: $text",
            text.contains("Yes"),
        )
    }

    // Refresh

    @Test
    fun testRefreshButtonWorks() {
        openPreviewPanel()
        scrollToPreviewElement("preview-refresh-button")

        TestHelpers.waitAndTap(device, By.desc("preview-refresh-button"))

        Thread.sleep(2000)
        val noData = device.findObject(By.desc("no-profile-data"))
        Assert.assertNull("Profile data should persist after refresh", noData)
    }

    // Profile After Identify

    @Test
    fun testProfileUpdatesAfterIdentify() {
        TestHelpers.waitAndTap(device, By.res("identify-button"))
        TestHelpers.waitForElement(device, By.res("reset-button"), TestHelpers.EXTENDED_TIMEOUT)

        openPreviewPanel()

        Thread.sleep(2000)
        val noData = device.findObject(By.desc("no-profile-data"))
        Assert.assertNull("Should show profile data after identify", noData)

        scrollToPreviewElement("profile-item-id")
        val idItem = TestHelpers.findElement(device, "profile-item-id")
        Assert.assertNotNull("Profile id should be present after identify", idItem)
    }
}
