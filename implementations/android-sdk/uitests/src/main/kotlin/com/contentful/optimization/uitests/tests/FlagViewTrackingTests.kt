package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FlagViewTrackingTests {
    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        clearProfileState(device, requireFreshAppInstance = true)
    }

    @Test
    fun testEmitsComponentEventsForTrackedEntries() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForEventsCountAtLeast(device, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)
    }
}
