package com.contentful.optimization.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.core.OptimizationConfig

@Composable
fun OptimizationRoot(
    config: OptimizationConfig,
    trackViews: Boolean = true,
    trackTaps: Boolean = false,
    liveUpdates: Boolean = false,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val client = remember { OptimizationClient(context.applicationContext) }
    val isInitialized by client.isInitialized.collectAsState()

    LaunchedEffect(Unit) {
        client.initialize(config)
    }

    CompositionLocalProvider(
        LocalOptimizationClient provides client,
        LocalTrackingConfig provides TrackingConfig(
            trackViews = trackViews,
            trackTaps = trackTaps,
            liveUpdates = liveUpdates,
        ),
    ) {
        if (isInitialized) {
            content()
        } else {
            Box(modifier = modifier, contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
    }
}
