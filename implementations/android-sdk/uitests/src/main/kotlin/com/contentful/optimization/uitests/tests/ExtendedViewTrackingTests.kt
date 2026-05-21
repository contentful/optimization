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
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)
    }

    @Test
    fun testIncreasingViewDurationMs() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val duration = TestHelpers.getViewDuration(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("Duration should not be null", duration)
        Assert.assertTrue("Duration should be > 2000ms, got: $duration", duration!! > 2000)
    }

    @Test
    fun testStableViewIdWithinCycle() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val firstEventViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("First event viewId should not be null", firstEventViewId)
        Assert.assertTrue("First event viewId should not be empty", firstEventViewId!!.isNotEmpty())

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val secondEventViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertEquals(
            "ViewId should remain stable within a visibility cycle",
            firstEventViewId, secondEventViewId,
        )
    }

    @Test
    fun testFinalEventOnScrollOut() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val preScrollViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)

        device.swipeUpMultiple(2)
        Thread.sleep(1000)

        // Scroll directly to the analytics section from the current (scrolled-down) position.
        // Skipping the swipe-back-to-top step prevents the content entry from re-entering the
        // viewport and dwelling long enough to start a new cycle before the stats are read,
        // which is what caused the viewId to change in the original test.
        TestHelpers.scrollToElement(device, "event-count-$VISIBLE_ENTRY_ID", "main-scroll-view")

        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.ELEMENT_TIMEOUT,
        )

        val postScrollViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertEquals(
            "ViewId should remain the same cycle after scroll-out final event",
            preScrollViewId, postScrollViewId,
        )
    }

    @Test
    fun testNewViewIdAfterScrollAwayAndBack() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val firstCycleViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)

        device.swipeUpMultiple(5)
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
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

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
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

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
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val preNavText = TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID")
        val preNavCount = TestHelpers.parseComponentCount(preNavText)

        try {
            device.swipeDownMultiple(3)
        } catch (_: Exception) {
            // Scroll may fail if not scrollable; ignore
        }

        TestHelpers.waitAndTap(device, By.res("navigation-test-button"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForElement(device, By.res("close-navigation-test-button"), TestHelpers.ELEMENT_TIMEOUT)
        Thread.sleep(500)

        TestHelpers.waitAndTap(device, By.res("close-navigation-test-button"), TestHelpers.ELEMENT_TIMEOUT)

        // Wait for the main screen to fully remount with its persisted event state before
        // scrolling to the analytics section. scrollToElement silently swallows failures, so
        // reading immediately after can find the element missing if the LazyColumn hasn't
        // recomposed yet.
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Use waitForComponentEventCount rather than a bare getElementTextById so the test
        // waits for the final event to land in componentStats before asserting the count.
        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, preNavCount + 1, timeout = TestHelpers.EXTENDED_TIMEOUT,
        )

        val postNavText = TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID")
        val postNavCount = TestHelpers.parseComponentCount(postNavText)
        Assert.assertTrue(
            "Event count should increase after navigation unmount (pre=$preNavCount, post=$postNavCount)",
            postNavCount > preNavCount,
        )
    }

    @Test
    fun testPauseResumeOnBackgroundForeground() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val firstCycleViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val midCycleViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertEquals(
            "ViewId should remain stable across two events in the same cycle",
            firstCycleViewId, midCycleViewId,
        )

        val countBeforeBackground = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )

        device.pressHome()
        Thread.sleep(1000)

        AppLauncher.bringToForeground(device)

        // Wait for the app UI to fully restore before interacting with it. Without this,
        // scrollToElement may run while the activity is still resuming, leaving the analytics
        // section unrendered and causing waitForComponentEventCount to time out on an empty element.
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Allow the resumed cycle to dwell past the 2000 ms threshold so the new cycle's
        // initial event fires before we scroll to the stats and poll the count.
        Thread.sleep(3000)

        TestHelpers.scrollToElement(device, "event-count-$VISIBLE_ENTRY_ID", "main-scroll-view")

        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, countBeforeBackground + 2, timeout = TestHelpers.EXTENDED_TIMEOUT,
        )

        val postForegroundViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotEquals(
            "ViewId should change after background/foreground cycle",
            firstCycleViewId, postForegroundViewId,
        )
    }

    @Test
    fun testDurationResetOnNewCycle() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Let the entry accumulate view time well past the 4000 ms contract floor before
        // waitForComponentEventCount ever calls scrollToElement (which would scroll the entry
        // off screen and end the cycle prematurely with a very short duration).
        // Mirroring the iOS test: sleep 6 s first so the first cycle's duration is comfortably
        // above 4000 ms when we read it.
        Thread.sleep(6000)

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val firstCycleDuration = TestHelpers.getViewDuration(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("First cycle duration should not be null", firstCycleDuration)
        Assert.assertTrue(
            "First cycle duration should exceed 4000ms, got: $firstCycleDuration",
            firstCycleDuration!! > 4000,
        )

        device.swipeUpMultiple(5)
        Thread.sleep(1000)

        device.swipeDownMultiple(5)
        Thread.sleep(500)

        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 4, timeout = TestHelpers.EXTENDED_TIMEOUT)

        val secondCycleDuration = TestHelpers.getViewDuration(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("Second cycle duration should not be null", secondCycleDuration)
        Assert.assertTrue(
            "Second cycle duration should be >= 2000ms, got: ${secondCycleDuration}ms",
            secondCycleDuration!! >= 2000,
        )
        Assert.assertTrue(
            "Second cycle duration should reset — expected < 4000ms but got ${secondCycleDuration}ms",
            secondCycleDuration < 4000,
        )
    }
}
