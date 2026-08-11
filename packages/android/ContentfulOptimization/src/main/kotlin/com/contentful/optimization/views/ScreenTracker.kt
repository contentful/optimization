package com.contentful.optimization.views

import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.core.OptimizationState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
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
 * Calls made before the client is initialized and operational failures are ignored — same
 * fail-soft contract as the Compose `ScreenTrackingEffect`. Call again from the next visible
 * lifecycle callback after initialization; pre-initialization calls are not deferred.
 */
public object ScreenTracker {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var currentScreenName: String? = null
    private var observedClient: OptimizationClient? = null
    private var stateJob: Job? = null

    fun trackScreen(name: String) {
        scope.launch {
            try {
                val client = OptimizationManager.client
                if (!installScreenTrackingObserverIfReady(client.isInitialized.value) {
                    currentScreenName = name
                    observeConsent(client)
                }) return@launch
                trackCurrentScreen(client)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
            }
        }
    }

    internal fun resetForTesting() {
        stateJob?.cancel()
        stateJob = null
        observedClient = null
        currentScreenName = null
    }

    private fun observeConsent(client: OptimizationClient) {
        if (observedClient === client && stateJob?.isActive == true) return

        stateJob?.cancel()
        observedClient = client
        stateJob = scope.launch {
            observeScreenTrackingConsent(client.state) {
                trackCurrentScreen(client)
            }
        }
    }

    private suspend fun trackCurrentScreen(client: OptimizationClient) {
        val screenName = currentScreenName ?: return
        client.trackCurrentScreen(name = screenName)
    }
}

internal inline fun installScreenTrackingObserverIfReady(
    isInitialized: Boolean,
    installObserver: () -> Unit,
): Boolean {
    if (!isInitialized) return false
    installObserver()
    return true
}

internal suspend fun observeScreenTrackingConsent(
    state: Flow<OptimizationState>,
    trackCurrentScreen: suspend () -> Unit,
) {
    state.map { it.consent }
        .distinctUntilChanged()
        .collect {
            try {
                trackCurrentScreen()
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
            }
        }
}
