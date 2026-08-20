package com.contentful.optimization.tracking

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.testing.TestLifecycleOwner
import com.contentful.optimization.core.TrackViewPayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [ViewTrackingController]'s dwell state machine. Drives the controller with
 * synthetic visibility geometry and a virtual clock via `kotlinx-coroutines-test`'s `TestScope`,
 * so timing is fully deterministic — no emulator, no scroll animation, no JS bridge.
 *
 * These tests use `advanceTimeBy(N)` followed by `runCurrent()` to step the virtual clock by a
 * known interval and drain the tasks that became eligible at the new time.
 *
 * This is the right layer for the dwell contract. The E2E `@Test` methods that previously
 * asserted on `component-stats-<id>` resource ids after a real swipe were conflating three
 * independent concerns (scrolling, demo-app analytics rendering, and tracker firing) and were
 * intolerant of the real layout/swipe timing on the x86_64 CI emulator. They have been deleted
 * — see `implementations/android-sdk/uitests/README.md` for the catalogue and rationale.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ViewTrackingControllerTest {

    @Test
    fun `becoming visible at the fixed ratio and dwelling for one second fires trackView once with the entry's componentId`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
        )

        // Exactly 10px of a 100px entry is visible: ratio = 0.1 (the fixed threshold).
        controller.updateVisibility(elementY = 0f, elementHeight = 100f, scrollY = 0f, viewportHeight = 10f)
        // Step the clock by the fixed 1000 ms dwell and drain.
        advanceTimeBy(1_000L)
        runCurrent()

        assertEquals("expected exactly one trackView call", 1, recorded.size)
        assertEquals(TEST_ENTRY_ID, recorded.single().componentId)
        assertEquals(0, recorded.single().variantIndex)
        assertEquals(1_000, recorded.single().viewDurationMs)

        cleanup(controller)
    }

    @Test
    fun `becoming invisible before the fixed dwell emits no event and resets the cycle`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
        )

        // Become visible at ratio = 1.0
        controller.updateVisibility(0f, 100f, 0f, 100f)
        // 500ms of dwell — still under the fixed 1000 ms requirement.
        advanceTimeBy(500L)
        runCurrent()
        // Ratio drops below the fixed threshold (mimic the views CI swipe-during-dwell race)
        controller.updateVisibility(0f, 100f, 96f, 100f) // visible portion 4 -> ratio 0.04
        runCurrent()
        // Advance past where the original dwell would have fired, to prove the cycle was reset.
        advanceTimeBy(1_001L)
        runCurrent()

        assertTrue(
            "expected no trackView calls when dwell was interrupted, got $recorded",
            recorded.isEmpty(),
        )
        assertEquals(false, controller.isVisible)

        cleanup(controller)
    }

    @Test
    fun `becoming invisible after the start event emits exactly one final event with the same view id`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
        )

        // Fully visible -> first emit after the fixed 1000 ms dwell.
        controller.updateVisibility(0f, 100f, 0f, 200f)
        advanceTimeBy(1_000L)
        runCurrent()
        assertEquals("start event", 1, recorded.size)

        // Dwell another 1000ms while still visible
        advanceTimeBy(1_000L)
        runCurrent()
        // Now become invisible — the qualified session emits its final event.
        controller.updateVisibility(0f, 100f, 95f, 200f) // ratio 0.05
        runCurrent()
        // Repeating the same invisible geometry must not emit another final event.
        controller.updateVisibility(0f, 100f, 95f, 200f)
        runCurrent()

        assertEquals("expected initial emit + final emit", 2, recorded.size)
        assertEquals(1_000, recorded.first().viewDurationMs)
        assertEquals(2_000, recorded.last().viewDurationMs)
        assertEquals(recorded.first().viewId, recorded.last().viewId)

        cleanup(controller)
    }

    @Test
    fun `sticky view payloads include a stable per-controller sticky tracking key`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
            selectedOptimization = mapOf(
                "experienceId" to "exp-1",
                "variantIndex" to 1,
                "sticky" to true,
            ),
        )

        controller.updateVisibility(0f, 100f, 0f, 200f)
        advanceTimeBy(1_000L)
        runCurrent()
        advanceTimeBy(1_000L)
        runCurrent()
        controller.onDisappear()
        runCurrent()
        controller.onDisappear()
        runCurrent()

        assertEquals(2, recorded.size)
        assertEquals(true, recorded[0].sticky)
        assertEquals(true, recorded[1].sticky)
        assertTrue(recorded[0].stickyTrackingKey?.isNotBlank() == true)
        assertEquals(recorded[0].stickyTrackingKey, recorded[1].stickyTrackingKey)
        assertEquals(recorded[0].viewId, recorded[1].viewId)
        assertEquals(1_000, recorded[0].viewDurationMs)
        assertEquals(2_000, recorded[1].viewDurationMs)

        cleanup(controller)
    }

    @Test
    fun `onPause emits one final event and onResume starts a fresh cycle from stored geometry`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val testLifecycleOwner = TestLifecycleOwner(
            initialState = Lifecycle.State.RESUMED,
            coroutineDispatcher = UnconfinedTestDispatcher(testScheduler),
        )
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
            lifecycleOwner = testLifecycleOwner,
        )

        controller.updateVisibility(0f, 100f, 0f, 200f)
        advanceTimeBy(1_000L)
        runCurrent()
        assertEquals("start event", 1, recorded.size)
        val backgroundedViewId = recorded.single().viewId

        advanceTimeBy(500L)
        runCurrent()

        // The UI owner pauses promptly -> onPause emits the final event and resets the cycle.
        testLifecycleOwner.currentState = Lifecycle.State.STARTED
        runCurrent()
        assertEquals(false, controller.isVisible)
        assertEquals(2, recorded.size)
        assertEquals(backgroundedViewId, recorded.last().viewId)
        assertEquals(1_500, recorded.last().viewDurationMs)

        // The UI owner resumes -> onResume re-evaluates last known geometry (still ratio=1.0).
        testLifecycleOwner.currentState = Lifecycle.State.RESUMED
        runCurrent()
        assertEquals(true, controller.isVisible)

        // After the fixed post-resume dwell, a new session emits its start event.
        advanceTimeBy(1_000L)
        runCurrent()
        assertEquals(3, recorded.size)
        assertTrue(recorded.last().viewId != backgroundedViewId)

        cleanup(controller)
    }

    @Test
    fun `onPause before the dwell cancels qualification until a fresh resumed cycle`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val testLifecycleOwner = TestLifecycleOwner(
            initialState = Lifecycle.State.RESUMED,
            coroutineDispatcher = UnconfinedTestDispatcher(testScheduler),
        )
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
            lifecycleOwner = testLifecycleOwner,
        )

        controller.updateVisibility(0f, 100f, 0f, 200f)
        advanceTimeBy(500L)
        runCurrent()

        // A UI lifecycle pause arrives immediately instead of waiting for a delayed process callback.
        testLifecycleOwner.currentState = Lifecycle.State.STARTED
        runCurrent()
        assertEquals(false, controller.isVisible)

        // A layout callback after onPause may refresh geometry but cannot restart qualification.
        controller.updateVisibility(0f, 100f, 0f, 200f)
        assertEquals(false, controller.isVisible)

        advanceTimeBy(1_000L)
        runCurrent()
        assertTrue("the cancelled sub-dwell cycle must not emit", recorded.isEmpty())

        testLifecycleOwner.currentState = Lifecycle.State.RESUMED
        runCurrent()
        assertEquals(true, controller.isVisible)

        advanceTimeBy(1_000L)
        runCurrent()
        assertEquals("the resumed cycle qualifies independently", 1, recorded.size)
        assertEquals(1_000, recorded.single().viewDurationMs)

        cleanup(controller)
    }

    @Test
    fun `reevaluating after tracking becomes allowed starts a fresh visible cycle from last geometry`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        var trackingAllowed = false
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            isTrackingAllowed = { trackingAllowed },
            clock = { testScheduler.currentTime },
        )

        controller.updateVisibility(0f, 100f, 0f, 200f)
        advanceTimeBy(1_000L)
        runCurrent()

        assertEquals(false, controller.isVisible)
        assertTrue("expected no pre-consent trackView calls, got $recorded", recorded.isEmpty())

        trackingAllowed = true
        controller.reevaluateVisibility()

        assertEquals(true, controller.isVisible)

        advanceTimeBy(1_000L)
        runCurrent()

        assertEquals("expected one post-consent current-visibility event", 1, recorded.size)
        assertEquals(TEST_ENTRY_ID, recorded.single().componentId)

        cleanup(controller)
    }

    /** A partially clipped entry remains visible when its ratio stays above the fixed threshold. */
    @Test
    fun `regression - ratio dip from 1_00 to 0_54 preserves the cycle and allows emit`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
        )

        // Initial state matches CI artifact: BECAME_VISIBLE ratio=1.00 h=164 vh=164
        controller.updateVisibility(elementY = 0f, elementHeight = 164f, scrollY = 0f, viewportHeight = 164f)
        assertEquals(true, controller.isVisible)

        // Half of the fixed dwell elapses.
        advanceTimeBy(500L)
        runCurrent()
        assertTrue("no emit while dwell in progress", recorded.isEmpty())

        // Layout race: rich text resolves -> h grows from 164 to 207; mid-swipe -> vh shrinks to 112.
        // Computed ratio: visibleHeight=112 / elementHeight=207 = 0.541 (matches CI log).
        controller.updateVisibility(elementY = 0f, elementHeight = 207f, scrollY = 95f, viewportHeight = 207f)
        runCurrent()
        // visibleTop=max(0,95)=95, visibleBottom=min(207,302)=207, visibleHeight=112, ratio=0.541
        assertEquals("ratio above the fixed 0.1 threshold remains visible",
            true, controller.isVisible)

        // Finish the original cycle's dwell and prove the timer was preserved.
        advanceTimeBy(501L)
        runCurrent()
        assertEquals("expected one emit from the preserved cycle", 1, recorded.size)

        cleanup(controller)
    }

    // --- helpers ---

    /**
     * Tear down the controller and any pending dwell or event coroutines it launched into the
     * [TestScope].
     */
    private fun TestScope.cleanup(controller: ViewTrackingController) {
        controller.destroy()
        coroutineContext.cancelChildren()
        runCurrent()
    }

    private fun TestScope.makeController(
        scope: CoroutineScope,
        onTrackView: suspend (TrackViewPayload) -> Unit,
        clock: () -> Long,
        entry: Map<String, Any> = mapOf("sys" to mapOf("id" to TEST_ENTRY_ID)),
        selectedOptimization: Map<String, Any>? = null,
        isTrackingAllowed: () -> Boolean = { true },
        lifecycleOwner: LifecycleOwner = TestLifecycleOwner(
            initialState = Lifecycle.State.RESUMED,
            coroutineDispatcher = UnconfinedTestDispatcher(testScheduler),
        ),
    ): ViewTrackingController = ViewTrackingController(
        entry = entry,
        selectedOptimization = selectedOptimization,
        onTrackView = onTrackView,
        isTrackingAllowed = isTrackingAllowed,
        scope = scope,
        lifecycleOwner = lifecycleOwner,
        clock = clock,
    )

    companion object {
        private const val TEST_ENTRY_ID = "1MwiFl4z7gkwqGYdvCmr8c"
    }
}
