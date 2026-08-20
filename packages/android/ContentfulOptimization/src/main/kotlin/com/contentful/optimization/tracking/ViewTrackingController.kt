package com.contentful.optimization.tracking

import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
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

internal const val VIEW_TRACKING_LOG_TAG = "ViewTracking"
internal const val VIEW_TRACKING_MIN_VISIBLE_RATIO = 0.1
internal const val VIEW_TRACKING_DWELL_TIME_MS = 1_000

/**
 * The primary constructor is `internal` so JVM unit tests can supply a controlled
 * [CoroutineScope] (typically a `kotlinx-coroutines-test` `TestScope`), a fake [LifecycleOwner]
 * (typically `TestLifecycleOwner`), a recording [onTrackView] sink, and a virtual [clock] without
 * dragging the full [OptimizationClient] (which requires a real `Context` for SharedPreferences
 * and a JNI-loaded QuickJS bridge) into the test target. The secondary constructor preserves the
 * `client: OptimizationClient` call shape used internally by [OptimizedEntryView]'s
 * `attachController` and the Compose `Modifier.trackViews`. The dwell state machine (minimum
 * visible ratio, initial event after one second, one final event when a qualified view ends, and
 * reset on becoming invisible before the initial event) lives entirely in this class and is
 * covered by `ViewTrackingControllerTest` in `src/test/`. The visibility ratio and dwell time are
 * fixed by the SDK.
 */
internal class ViewTrackingController internal constructor(
    entry: Map<String, Any>,
    selectedOptimization: Map<String, Any>?,
    private val onTrackView: suspend (TrackViewPayload) -> Unit,
    private val isTrackingAllowed: () -> Boolean = { true },
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Main),
    private val lifecycleOwner: LifecycleOwner = ProcessLifecycleOwner.get(),
    private val clock: () -> Long = { System.currentTimeMillis() },
    optimizationContextId: String? = null,
) : DefaultLifecycleObserver {

    /**
     * Production constructor used by `OptimizedEntryView` and `Modifier.trackViews`. Adapts the
     * concrete [OptimizationClient]'s `trackView` to the suspending sink the controller calls
     * through, and uses `Dispatchers.Main` plus the supplied UI lifecycle owner. The process
     * lifecycle remains the fallback for callers without a view-tree owner.
     */
    constructor(
        client: OptimizationClient,
        entry: Map<String, Any>,
        selectedOptimization: Map<String, Any>?,
        optimizationContextId: String? = null,
        lifecycleOwner: LifecycleOwner = ProcessLifecycleOwner.get(),
    ) : this(
        entry = entry,
        optimizationContextId = optimizationContextId,
        selectedOptimization = selectedOptimization,
        onTrackView = { payload -> client.trackView(payload) },
        isTrackingAllowed = { client.hasConsent("trackView") },
        lifecycleOwner = lifecycleOwner,
    )

    var isVisible: Boolean = false
        private set

    private val metadata = TrackingMetadata(entry, selectedOptimization, optimizationContextId)

    private var viewId: String? = null
    private var visibleSinceMs: Long? = null
    private var accumulatedMs: Double = 0.0
    private var hasEmittedStart: Boolean = false
    private var timerJob: Job? = null
    private val stickyTrackingKey: String = UUID.randomUUID().toString()

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

        if (!lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
            if (isVisible) {
                onBecameInvisible()
            }
            return
        }

        if (!isTrackingAllowed()) {
            if (isVisible) {
                onBecameInvisible()
            }
            return
        }

        val visibleTop = maxOf(elementY, scrollY)
        val visibleBottom = minOf(elementY + elementHeight, scrollY + viewportHeight)
        val visibleHeight = maxOf(0f, visibleBottom - visibleTop)
        val visibilityRatio = visibleHeight / elementHeight

        val nowVisible = visibilityRatio >= VIEW_TRACKING_MIN_VISIBLE_RATIO

        if (nowVisible && !isVisible) {
            trackingLog {
                "componentId=${metadata.componentId} BECAME_VISIBLE " +
                    "ratio=${"%.2f".format(visibilityRatio)} h=$elementHeight vh=$visibleHeight"
            }
            onBecameVisible()
        } else if (!nowVisible && isVisible) {
            trackingLog {
                "componentId=${metadata.componentId} BECAME_INVISIBLE " +
                    "ratio=${"%.2f".format(visibilityRatio)} h=$elementHeight vh=$visibleHeight " +
                    "hasEmittedStart=$hasEmittedStart"
            }
            onBecameInvisible()
        }
    }

    fun reevaluateVisibility() {
        updateVisibility(lastElementY, lastElementHeight, lastScrollY, lastViewportHeight)
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

    override fun onPause(owner: LifecycleOwner) {
        pause()
    }

    override fun onResume(owner: LifecycleOwner) {
        resume()
    }

    private fun pause() {
        pauseAccumulation()
        timerJob?.cancel()
        timerJob = null
        if (hasEmittedStart) {
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
        hasEmittedStart = false
        scheduleStartEvent()
    }

    private fun onBecameInvisible() {
        isVisible = false
        timerJob?.cancel()
        timerJob = null
        flushAccumulatedTime()
        if (hasEmittedStart) {
            emitEvent()
        }
        resetCycle()
    }

    private fun flushAccumulatedTime() {
        val since = visibleSinceMs ?: return
        val now = clock()
        accumulatedMs += (now - since).toDouble()
        visibleSinceMs = now
    }

    private fun pauseAccumulation() {
        val since = visibleSinceMs ?: return
        accumulatedMs += (clock() - since).toDouble()
        visibleSinceMs = null
    }

    private fun scheduleStartEvent() {
        timerJob?.cancel()
        timerJob = scope.launch {
            delay(VIEW_TRACKING_DWELL_TIME_MS.toLong())
            timerFired()
        }
    }

    private fun timerFired() {
        timerJob = null
        flushAccumulatedTime()
        hasEmittedStart = emitEvent()
    }

    private fun emitEvent(): Boolean {
        if (!isTrackingAllowed()) return false

        val currentViewId = viewId ?: return false
        val payload = TrackViewPayload(
            componentId = metadata.componentId,
            viewId = currentViewId,
            experienceId = metadata.experienceId,
            optimizationContextId = metadata.optimizationContextId,
            variantIndex = metadata.variantIndex,
            viewDurationMs = accumulatedMs.toInt(),
            sticky = metadata.sticky,
            stickyTrackingKey = stickyTrackingKey,
        )
        trackingLog {
            val phase = if (hasEmittedStart) "final" else "start"
            "EMIT componentId=${metadata.componentId} duration=${accumulatedMs.toInt()}ms phase=$phase"
        }
        scope.launch {
            try {
                onTrackView(payload)
            } catch (e: Exception) {
                Log.w(
                    VIEW_TRACKING_LOG_TAG,
                    "trackView failed componentId=${metadata.componentId}: ${e.javaClass.simpleName}: ${e.message}",
                )
            }
        }
        return true
    }

    private fun resetCycle() {
        viewId = null
        visibleSinceMs = null
        accumulatedMs = 0.0
        hasEmittedStart = false
    }
}

private inline fun trackingLog(message: () -> String) {
    if (Log.isLoggable(VIEW_TRACKING_LOG_TAG, Log.DEBUG)) {
        Log.d(VIEW_TRACKING_LOG_TAG, message())
    }
}
