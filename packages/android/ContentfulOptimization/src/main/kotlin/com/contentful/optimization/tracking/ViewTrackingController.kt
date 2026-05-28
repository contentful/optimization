package com.contentful.optimization.tracking

import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.core.TrackViewPayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * The primary constructor is `internal` so JVM unit tests can supply a controlled
 * [CoroutineScope] (typically a `kotlinx-coroutines-test` `TestScope`), a fake [LifecycleOwner]
 * (typically `TestLifecycleOwner`), a recording [onTrackView] sink, and a virtual [clock] without
 * dragging the full [OptimizationClient] (which requires a real `Context` for SharedPreferences
 * and a JNI-loaded QuickJS bridge) into the test target. The public secondary constructor below
 * preserves the prior `client: OptimizationClient` call shape used by [OptimizedEntryView]'s
 * `attachController` and the Compose `Modifier.trackViews` so production call sites are
 * unchanged. The dwell state machine (visibility threshold, 2s-then-5s timer cadence, attempts
 * counter, resetCycle on becoming-invisible-before-first-emit) lives entirely in this class
 * and is covered by `ViewTrackingControllerTest` in `src/test/`.
 */
class ViewTrackingController internal constructor(
    entry: Map<String, Any>,
    personalization: Map<String, Any>?,
    private val onTrackView: suspend (TrackViewPayload) -> Unit,
    private val threshold: Double = 0.8,
    private val viewTimeMs: Int = 2000,
    private val viewDurationUpdateIntervalMs: Int = 5000,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Main),
    private val lifecycleOwner: LifecycleOwner = ProcessLifecycleOwner.get(),
    private val clock: () -> Long = { System.currentTimeMillis() },
) : DefaultLifecycleObserver {

    /**
     * Production constructor used by `OptimizedEntryView` and `Modifier.trackViews`. Adapts the
     * concrete [OptimizationClient]'s `trackView` to the suspending sink the controller calls
     * through, and uses `Dispatchers.Main` + `ProcessLifecycleOwner` for the runtime defaults.
     */
    constructor(
        client: OptimizationClient,
        entry: Map<String, Any>,
        personalization: Map<String, Any>?,
        threshold: Double = 0.8,
        viewTimeMs: Int = 2000,
        viewDurationUpdateIntervalMs: Int = 5000,
    ) : this(
        entry = entry,
        personalization = personalization,
        onTrackView = { payload -> client.trackView(payload) },
        threshold = threshold,
        viewTimeMs = viewTimeMs,
        viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs,
    )

    var isVisible: Boolean = false
        private set

    private val metadata = TrackingMetadata(entry, personalization)

    private var viewId: String? = null
    private var visibleSinceMs: Long? = null
    private var accumulatedMs: Double = 0.0
    private var attempts: Int = 0
    private var timerJob: Job? = null

    // Last known visibility geometry, for re-evaluation after resume.
    private var lastElementY: Float = 0f
    private var lastElementHeight: Float = 0f
    private var lastScrollY: Float = 0f
    private var lastViewportHeight: Float = 0f

    init {
        lifecycleOwner.lifecycle.addObserver(this)
    }

    fun updateVisibility(
        elementY: Float,
        elementHeight: Float,
        scrollY: Float,
        viewportHeight: Float,
    ) {
        if (elementHeight <= 0f) return

        lastElementY = elementY
        lastElementHeight = elementHeight
        lastScrollY = scrollY
        lastViewportHeight = viewportHeight

        val visibleTop = maxOf(elementY, scrollY)
        val visibleBottom = minOf(elementY + elementHeight, scrollY + viewportHeight)
        val visibleHeight = maxOf(0f, visibleBottom - visibleTop)
        val visibilityRatio = visibleHeight / elementHeight

        val nowVisible = visibilityRatio >= threshold

        if (nowVisible && !isVisible) {
            Log.d(
                "ViewTracking",
                "componentId=${metadata.componentId} BECAME_VISIBLE " +
                    "ratio=${"%.2f".format(visibilityRatio)} h=$elementHeight vh=$visibleHeight",
            )
            onBecameVisible()
        } else if (!nowVisible && isVisible) {
            Log.d(
                "ViewTracking",
                "componentId=${metadata.componentId} BECAME_INVISIBLE " +
                    "ratio=${"%.2f".format(visibilityRatio)} h=$elementHeight vh=$visibleHeight attempts=$attempts",
            )
            onBecameInvisible()
        }
    }

    fun onDisappear() {
        if (isVisible) {
            onBecameInvisible()
        }
    }

    fun destroy() {
        timerJob?.cancel()
        timerJob = null
        lifecycleOwner.lifecycle.removeObserver(this)
    }

    override fun onStop(owner: LifecycleOwner) {
        pause()
    }

    override fun onStart(owner: LifecycleOwner) {
        resume()
    }

    private fun pause() {
        pauseAccumulation()
        timerJob?.cancel()
        timerJob = null
        if (attempts > 0) {
            emitEvent()
        }
        isVisible = false
        resetCycle()
    }

    private fun resume() {
        // Re-evaluate visibility from the last known geometry so a still-visible
        // element starts a fresh cycle without waiting for a scroll callback
        // (which may never fire after foregrounding). Mirrors iOS `resume()`.
        isVisible = false
        updateVisibility(lastElementY, lastElementHeight, lastScrollY, lastViewportHeight)
    }

    private fun onBecameVisible() {
        isVisible = true
        viewId = UUID.randomUUID().toString()
        visibleSinceMs = clock()
        accumulatedMs = 0.0
        attempts = 0
        scheduleNextFire()
    }

    private fun onBecameInvisible() {
        isVisible = false
        timerJob?.cancel()
        timerJob = null
        flushAccumulatedTime()
        if (attempts > 0) {
            emitEvent()
        }
        resetCycle()
    }

    private fun flushAccumulatedTime() {
        val since = visibleSinceMs ?: return
        accumulatedMs += (clock() - since).toDouble()
        visibleSinceMs = clock()
    }

    private fun pauseAccumulation() {
        val since = visibleSinceMs ?: return
        accumulatedMs += (clock() - since).toDouble()
        visibleSinceMs = null
    }

    private fun scheduleNextFire() {
        flushAccumulatedTime()
        val requiredMs = viewTimeMs.toDouble() + attempts.toDouble() * viewDurationUpdateIntervalMs.toDouble()
        val remainingMs = maxOf(0.0, requiredMs - accumulatedMs)

        timerJob?.cancel()
        timerJob = scope.launch {
            delay(remainingMs.toLong())
            timerFired()
        }
    }

    private fun timerFired() {
        flushAccumulatedTime()
        emitEvent()
        attempts += 1
        scheduleNextFire()
    }

    private fun emitEvent() {
        val currentViewId = viewId ?: return
        val payload = TrackViewPayload(
            componentId = metadata.componentId,
            viewId = currentViewId,
            experienceId = metadata.experienceId,
            variantIndex = metadata.variantIndex,
            viewDurationMs = accumulatedMs.toInt(),
            sticky = metadata.sticky,
        )
        Log.i(
            "ViewTracking",
            "EMIT componentId=${metadata.componentId} duration=${accumulatedMs.toInt()}ms attempt=$attempts",
        )
        scope.launch {
            try {
                onTrackView(payload)
            } catch (e: Exception) {
                Log.w(
                    "ViewTracking",
                    "trackView failed componentId=${metadata.componentId}: ${e.javaClass.simpleName}: ${e.message}",
                )
            }
        }
    }

    private fun resetCycle() {
        viewId = null
        visibleSinceMs = null
        accumulatedMs = 0.0
        attempts = 0
    }
}
