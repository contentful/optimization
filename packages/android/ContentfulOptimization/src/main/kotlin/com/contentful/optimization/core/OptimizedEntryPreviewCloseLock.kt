package com.contentful.optimization.core

internal data class PreviewCloseLockState(
    val lockedOptimizations: List<Map<String, Any>>?,
    val shouldLock: Boolean,
)

internal fun resolvePreviewCloseLockState(
    isOptimized: Boolean,
    isPreviewPanelOpen: Boolean,
    nonPreviewLiveUpdates: Boolean,
    hasSelectedOptimizationsOverride: Boolean,
    selectedOptimizations: List<Map<String, Any>>?,
): PreviewCloseLockState? {
    if (
        !isOptimized ||
        isPreviewPanelOpen ||
        nonPreviewLiveUpdates ||
        hasSelectedOptimizationsOverride
    ) {
        return null
    }

    return PreviewCloseLockState(
        lockedOptimizations = selectedOptimizations,
        shouldLock = selectedOptimizations != null,
    )
}
