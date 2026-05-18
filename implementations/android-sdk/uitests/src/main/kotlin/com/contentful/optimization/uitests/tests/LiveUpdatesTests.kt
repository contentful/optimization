package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LiveUpdatesTests {
    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        AppLauncher.launchApp(device)
        clearProfileState(device)

        TestHelpers.waitAndTap(device, By.res("live-updates-test-button"))
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

    @Test
    fun testDefaultDoesNotUpdateOnIdentify() {
        TestHelpers.waitForElement(device, By.res("default-entry-id"))
        val initialText = TestHelpers.getElementTextById(device, "default-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")
        TestHelpers.waitForTextEquals(device, "default-entry-id", initialText)
    }

    @Test
    fun testGlobalLiveUpdatesEnablesDefaultComponents() {
        TestHelpers.waitAndTap(device, By.res("toggle-global-live-updates-button"))
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "ON")

        TestHelpers.waitForElement(device, By.res("default-entry-id"))
        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        Assert.assertNotNull(
            "default-entry-id should exist",
            device.findObject(By.res("default-entry-id")),
        )
    }

    @Test
    fun testLockedComponentsIgnoreGlobalLiveUpdates() {
        TestHelpers.waitAndTap(device, By.res("toggle-global-live-updates-button"))
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "ON")

        TestHelpers.waitForElement(device, By.res("locked-entry-id"))
        val initialText = TestHelpers.getElementTextById(device, "locked-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")
        TestHelpers.waitForTextEquals(device, "locked-entry-id", initialText)
    }

    @Test
    fun testLiveComponentUpdatesRegardlessOfGlobal() {
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "OFF")
        TestHelpers.waitForElement(device, By.res("live-entry-id"))

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        Assert.assertNotNull(
            "live-entry-id should exist",
            device.findObject(By.res("live-entry-id")),
        )
    }

    @Test
    fun testLockedComponentDoesNotUpdateEvenWhenGlobalOn() {
        TestHelpers.waitAndTap(device, By.res("toggle-global-live-updates-button"))
        TestHelpers.waitForTextEquals(device, "global-live-updates-status", "ON")

        TestHelpers.waitForElement(device, By.res("locked-entry-id"))
        val initialText = TestHelpers.getElementTextById(device, "locked-entry-id")

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")
        TestHelpers.waitForTextEquals(device, "locked-entry-id", initialText)
    }

    @Test
    fun testPreviewPanelEnablesLiveUpdatesForAll() {
        TestHelpers.waitForTextEquals(device, "preview-panel-status", "Closed")
        TestHelpers.waitAndTap(device, By.res("simulate-preview-panel-button"))
        TestHelpers.waitForTextEquals(device, "preview-panel-status", "Open")

        TestHelpers.waitForElement(device, By.res("default-entry-id"))
        TestHelpers.waitForElement(device, By.res("live-entry-id"))
        TestHelpers.waitForElement(device, By.res("locked-entry-id"))

        TestHelpers.waitAndTap(device, By.res("live-updates-identify-button"))
        TestHelpers.waitForTextEquals(device, "identified-status", "Yes")

        Assert.assertNotNull(device.findObject(By.res("default-entry-id")))
        Assert.assertNotNull(device.findObject(By.res("live-entry-id")))
        Assert.assertNotNull(device.findObject(By.res("locked-entry-id")))
    }

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

    @Test
    fun testDisplaysAllThreePersonalizationComponents() {
        TestHelpers.waitForElement(device, By.desc("default-personalization"))
        TestHelpers.waitForElement(device, By.desc("live-personalization"))
        TestHelpers.waitForElement(device, By.desc("locked-personalization"))
    }

    @Test
    fun testDisplaysEntryContentInAllSections() {
        TestHelpers.waitForElement(device, By.res("default-text"))
        TestHelpers.waitForElement(device, By.res("live-text"))
        TestHelpers.waitForElement(device, By.res("locked-text"))
        Assert.assertNotNull(device.findObject(By.res("default-entry-id")))
        Assert.assertNotNull(device.findObject(By.res("live-entry-id")))
        Assert.assertNotNull(device.findObject(By.res("locked-entry-id")))
    }
}
