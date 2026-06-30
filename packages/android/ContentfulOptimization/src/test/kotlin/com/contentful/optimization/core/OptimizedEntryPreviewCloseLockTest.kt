package com.contentful.optimization.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OptimizedEntryPreviewCloseLockTest {

    private val previewSelectedOptimizations = listOf(
        mapOf("experienceId" to "exp-preview", "variantIndex" to 2),
    )

    @Test
    fun `non-live entry locks to preview selected optimizations on close`() {
        val lockState = resolvePreviewCloseLockState(
            isOptimized = true,
            isPreviewPanelOpen = false,
            nonPreviewLiveUpdates = false,
            hasSelectedOptimizationsOverride = false,
            selectedOptimizations = previewSelectedOptimizations,
        )

        val actual = requireNotNull(lockState)
        assertEquals(previewSelectedOptimizations, actual.lockedOptimizations)
        assertTrue(actual.shouldLock)
    }

    @Test
    fun `live entry does not lock on preview close`() {
        val lockState = resolvePreviewCloseLockState(
            isOptimized = true,
            isPreviewPanelOpen = false,
            nonPreviewLiveUpdates = true,
            hasSelectedOptimizationsOverride = false,
            selectedOptimizations = previewSelectedOptimizations,
        )

        assertNull(lockState)
    }

    @Test
    fun `views selected optimizations override is unaffected by preview close`() {
        val lockState = resolvePreviewCloseLockState(
            isOptimized = true,
            isPreviewPanelOpen = false,
            nonPreviewLiveUpdates = false,
            hasSelectedOptimizationsOverride = true,
            selectedOptimizations = previewSelectedOptimizations,
        )

        assertNull(lockState)
    }

    @Test
    fun `preview close with no selected optimizations re-resolves without locking`() {
        val lockState = resolvePreviewCloseLockState(
            isOptimized = true,
            isPreviewPanelOpen = false,
            nonPreviewLiveUpdates = false,
            hasSelectedOptimizationsOverride = false,
            selectedOptimizations = null,
        )

        val actual = requireNotNull(lockState)
        assertNull(actual.lockedOptimizations)
        assertFalse(actual.shouldLock)
    }
}
