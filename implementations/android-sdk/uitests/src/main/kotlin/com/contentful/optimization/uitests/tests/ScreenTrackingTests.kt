package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ScreenTrackingTests {
    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        clearProfileState(device, requireFreshAppInstance = true)
    }

    private fun navigateToTestScreen() {
        TestHelpers.waitAndTap(device, By.res("navigation-test-button"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForElement(device, By.res("go-to-view-one-button"), TestHelpers.EXTENDED_TIMEOUT)
    }

    @Test
    fun testTrackSingleViewVisit() {
        navigateToTestScreen()
        TestHelpers.waitAndTap(device, By.res("go-to-view-one-button"))

        TestHelpers.waitForElement(device, By.res("navigation-view-test-one"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForElement(device, By.res("screen-event-log"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForTextEquals(
            device, "screen-event-log", "NavigationHome,NavigationViewOne",
            timeout = TestHelpers.EXTENDED_TIMEOUT,
        )
    }

    @Test
    fun testTrackMultipleViewVisitsInOrder() {
        navigateToTestScreen()
        TestHelpers.waitAndTap(device, By.res("go-to-view-one-button"))

        TestHelpers.waitForElement(device, By.res("navigation-view-test-one"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitAndTap(device, By.res("go-to-view-two-button"), TestHelpers.EXTENDED_TIMEOUT)

        TestHelpers.waitForElement(device, By.res("navigation-view-test-two"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForElement(device, By.res("screen-event-log"), TestHelpers.EXTENDED_TIMEOUT)

        val logText = TestHelpers.waitForElementText(
            device, "screen-event-log", timeout = TestHelpers.EXTENDED_TIMEOUT,
        ) { text ->
            text.contains("NavigationViewTwo")
        }

        val viewOneIndex = logText.indexOf("NavigationViewOne")
        val viewTwoIndex = logText.indexOf("NavigationViewTwo")

        Assert.assertTrue("ViewOne not found in log", viewOneIndex >= 0)
        Assert.assertTrue("ViewTwo not found in log", viewTwoIndex >= 0)
        Assert.assertTrue("ViewOne should come before ViewTwo", viewOneIndex < viewTwoIndex)
    }

    @Test
    fun testTrackRevisitingViewOneAfterViewTwo() {
        navigateToTestScreen()
        TestHelpers.waitAndTap(device, By.res("go-to-view-one-button"))

        TestHelpers.waitForElement(device, By.res("navigation-view-test-one"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitAndTap(device, By.res("go-to-view-two-button"), TestHelpers.EXTENDED_TIMEOUT)

        TestHelpers.waitForElement(device, By.res("navigation-view-test-two"), TestHelpers.EXTENDED_TIMEOUT)

        device.pressBack()

        TestHelpers.waitForElement(device, By.res("navigation-view-test-one"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForElement(device, By.res("screen-event-log"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForTextEquals(
            device,
            "screen-event-log",
            "NavigationHome,NavigationViewOne,NavigationViewTwo,NavigationViewOne",
            timeout = TestHelpers.EXTENDED_TIMEOUT,
        )
    }
}
