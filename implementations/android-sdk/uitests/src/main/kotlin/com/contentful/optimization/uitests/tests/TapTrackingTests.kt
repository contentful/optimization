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

    @Test
    fun testEmitsComponentClickWhenTappingContentEntry() {
        // Step 1: wait for "Analytics Events" text to be visible
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Step 2: tap the content entry
        val entry = TestHelpers.waitForElement(device, By.desc("content-entry-1MwiFl4z7gkwqGYdvCmr8c"))
        TestHelpers.tapElement(device, entry)

        // Step 3: wait until at least 1 event has been tracked
        TestHelpers.waitForEventsCountAtLeast(device, 1)

        // Step 4: scroll to and assert the component_click event element is visible
        val testId = "event-component_click-1MwiFl4z7gkwqGYdvCmr8c"
        TestHelpers.scrollToElement(device, testId, "main-scroll-view")
        TestHelpers.waitForElement(device, By.res(testId), TestHelpers.ELEMENT_TIMEOUT)
    }

    @Test
    fun testEmitsComponentClickForDifferentEntry() {
        // Step 1: wait for "Analytics Events" text to be visible
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Step 2: tap the content entry
        val entry = TestHelpers.waitForElement(device, By.desc("content-entry-2Z2WLOx07InSewC3LUB3eX"))
        TestHelpers.tapElement(device, entry)

        // Step 3: wait until at least 1 event has been tracked
        TestHelpers.waitForEventsCountAtLeast(device, 1)

        // Step 4: scroll to and assert the component_click event element is visible
        val testId = "event-component_click-2Z2WLOx07InSewC3LUB3eX"
        TestHelpers.scrollToElement(device, testId, "main-scroll-view")
        TestHelpers.waitForElement(device, By.res(testId), TestHelpers.ELEMENT_TIMEOUT)
    }
}
