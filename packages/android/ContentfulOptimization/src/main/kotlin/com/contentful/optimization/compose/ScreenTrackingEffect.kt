package com.contentful.optimization.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect

@Composable
fun ScreenTrackingEffect(screenName: String) {
    val client = LocalOptimizationClient.current
    LaunchedEffect(screenName) {
        try {
            client.screen(name = screenName)
        } catch (_: Exception) {
        }
    }
}
