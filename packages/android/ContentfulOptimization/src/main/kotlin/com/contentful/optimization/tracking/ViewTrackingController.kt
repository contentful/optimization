package com.contentful.optimization.tracking

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

        val visibleTop = maxOf(elementY, scrollY)
        val visibleBottom = minOf(elementY + elementHeight, scrollY + viewportHeight)
        val visibleHeight = maxOf(0f, visibleBottom - visibleTop)
        val visibilityRatio = visibleHeight / elementHeight

        val nowVisible = visibilityRatio >= threshold

        if (nowVisible && !isVisible) {
            onBecameVisible()
        } else if (!nowVisible && isVisible) {
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
        isVisible = false
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
        scope.launch {
            try {
                client.trackView(payload)
            } catch (_: Exception) {
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
