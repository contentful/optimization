package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import com.contentful.optimization.uitests.support.scrollByOffset
import com.contentful.optimization.uitests.support.swipeDownMultiple
import com.contentful.optimization.uitests.support.swipeUpMultiple
import org.junit.Assert
import org.junit.Before
import org.junit.Ignore
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Extended view tracking. Mirrors the iOS `ExtendedViewTrackingTests` XCUITest
 * suite body-for-body, using momentum-free controlled scrolling so dwell and
 * lifecycle timing assertions are deterministic.
 */
@RunWith(AndroidJUnit4::class)
class ExtendedViewTrackingTests {
    private lateinit var device: UiDevice

    companion object {
        // The merge tag entry is always first in the list and visible on launch.
        const val VISIBLE_ENTRY_ID = "1MwiFl4z7gkwqGYdvCmr8c"

        // Second entry visible on launch (immediately after the merge tag entry).
        const val SECOND_ENTRY_ID = "4ib0hsHWoSOnCVdDkizE8d"

        // An entry that starts below the fold (not visible on launch).
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

        // Initial event after the dwell threshold (~2s).
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)

        // At least one periodic update (dwell 2s + update interval 5s).
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

        // Capture the viewId from the first event of the cycle.
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)
        val firstEventViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("First event viewId should not be null", firstEventViewId)
        Assert.assertTrue("First event viewId should not be empty", firstEventViewId!!.isNotEmpty())

        // The next periodic event in the SAME cycle must reuse the same viewId.
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

        // Scroll the entry out of the viewport, let the final event fire.
        device.swipeUpMultiple(2)
        Thread.sleep(1000)
        device.swipeDownMultiple(3)

        TestHelpers.scrollToElement(device, "event-count-$VISIBLE_ENTRY_ID", "main-scroll-view")
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.ELEMENT_TIMEOUT)

        val postScrollViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertEquals(
            "ViewId should still match the original cycle after the scroll-out final event",
            preScrollViewId, postScrollViewId,
        )
    }

    @Test
    fun testNewViewIdAfterScrollAwayAndBack() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Cycle 1: reading the stats scrolls entry 0 off, ending cycle 1.
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)
        val firstCycleViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("First cycle viewId should not be null", firstCycleViewId)
        val countAfterCycle1 = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )

        // Scroll entry 0 back into view to start a fresh cycle, and dwell past
        // the threshold so the new cycle emits its initial event.
        TestHelpers.scrollEntryIntoView(device, "content-entry-$VISIBLE_ENTRY_ID", "main-scroll-view")
        Thread.sleep(2600)

        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, countAfterCycle1 + 1, timeout = TestHelpers.EXTENDED_TIMEOUT,
        )
        val secondCycleViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("Second cycle viewId should not be null", secondCycleViewId)
        Assert.assertNotEquals(
            "Second visibility cycle should have a different viewId",
            firstCycleViewId, secondCycleViewId,
        )
    }

    // The "visible shorter than the dwell threshold" scenario cannot be set up
    // on the Android emulator: without the content-entry card height every entry
    // fits the viewport, so none start below the fold; and the card height makes
    // the list long enough that UiAutomator can no longer reach the lower content
    // (those two requirements are mutually exclusive here). The shared
    // dwell-threshold behavior is exercised by the iOS XCUITest suite.
    @Ignore("Below-the-fold entry scenario is unconstructable on the Android emulator; covered by the iOS suite")
    @Test
    fun testNoEventsBeforeDwellThreshold() {
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.ELEMENT_TIMEOUT)

        // Sweep the below-fold entry up and out with large, fast momentum-free
        // drags so it transits the 0.8 visibility band without ever resting on
        // screen long enough to trip the 2000ms dwell timer.
        repeat(5) { device.scrollByOffset(dy = 700, fast = true) }

        // Wait long enough that an event WOULD have fired if tracking hadn't been cancelled.
        Thread.sleep(3000)

        // The stats element only renders once an entry view event has fired.
        val appeared = device.wait(
            Until.hasObject(By.res("component-stats-$BELOW_FOLD_ENTRY_ID")), 2000L,
        )
        Assert.assertFalse("No events should have fired for the below-fold entry", appeared == true)
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
        val preNavCount = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )

        // Scroll back to the top so the Navigation Test button is reachable.
        device.swipeDownMultiple(3)

        // Dwell so the now-visible entry has an active, past-threshold tracking
        // cycle — navigating away must then emit a final event for it.
        Thread.sleep(2600)

        // Navigate away: this unmounts all tracked entries, triggering cleanup.
        TestHelpers.waitAndTap(device, By.res("navigation-test-button"))
        TestHelpers.waitForElement(device, By.res("close-navigation-test-button"), TestHelpers.ELEMENT_TIMEOUT)
        Thread.sleep(500)

        // Navigate back to the main screen.
        TestHelpers.waitAndTap(device, By.res("close-navigation-test-button"))
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        TestHelpers.scrollToElement(device, "event-count-$VISIBLE_ENTRY_ID", "main-scroll-view")

        val postNavCount = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )
        Assert.assertTrue(
            "Event count should increase after navigation unmount (pre=$preNavCount, post=$postNavCount)",
            postNavCount > preNavCount,
        )
    }

    @Test
    fun testPauseResumeOnBackgroundForeground() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Cycle 1: reading the stats scrolls entry 0 off, ending cycle 1.
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 1, timeout = TestHelpers.EXTENDED_TIMEOUT)
        val firstCycleViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("First cycle viewId should not be null", firstCycleViewId)
        val countBeforeBackground = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )

        // Start a cycle that is ACTIVE when the app backgrounds: scroll entry 0
        // back into view and dwell past the threshold so its initial event fires.
        TestHelpers.scrollEntryIntoView(device, "content-entry-$VISIBLE_ENTRY_ID", "main-scroll-view")
        Thread.sleep(3000)

        // Background — pause() ends the active cycle with a final event.
        device.pressHome()
        Thread.sleep(1000)

        // Foreground — resume() re-evaluates the stored geometry and starts a fresh cycle.
        AppLauncher.bringToForeground(device)
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Let the resumed cycle dwell past the threshold so its initial event fires.
        Thread.sleep(3000)
        TestHelpers.scrollToElement(device, "event-count-$VISIBLE_ENTRY_ID", "main-scroll-view")

        // Backgrounding ended the pre-background cycle with a final event and
        // foregrounding started a fresh one, so the count must advance by 2.
        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, countBeforeBackground + 2, timeout = TestHelpers.EXTENDED_TIMEOUT,
        )

        val postForegroundViewId = TestHelpers.getViewId(device, VISIBLE_ENTRY_ID)
        Assert.assertNotEquals(
            "ViewId should change after the background/foreground cycle",
            firstCycleViewId, postForegroundViewId,
        )
    }

    @Test
    fun testDurationResetOnNewCycle() {
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Cycle 1: leave entry 0 untouched well past the dwell threshold so it
        // accumulates more than 4000ms of view time.
        Thread.sleep(6000)

        // Reading the stats scrolls entry 0 off, ending cycle 1 with a final
        // event whose duration is the full ~6s the entry was continuously visible.
        TestHelpers.waitForComponentEventCount(device, VISIBLE_ENTRY_ID, 2, timeout = TestHelpers.EXTENDED_TIMEOUT)
        val firstCycleDuration = TestHelpers.getViewDuration(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("First cycle duration should not be null", firstCycleDuration)
        Assert.assertTrue(
            "First cycle duration should exceed 4000ms, got: $firstCycleDuration",
            firstCycleDuration!! > 4000,
        )

        val countAfterCycle1 = TestHelpers.parseComponentCount(
            TestHelpers.getElementTextById(device, "event-count-$VISIBLE_ENTRY_ID"),
        )

        // Start a fresh cycle: scroll entry 0 fully out — which reliably ends
        // cycle 1 — then bring it back so a brand-new cycle starts. A full
        // scroll-out crosses the visibility threshold dependably; a tiny jiggle
        // does not. Then dwell just past the threshold so the new cycle emits.
        device.swipeUpMultiple(2)
        Thread.sleep(500)
        device.swipeDownMultiple(2)
        Thread.sleep(2400)
        TestHelpers.waitForComponentEventCount(
            device, VISIBLE_ENTRY_ID, countAfterCycle1 + 1, timeout = TestHelpers.EXTENDED_TIMEOUT,
        )

        val secondCycleDuration = TestHelpers.getViewDuration(device, VISIBLE_ENTRY_ID)
        Assert.assertNotNull("Second cycle duration should not be null", secondCycleDuration)
        Assert.assertTrue(
            "Second cycle duration should be >= 2000ms, got: ${secondCycleDuration}ms",
            secondCycleDuration!! >= 2000,
        )
        Assert.assertTrue(
            "New cycle duration should reset — expected < 4000ms but got ${secondCycleDuration}ms",
            secondCycleDuration < 4000,
        )
    }
}
