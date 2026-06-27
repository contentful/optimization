package com.contentful.optimization

import com.contentful.optimization.compose.TrackingConfig
import com.contentful.optimization.views.OptimizationManager
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TrackingDefaultsTest {

    @Test
    fun `compose tracking config defaults views and taps to true`() {
        val config = TrackingConfig()

        assertTrue(config.trackViews)
        assertTrue(config.trackTaps)
        assertFalse(config.liveUpdates)
    }

    @Test
    fun `compose tracking config preserves opt out values`() {
        val config = TrackingConfig(trackViews = false, trackTaps = false)

        assertFalse(config.trackViews)
        assertFalse(config.trackTaps)
        assertFalse(config.liveUpdates)
    }

    @Test
    fun `views tracking manager defaults views and taps to true`() {
        assertTrue(OptimizationManager.trackViews)
        assertTrue(OptimizationManager.trackTaps)
        assertFalse(OptimizationManager.liveUpdates)
    }
}
