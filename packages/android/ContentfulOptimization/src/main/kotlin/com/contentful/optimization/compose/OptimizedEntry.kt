package com.contentful.optimization.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.contentful.optimization.core.ResolvedOptimizedEntry
import com.contentful.optimization.core.resolvePreviewCloseLockState

@Suppress("UNCHECKED_CAST")
@Composable
public fun OptimizedEntry(
    entry: Map<String, Any>,
    dwellTimeMs: Int = 2000,
    minVisibleRatio: Double = 0.8,
    viewDurationUpdateIntervalMs: Int = 5000,
    liveUpdates: Boolean? = null,
    trackViews: Boolean? = null,
    trackTaps: Boolean? = null,
    accessibilityIdentifier: String? = null,
    onTap: ((Map<String, Any>) -> Unit)? = null,
    content: @Composable (Map<String, Any>) -> Unit,
) {
    val client = LocalOptimizationClient.current
    val trackingConfig = LocalTrackingConfig.current

    val isPreviewPanelOpen by client.isPreviewPanelOpen.collectAsState()

    var lockedOptimizations by remember { mutableStateOf<List<Map<String, Any>>?>(null) }
    var isLocked by remember { mutableStateOf(false) }

    val isOptimized = remember(entry) {
        val fields = entry["fields"] as? Map<String, Any>
        fields?.containsKey("nt_experiences") == true
    }

    val viewsEnabled = trackViews ?: trackingConfig.trackViews
    val tapsEnabled = when {
        trackTaps == false -> false
        trackTaps != null || onTap != null -> true
        else -> trackingConfig.trackTaps
    }

    var result by remember(entry) {
        mutableStateOf(ResolvedOptimizedEntry(entry = entry, selectedOptimization = null))
    }

    // Re-resolve by collecting the selectedOptimizations StateFlow directly rather
    // than keying on a `collectAsState()` snapshot. Compose snapshot conflation
    // can coalesce the rapid emission sequence that `identify()` produces, which
    // left a long-mounted live entry stuck on its first resolution. Collecting
    // the flow observes every emission.
    //
    // IMPORTANT: key this collector ONLY on `entry`, and read the current
    // preview-panel state INSIDE the collect via `isPreviewPanelOpen.value` —
    // never key the effect on a derived `shouldLiveUpdate`. Keying on the panel
    // state cancels and restarts the collector every time the panel opens or
    // closes, which can drop the `selectedOptimizations` emission produced by
    // a preview override change (e.g. reset-variant) and leave the entry
    // resolved against a stale optimization set (observed as the baseline
    // sticking after reset-variant). The View-based `OptimizedEntryView` uses
    // this same long-lived collector; keeping them identical is what makes
    // Compose and Views behave the same.
    //
    // Live entries follow the latest selectedOptimizations on every emission. Locked entries
    // freeze on the first non-null value or on preview-panel close, and ignore later updates
    // until the component is remounted.
    LaunchedEffect(entry) {
        if (!isOptimized) {
            result = ResolvedOptimizedEntry(entry = entry, selectedOptimization = null)
            return@LaunchedEffect
        }
        client.selectedOptimizations.collect { newValue ->
            val shouldLiveUpdate =
                if (client.isPreviewPanelOpen.value) true else liveUpdates ?: trackingConfig.liveUpdates
            if (!shouldLiveUpdate && !isLocked && newValue != null) {
                lockedOptimizations = newValue
                isLocked = true
            }
            val selectedOptimizations = if (shouldLiveUpdate) newValue else lockedOptimizations
            result = client.resolveOptimizedEntry(
                baseline = entry,
                selectedOptimizations = selectedOptimizations,
            )
        }
    }

    // When the preview panel closes, snapshot the current selectedOptimizations so
    // the locked state reflects any overrides applied during the session.
    LaunchedEffect(isPreviewPanelOpen) {
        val lockState = resolvePreviewCloseLockState(
            isOptimized = isOptimized,
            isPreviewPanelOpen = isPreviewPanelOpen,
            nonPreviewLiveUpdates = liveUpdates ?: trackingConfig.liveUpdates,
            hasSelectedOptimizationsOverride = false,
            selectedOptimizations = client.selectedOptimizations.value,
        ) ?: return@LaunchedEffect

        lockedOptimizations = lockState.lockedOptimizations
        if (lockState.shouldLock) {
            isLocked = true
        }
        result = client.resolveOptimizedEntry(
            baseline = entry,
            selectedOptimizations = lockedOptimizations,
        )
    }

    val modifier = Modifier
        .trackViews(
            entry = entry,
            optimizationContextId = result.optimizationContextId,
            selectedOptimization = result.selectedOptimization,
            minVisibleRatio = minVisibleRatio,
            dwellTimeMs = dwellTimeMs,
            viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs,
            enabled = viewsEnabled,
            client = client,
        )
        .trackClicks(
            entry = entry,
            optimizationContextId = result.optimizationContextId,
            selectedOptimization = result.selectedOptimization,
            enabled = tapsEnabled,
            client = client,
            onTap = onTap,
        )
        .let { mod ->
            if (accessibilityIdentifier != null) {
                mod.semantics { contentDescription = accessibilityIdentifier }
            } else {
                mod
            }
        }

    Box(modifier = modifier) {
        content(result.entry)
    }
}
