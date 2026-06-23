package com.contentful.optimization.compose

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.tracking.ViewTrackingController

@Composable
public fun Modifier.trackViews(
    entry: Map<String, Any>,
    selectedOptimization: Map<String, Any>?,
    minVisibleRatio: Double,
    dwellTimeMs: Int,
    viewDurationUpdateIntervalMs: Int,
    enabled: Boolean,
    client: OptimizationClient,
): Modifier {
    val state by client.state.collectAsState()
    val trackingAllowed = state.consent == true || client.hasConsent("trackView")

    if (!enabled) return this

    val scrollContext = LocalScrollContext.current
    val controller = remember(entry, selectedOptimization) {
        ViewTrackingController(
            client = client,
            entry = entry,
            selectedOptimization = selectedOptimization,
            minVisibleRatio = minVisibleRatio,
            dwellTimeMs = dwellTimeMs,
            viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs,
        )
    }

    DisposableEffect(controller) {
        onDispose {
            controller.onDisappear()
            controller.destroy()
        }
    }

    LaunchedEffect(controller, trackingAllowed) {
        if (trackingAllowed) {
            controller.reevaluateVisibility()
        } else {
            controller.onDisappear()
        }
    }

    return this.onGloballyPositioned { coordinates ->
        updateControllerVisibility(controller, coordinates, scrollContext)
    }
}

private fun updateControllerVisibility(
    controller: ViewTrackingController,
    coordinates: LayoutCoordinates,
    scrollContext: ScrollContext?,
) {
    val posInRoot = coordinates.positionInRoot()
    val elementY = posInRoot.y
    val elementHeight = coordinates.size.height.toFloat()

    val vpHeight = scrollContext?.viewportHeight
        ?: (Resources.getSystem().displayMetrics.heightPixels.toFloat())

    controller.updateVisibility(
        elementY = elementY,
        elementHeight = elementHeight,
        scrollY = scrollContext?.scrollY ?: 0f,
        viewportHeight = vpHeight,
    )
}
