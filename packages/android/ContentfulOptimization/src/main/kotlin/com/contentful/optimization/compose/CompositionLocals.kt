package com.contentful.optimization.compose

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
import com.contentful.optimization.core.OptimizationClient

public val LocalOptimizationClient = staticCompositionLocalOf<OptimizationClient> {
    error("No OptimizationClient provided. Wrap your content in OptimizationRoot.")
}

public data class TrackingConfig(
    val trackViews: Boolean = true,
    val trackTaps: Boolean = false,
    val liveUpdates: Boolean = false,
)

public val LocalTrackingConfig = compositionLocalOf { TrackingConfig() }

public data class ScrollContext(
    val scrollY: Float = 0f,
    val viewportHeight: Float = 0f,
)

public val LocalScrollContext = compositionLocalOf<ScrollContext?> { null }
