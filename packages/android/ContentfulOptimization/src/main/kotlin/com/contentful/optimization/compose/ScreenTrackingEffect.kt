package com.contentful.optimization.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import com.contentful.optimization.tracking.ScreenTrackingState

@Composable
fun ScreenTrackingEffect(screenName: String) {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()
    val trackingAllowed = state.consent == true || client.hasConsent("screen")
    val trackingState = remember(client) { ScreenTrackingState() }

    LaunchedEffect(screenName, trackingAllowed) {
        if (!trackingState.shouldTrack(screenName, trackingAllowed)) return@LaunchedEffect

        trackingState.markInFlight(screenName)
        try {
            if (client.screenWithEmissionResult(name = screenName).accepted) {
                trackingState.markAccepted(screenName)
            }
        } catch (_: Exception) {
        } finally {
            trackingState.clearInFlight(screenName)
        }
    }
}
