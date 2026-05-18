package com.contentful.optimization.compose

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.tracking.ViewTrackingController

@Composable
fun Modifier.trackViews(
    entry: Map<String, Any>,
    personalization: Map<String, Any>?,
    threshold: Double,
    viewTimeMs: Int,
    viewDurationUpdateIntervalMs: Int,
    enabled: Boolean,
    client: OptimizationClient,
): Modifier {
    if (!enabled) return this

    val scrollContext = LocalScrollContext.current
    val controller = remember(entry, personalization) {
        ViewTrackingController(
            client = client,
            entry = entry,
            personalization = personalization,
            threshold = threshold,
            viewTimeMs = viewTimeMs,
            viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs,
        )
    }

    DisposableEffect(controller) {
        onDispose {
            controller.onDisappear()
            controller.destroy()
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
