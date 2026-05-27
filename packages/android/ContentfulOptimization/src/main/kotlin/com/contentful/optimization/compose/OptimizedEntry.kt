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
import com.contentful.optimization.core.PersonalizedResult

@Suppress("UNCHECKED_CAST")
@Composable
fun OptimizedEntry(
    entry: Map<String, Any>,
    viewTimeMs: Int = 2000,
    threshold: Double = 0.8,
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

    var lockedPersonalizations by remember { mutableStateOf<List<Map<String, Any>>?>(null) }
    var isLocked by remember { mutableStateOf(false) }

    val isPersonalized = remember(entry) {
        val fields = entry["fields"] as? Map<String, Any>
        fields?.containsKey("nt_experiences") == true
    }

    // An open preview panel always forces live updates, overriding an explicit
    // `liveUpdates = false`. The global toggle is only the default when no
    // explicit per-component value is set. Mirrors the iOS `shouldLiveUpdate`.
    val shouldLiveUpdate = if (isPreviewPanelOpen) true else liveUpdates ?: trackingConfig.liveUpdates

    val viewsEnabled = trackViews ?: trackingConfig.trackViews
    val tapsEnabled = when {
        trackTaps == false -> false
        trackTaps != null || onTap != null -> true
        else -> trackingConfig.trackTaps
    }

    var result by remember(entry) {
        mutableStateOf(PersonalizedResult(entry = entry, personalization = null))
    }

    // Re-resolve by collecting the personalizations StateFlow directly rather
    // than keying `produceState` on a `collectAsState()` snapshot. Compose
    // snapshot conflation can coalesce the rapid emission sequence that
    // `identify()` produces, which left a long-mounted live entry stuck on its
    // first resolution. Collecting the flow observes every emission.
    //
    // Live entries follow the latest personalizations on every emission. Locked
    // entries freeze on the first non-null value — mirrors the iOS `onReceive`
    // lock — and ignore later updates until the component is remounted.
    LaunchedEffect(entry, shouldLiveUpdate) {
        if (!isPersonalized) {
            result = PersonalizedResult(entry = entry, personalization = null)
            return@LaunchedEffect
        }
        client.selectedPersonalizations.collect { newValue ->
            if (!shouldLiveUpdate && !isLocked && newValue != null) {
                lockedPersonalizations = newValue
                isLocked = true
            }
            val personalizations = if (shouldLiveUpdate) newValue else lockedPersonalizations
            result = client.personalizeEntry(
                baseline = entry,
                personalizations = personalizations,
            )
        }
    }

    // When the preview panel closes, snapshot the current personalizations so
    // the locked state reflects any overrides applied during the session.
    LaunchedEffect(isPreviewPanelOpen) {
        if (isPersonalized && !isPreviewPanelOpen && isLocked) {
            lockedPersonalizations = client.selectedPersonalizations.value
            result = client.personalizeEntry(
                baseline = entry,
                personalizations = lockedPersonalizations,
            )
        }
    }

    val modifier = Modifier
        .trackViews(
            entry = entry,
            personalization = result.personalization,
            threshold = threshold,
            viewTimeMs = viewTimeMs,
            viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs,
            enabled = viewsEnabled,
            client = client,
        )
        .trackClicks(
            entry = entry,
            personalization = result.personalization,
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
