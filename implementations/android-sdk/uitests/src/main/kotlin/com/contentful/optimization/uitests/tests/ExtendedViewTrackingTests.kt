package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import com.contentful.optimization.uitests.support.swipeDownMultiple
import com.contentful.optimization.uitests.support.swipeUpMultiple
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ExtendedViewTrackingTests {
    private lateinit var device: UiDevice

    companion object {
        const val VISIBLE_ENTRY_ID = "1MwiFl4z7gkwqGYdvCmr8c"
        const val SECOND_ENTRY_ID = "4ib0hsHWoSOnCVdDkizE8d"
        const val BELOW_FOLD_ENTRY_ID = "7pa5bOx8Z9NmNcr7mISvD"
    }

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        clearProfileState(device, requireFreshAppInstance = true)
    }

    @Test
    fun testPeriodicEventsForContinuouslyVisibleEntry() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)
    }

    @Test
    fun testIncreasingViewDurationMs() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val duration = TestHelpers.getViewDuration(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("Duration should not be null", duration)
        Assert.assertTrue("Duration should be > 2000ms, got: $duration", duration!! > 2000)
    }

    @Test
    fun testStableViewIdWithinCycle() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val viewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("ViewId should not be null", viewId)
        Assert.assertTrue("ViewId should not be empty", viewId!!.isNotEmpty())
    }

    @Test
    fun testFinalEventOnScrollOut() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val preScrollCount = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )

        device.swipeUpMultiple(2)
        Thread.sleep(1000)

        device.swipeDownMultiple(3)

        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, preScrollCount + 1, timeout = TestHelpers.EXTENDED_TIMEOUT,
        )
    }

    @Test
    fun testNewViewIdAfterScrollAwayAndBack() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val firstCycleViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)

        TestHelpers.scrollToElementByDescription(
            device, "content-entry-$BELOW_FOLD_ENTRY_ID", "main-scroll-view",
        )
        Thread.sleep(1000)

        device.swipeDownMultiple(5)
        Thread.sleep(500)

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 3, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val secondCycleViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("Second cycle viewId should not be null", secondCycleViewId)
        Assert.assertNotEquals(
            "ViewId should change in new cycle",
            firstCycleViewId, secondCycleViewId,
        )
    }

    @Test
    fun testNoEventsBeforeDwellThreshold() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)

        TestHelpers.scrollToElementByDescription(
            device, "content-entry-$BELOW_FOLD_ENTRY_ID", "main-scroll-view",
        )

        device.swipeDownMultiple(3)

        Thread.sleep(3000)

        val statsElement = device.findObject(By.res("component-stats-$BELOW_FOLD_ENTRY_ID"))
        Assert.assertNull("No events should have fired for below-fold entry", statsElement)
    }

    @Test
    fun testIndependentViewIdsForMultipleEntries() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, SECOND_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val viewId1 = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        val viewId2 = TestHelpers.getViewId(device, SECOND_ENTRY_ID)

        Assert.assertNotNull("ViewId1 should not be null", viewId1)
        Assert.assertNotNull("ViewId2 should not be null", viewId2)
        Assert.assertNotEquals("ViewIds should differ between entries", viewId1, viewId2)
    }

    @Test
    fun testFinalEventOnNavigationUnmount() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val preNavText = TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID")
        val preNavCount = TestHelpers.parseComponentCount(preNavText)

        device.swipeDownMultiple(3)

        TestHelpers.waitAndTap(device, By.res("navigation-test-button"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForElement(device, By.res("close-navigation-test-button"), TestHelpers.EXTENDED_TIMEOUT)
        Thread.sleep(1000)

        device.pressBack()
        Thread.sleep(1000)

        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, preNavCount + 1, timeout = TestHelpers.EXTENDED_TIMEOUT,
        )
    }

    @Test
    fun testPauseResumeOnBackgroundForeground() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val preBackgroundViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)

        device.swipeDownMultiple(3)

        Thread.sleep(3000)

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)
        val countBefore = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )

        device.swipeDownMultiple(3)
        Thread.sleep(1000)

        device.pressHome()
        Thread.sleep(1000)

        AppLauncher.bringToForeground(device)
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
        Thread.sleep(3000)

        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, countBefore + 1, timeout = TestHelpers.EXTENDED_TIMEOUT,
        )
        val countAfter = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )
        Assert.assertTrue(
            "Events should continue after background/foreground (before=$countBefore, after=$countAfter)",
            countAfter > countBefore,
        )

        val postForegroundViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotEquals(
            "ViewId should change after background/foreground cycle",
            preBackgroundViewId, postForegroundViewId,
        )
    }

    @Test
    fun testDurationResetOnNewCycle() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val firstDuration = TestHelpers.getViewDuration(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("First duration should not be null", firstDuration)
        Assert.assertTrue(
            "First cycle duration should exceed 1500ms, got: $firstDuration",
            firstDuration!! > 1500,
        )

        TestHelpers.scrollToElementByDescription(
            device, "content-entry-$BELOW_FOLD_ENTRY_ID", "main-scroll-view",
        )
        Thread.sleep(1000)

        device.swipeDownMultiple(5)
        Thread.sleep(500)

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 4, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val newDuration = TestHelpers.getViewDuration(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("New duration should not be null", newDuration)
        Assert.assertTrue(
            "New cycle duration should be reasonable for a fresh cycle, got: ${newDuration}ms",
            newDuration!! < 15000,
        )
    }
}
