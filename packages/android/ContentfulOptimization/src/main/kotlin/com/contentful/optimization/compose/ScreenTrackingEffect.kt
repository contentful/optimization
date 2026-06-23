package com.contentful.optimization.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue

@Composable
public fun ScreenTrackingEffect(screenName: String) {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()

    LaunchedEffect(screenName, state.consent) {
        try {
            client.trackCurrentScreen(name = screenName)
        } catch (_: Exception) {
        }
    }
}
