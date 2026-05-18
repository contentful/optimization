package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OfflineBehaviorTests {
    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        AppLauncher.launchApp(device)
        clearProfileState(device)
    }

    @After
    fun tearDown() {
        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)
    }

    @Test
    fun testContinuesToTrackEventsWhileOffline() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForEventsCountAtLeast(device, 1)

        val countBefore = TestHelpers.parseEventsCount(
            TestHelpers.getElementTextById(device, "events-count"),
        )

        TestHelpers.waitAndTap(device, By.res("identify-button"))

        TestHelpers.waitForElementText(device, "events-count") { text ->
            TestHelpers.parseEventsCount(text) >= countBefore + 1
        }
    }

    @Test
    fun testRecoverGracefullyWhenNetworkRestored() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)

        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device, extras = mapOf("simulate_offline" to true))

        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        Thread.sleep(1000)

        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)

        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForElement(device, By.res("identify-button"))
    }

    @Test
    fun testHandleRapidNetworkStateChanges() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)

        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device, extras = mapOf("simulate_offline" to true))
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)

        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)

        TestHelpers.waitForElement(device, By.res("identify-button"))
    }

    @Test
    fun testQueueEventsOfflineAndFlushWhenOnline() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForEventsCountAtLeast(device, 1)

        val countBefore = TestHelpers.parseEventsCount(
            TestHelpers.getElementTextById(device, "events-count"),
        )

        TestHelpers.waitAndTap(device, By.res("identify-button"))

        TestHelpers.waitForElementText(device, "events-count") { text ->
            TestHelpers.parseEventsCount(text) >= countBefore + 1
        }

        TestHelpers.waitForElement(device, By.res("reset-button"))
    }
}
