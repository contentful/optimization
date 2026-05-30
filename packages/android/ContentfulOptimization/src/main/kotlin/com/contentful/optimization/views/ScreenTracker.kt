package com.contentful.optimization.views

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
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

    fun trackScreen(name: String) {
        scope.launch {
            try {
                OptimizationManager.client.screen(name = name)
            } catch (_: Exception) {
            }
        }
    }
}
