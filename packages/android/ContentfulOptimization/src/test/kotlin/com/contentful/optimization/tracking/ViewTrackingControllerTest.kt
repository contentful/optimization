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
 * Note on test driving primitives: the controller's `scheduleNextFire` re-arms a new timer
 * coroutine after each emit, so `advanceUntilIdle` would never reach "idle" while the entry is
 * visible. These tests use `advanceTimeBy(N)` followed by `runCurrent()` to step the virtual
 * clock by a known interval and drain only the tasks that became eligible at the new time.
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
    fun `becoming visible at ratio above minVisibleRatio and dwelling dwellTimeMs fires trackView once with the entry's componentId`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
        )

        // Entry fully visible: h=100, vh=200 -> ratio = 1.0 (>= minVisibleRatio)
        controller.updateVisibility(elementY = 0f, elementHeight = 100f, scrollY = 0f, viewportHeight = 200f)
        // Step the clock by dwellTimeMs (default 2000) and drain.
        advanceTimeBy(2_001L)
        runCurrent()

        assertEquals("expected exactly one trackView call", 1, recorded.size)
        assertEquals(TEST_ENTRY_ID, recorded.single().componentId)
        assertEquals(0, recorded.single().variantIndex)

        cleanup(controller)
    }

    @Test
    fun `becoming invisible BEFORE dwellTimeMs with attempts equals zero emits NO event and resets the cycle`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
        )

        // Become visible at ratio = 1.0
        controller.updateVisibility(0f, 100f, 0f, 100f)
        // 1s of dwell — still under dwellTimeMs (2000)
        advanceTimeBy(1_000L)
        runCurrent()
        // Ratio drops below minVisibleRatio (mimic the views CI swipe-during-dwell race)
        controller.updateVisibility(0f, 100f, 60f, 100f) // visible portion 40 -> ratio 0.4
        runCurrent()
        // Advance past where the original dwell would have fired, to prove the cycle was reset.
        advanceTimeBy(2_001L)
        runCurrent()

        assertTrue(
            "expected no trackView calls when dwell was interrupted at attempts=0, got $recorded",
            recorded.isEmpty(),
        )
        assertEquals(false, controller.isVisible)

        cleanup(controller)
    }

    @Test
    fun `becoming invisible AFTER first emit (attempts greater than zero) fires a final event with the accumulated duration`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
        )

        // Fully visible -> first emit at dwellTimeMs (2000)
        controller.updateVisibility(0f, 100f, 0f, 200f)
        advanceTimeBy(2_001L)
        runCurrent()
        assertEquals("first attempt emit", 1, recorded.size)

        // Dwell another 1000ms while still visible
        advanceTimeBy(1_000L)
        runCurrent()
        // Now become invisible — attempts > 0 path fires a final event
        controller.updateVisibility(0f, 100f, 80f, 200f) // ratio 0.2
        runCurrent()

        assertEquals("expected initial emit + final emit", 2, recorded.size)
        val finalDuration = recorded.last().viewDurationMs
        assertTrue(
            "expected final viewDurationMs to include the 3s of visibility, got $finalDuration",
            finalDuration >= 3_000,
        )

        cleanup(controller)
    }

    @Test
    fun `subsequent timer firings follow the dwellTimeMs then viewDurationUpdateIntervalMs cadence`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
            dwellTimeMs = 2_000,
            viewDurationUpdateIntervalMs = 5_000,
        )

        controller.updateVisibility(0f, 100f, 0f, 200f)

        // First emit at dwellTimeMs (2_000)
        advanceTimeBy(2_001L)
        runCurrent()
        assertEquals(1, recorded.size)

        // Second emit at dwellTimeMs + viewDurationUpdateIntervalMs (7_000)
        advanceTimeBy(5_000L)
        runCurrent()
        assertEquals(2, recorded.size)

        // Third emit at dwellTimeMs + 2 * viewDurationUpdateIntervalMs (12_000)
        advanceTimeBy(5_000L)
        runCurrent()
        assertEquals(3, recorded.size)

        recorded.forEach { payload ->
            assertEquals("all emits should share the same componentId", TEST_ENTRY_ID, payload.componentId)
        }
        val viewIds = recorded.map { it.viewId }.distinct()
        assertEquals("all emits in a single visibility cycle share the same viewId", 1, viewIds.size)

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
            dwellTimeMs = 2_000,
            viewDurationUpdateIntervalMs = 5_000,
        )

        controller.updateVisibility(0f, 100f, 0f, 200f)
        advanceTimeBy(2_001L)
        runCurrent()
        advanceTimeBy(5_000L)
        runCurrent()

        assertEquals(2, recorded.size)
        assertEquals(true, recorded[0].sticky)
        assertEquals(true, recorded[1].sticky)
        assertTrue(recorded[0].stickyTrackingKey?.isNotBlank() == true)
        assertEquals(recorded[0].stickyTrackingKey, recorded[1].stickyTrackingKey)

        cleanup(controller)
    }

    @Test
    fun `onStop pauses accumulation and onStart re-evaluates from last known geometry`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val testLifecycleOwner = TestLifecycleOwner(
            initialState = Lifecycle.State.STARTED,
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

        // App backgrounded -> pause should be called via DefaultLifecycleObserver.onStop
        testLifecycleOwner.currentState = Lifecycle.State.CREATED
        runCurrent()
        assertEquals(false, controller.isVisible)
        assertTrue("no emit yet (attempts was 0)", recorded.isEmpty())

        // App foregrounded -> resume re-evaluates last known geometry (still ratio=1.0)
        testLifecycleOwner.currentState = Lifecycle.State.STARTED
        runCurrent()
        assertEquals(true, controller.isVisible)

        // After full dwellTimeMs of post-resume dwell, emit fires
        advanceTimeBy(2_001L)
        runCurrent()
        assertEquals(1, recorded.size)

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
        advanceTimeBy(2_001L)
        runCurrent()

        assertEquals(false, controller.isVisible)
        assertTrue("expected no pre-consent trackView calls, got $recorded", recorded.isEmpty())

        trackingAllowed = true
        controller.reevaluateVisibility()

        assertEquals(true, controller.isVisible)

        advanceTimeBy(2_001L)
        runCurrent()

        assertEquals("expected one post-consent current-visibility event", 1, recorded.size)
        assertEquals(TEST_ENTRY_ID, recorded.single().componentId)

        cleanup(controller)
    }

    /**
     * Regression test pinning the current 0.8/0.8 symmetric minVisibleRatio behavior. This was the
     * shape of the failure on the views CI x86_64 emulator: at t≈+1s the test's
     * `scrollToElement` swipe clipped the merge-tag entry to ratio≈0.54 (above 0.4, below 0.8),
     * `onBecameInvisible` fired with `attempts=0`, `resetCycle()` wiped the dwell, and the
     * 2s timer never reached `emitEvent`. If we later add hysteresis (e.g., enter at 0.8, exit
     * at 0.4 — see plan `out of scope` section), this assertion will flip and the test must be
     * updated to reflect the new contract.
     */
    @Test
    fun `regression - ratio dip from 1_00 to 0_54 before dwellTimeMs resets the cycle and prevents emit`() = runTest {
        val recorded = mutableListOf<TrackViewPayload>()
        val controller = makeController(
            scope = this,
            onTrackView = { recorded.add(it) },
            clock = { testScheduler.currentTime },
        )

        // Initial state matches CI artifact: BECAME_VISIBLE ratio=1.00 h=164 vh=164
        controller.updateVisibility(elementY = 0f, elementHeight = 164f, scrollY = 0f, viewportHeight = 164f)
        assertEquals(true, controller.isVisible)

        // ~1s of dwell elapses
        advanceTimeBy(1_000L)
        runCurrent()
        assertTrue("no emit while dwell in progress", recorded.isEmpty())

        // Layout race: rich text resolves -> h grows from 164 to 207; mid-swipe -> vh shrinks to 112.
        // Computed ratio: visibleHeight=112 / elementHeight=207 = 0.541 (matches CI log).
        controller.updateVisibility(elementY = 0f, elementHeight = 207f, scrollY = 95f, viewportHeight = 207f)
        runCurrent()
        // visibleTop=max(0,95)=95, visibleBottom=min(207,302)=207, visibleHeight=112, ratio=0.541
        assertEquals("ratio below 0.8 with current symmetric minVisibleRatio transitions to invisible",
            false, controller.isVisible)

        // Step past where the original 2s timer would have fired, to prove the cycle stayed reset.
        advanceTimeBy(2_001L)
        runCurrent()
        assertTrue(
            "expected no emit because the cycle was reset at attempts=0, got $recorded",
            recorded.isEmpty(),
        )

        cleanup(controller)
    }

    // --- helpers ---

    /**
     * Tear down the controller and any pending coroutines it launched into the TestScope
     * (the next-attempt timer or in-flight emit). Without this, `runTest`'s end-of-test
     * "did the test body complete?" check trips because the controller's `scheduleNextFire`
     * unconditionally re-arms a fresh timer after every emit.
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
        minVisibleRatio: Double = 0.8,
        dwellTimeMs: Int = 2_000,
        viewDurationUpdateIntervalMs: Int = 5_000,
        lifecycleOwner: LifecycleOwner = TestLifecycleOwner(
            initialState = Lifecycle.State.STARTED,
            coroutineDispatcher = UnconfinedTestDispatcher(testScheduler),
        ),
    ): ViewTrackingController = ViewTrackingController(
        entry = entry,
        selectedOptimization = selectedOptimization,
        onTrackView = onTrackView,
        isTrackingAllowed = isTrackingAllowed,
        minVisibleRatio = minVisibleRatio,
        dwellTimeMs = dwellTimeMs,
        viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs,
        scope = scope,
        lifecycleOwner = lifecycleOwner,
        clock = clock,
    )

    companion object {
        private const val TEST_ENTRY_ID = "1MwiFl4z7gkwqGYdvCmr8c"
    }
}
