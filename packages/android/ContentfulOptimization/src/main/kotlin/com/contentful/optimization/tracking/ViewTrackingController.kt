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

class ViewTrackingController(
    private val client: OptimizationClient,
    entry: Map<String, Any>,
    personalization: Map<String, Any>?,
    private val threshold: Double = 0.8,
    private val viewTimeMs: Int = 2000,
    private val viewDurationUpdateIntervalMs: Int = 5000,
) : DefaultLifecycleObserver {

    var isVisible: Boolean = false
        private set

    private val metadata = TrackingMetadata(entry, personalization)
    private val scope = CoroutineScope(Dispatchers.Main)

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
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
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
        ProcessLifecycleOwner.get().lifecycle.removeObserver(this)
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
        visibleSinceMs = System.currentTimeMillis()
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
        accumulatedMs += (System.currentTimeMillis() - since).toDouble()
        visibleSinceMs = System.currentTimeMillis()
    }

    private fun pauseAccumulation() {
        val since = visibleSinceMs ?: return
        accumulatedMs += (System.currentTimeMillis() - since).toDouble()
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
                client.trackView(payload)
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
