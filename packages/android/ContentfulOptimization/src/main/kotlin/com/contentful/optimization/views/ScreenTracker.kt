package com.contentful.optimization.views

import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.tracking.ScreenTrackingState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * View-based counterpart of [com.contentful.optimization.compose.ScreenTrackingEffect].
 *
 * Call from `Activity.onResume` or `Fragment.onResume` to emit a `screen` event with the given
 * name through the active [com.contentful.optimization.core.OptimizationClient]:
 *
 * ```kotlin
 * override fun onResume() {
 *     super.onResume()
 *     ScreenTracker.trackScreen("MainScreen")
 * }
 * ```
 *
 * Failures (including the client not yet being initialized) are swallowed — same contract as
 * the Compose `ScreenTrackingEffect`.
 */
object ScreenTracker {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val trackingState = ScreenTrackingState()
    private var currentScreenName: String? = null
    private var observedClient: OptimizationClient? = null
    private var stateJob: Job? = null

    fun trackScreen(name: String) {
        scope.launch {
            try {
                currentScreenName = name
                val client = OptimizationManager.client
                observeConsent(client)
                trackCurrentScreenIfAllowed(client)
            } catch (_: Exception) {
            }
        }
    }

    internal fun resetForTesting() {
        stateJob?.cancel()
        stateJob = null
        observedClient = null
        currentScreenName = null
        trackingState.reset()
    }

    private fun observeConsent(client: OptimizationClient) {
        if (observedClient === client && stateJob?.isActive == true) return

        stateJob?.cancel()
        observedClient = client
        stateJob = scope.launch {
            client.state.collect {
                trackCurrentScreenIfAllowed(client)
            }
        }
    }

    private suspend fun trackCurrentScreenIfAllowed(client: OptimizationClient) {
        val screenName = currentScreenName ?: return
        val trackingAllowed = client.getState().consent == true || client.hasConsent("screen")

        if (!trackingState.shouldTrack(screenName, trackingAllowed)) return

        trackingState.markInFlight(screenName)
        try {
            if (client.screenWithEmissionResult(name = screenName).accepted) {
                trackingState.markAccepted(screenName)
            }
        } finally {
            trackingState.clearInFlight(screenName)
        }
    }
}
