package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TapTrackingTests {
    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        AppLauncher.launchApp(device)
        clearProfileState(device)
    }

    private fun tapEntryAndWaitForClickEvent(entryId: String) {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)

        val entry = TestHelpers.waitForElement(device, By.desc("content-entry-$entryId"))
        val bounds = entry.visibleBounds
        device.click(bounds.centerX(), bounds.centerY())
        Thread.sleep(2000)

        val testId = "event-component_click-$entryId"
        TestHelpers.scrollToElement(device, testId, "main-scroll-view")
        TestHelpers.waitForElement(device, By.res(testId), TestHelpers.EXTENDED_TIMEOUT)
    }

    @Test
    fun testEmitsComponentClickWhenTappingContentEntry() {
        tapEntryAndWaitForClickEvent("1MwiFl4z7gkwqGYdvCmr8c")
    }

    @Test
    fun testEmitsComponentClickForDifferentEntry() {
        tapEntryAndWaitForClickEvent("2Z2WLOx07InSewC3LUB3eX")
    }
}
