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
import com.contentful.optimization.preview.PreviewPanelConfig
import com.contentful.optimization.preview.PreviewPanelOverlay

/**
 * Top-level composable that initializes the [OptimizationClient] and provides it to descendant
 * `OptimizedEntry` composables.
 *
 * Pass a [PreviewPanelConfig] to add the debug preview panel without manually wrapping content
 * in [PreviewPanelOverlay].
 *
 * @param previewPanel Optional preview panel configuration. When provided with `enabled = true`,
 *   the preview panel is available via a floating action button.
 * @param trackViews Global default for entry view tracking. Defaults to `true`.
 * @param trackTaps Global default for entry tap tracking. Defaults to `true`.
 */
@Composable
public fun OptimizationRoot(
    config: OptimizationConfig,
    trackViews: Boolean = true,
    trackTaps: Boolean = true,
    liveUpdates: Boolean = false,
    previewPanel: PreviewPanelConfig? = null,
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
            if (previewPanel != null && previewPanel.enabled) {
                PreviewPanelOverlay(contentfulClient = previewPanel.contentfulClient) {
                    content()
                }
            } else {
                content()
            }
        } else {
            Box(modifier = modifier, contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
    }
}
