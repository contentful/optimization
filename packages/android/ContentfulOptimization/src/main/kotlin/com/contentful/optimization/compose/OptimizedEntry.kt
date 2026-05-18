package com.contentful.optimization.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
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

    val selectedPersonalizations by client.selectedPersonalizations.collectAsState()
    val isPreviewPanelOpen by client.isPreviewPanelOpen.collectAsState()

    var lockedPersonalizations by remember { mutableStateOf<List<Map<String, Any>>?>(null) }
    var isLocked by remember { mutableStateOf(false) }

    val isPersonalized = remember(entry) {
        val fields = entry["fields"] as? Map<String, Any>
        fields?.containsKey("nt_experiences") == true
    }

    val shouldLiveUpdate = liveUpdates ?: (trackingConfig.liveUpdates || isPreviewPanelOpen)
    val effectivePersonalizations = if (shouldLiveUpdate) selectedPersonalizations else lockedPersonalizations

    val viewsEnabled = trackViews ?: trackingConfig.trackViews
    val tapsEnabled = when {
        trackTaps == false -> false
        trackTaps != null || onTap != null -> true
        else -> trackingConfig.trackTaps
    }

    // Collect directly from the underlying StateFlow rather than keying a
    // LaunchedEffect on `collectAsState`. Compose snapshot conflation can
    // coalesce a rapid null → cached → anonymous → identified sequence into
    // a single observed value, latching the lock onto the wrong emission.
    //
    // Until we see an identified profile (`profile.userId` non-null), follow
    // the latest personalizations instead of permanently locking. This keeps
    // anti-flashing behavior for identified sessions (the steady state) while
    // letting transient anonymous/cached emissions be replaced once `identify`
    // resolves. A late-mounting nested OptimizedEntry that subscribes after a
    // mid-flight reset/identify cycle will therefore reflect the final state.
    LaunchedEffect(Unit) {
        client.selectedPersonalizations.collect { newValue ->
            if (isPersonalized && !shouldLiveUpdate && newValue != null && !isLocked) {
                val isIdentified = (client.state.value.profile?.get("userId") as? String) != null
                lockedPersonalizations = newValue
                if (isIdentified) {
                    isLocked = true
                }
            }
        }
    }

    LaunchedEffect(isPreviewPanelOpen) {
        if (isPersonalized && !isPreviewPanelOpen && isLocked) {
            lockedPersonalizations = selectedPersonalizations
        }
    }

    val result by produceState(
        initialValue = PersonalizedResult(entry = entry, personalization = null),
        key1 = entry,
        key2 = effectivePersonalizations,
    ) {
        value = if (isPersonalized) {
            client.personalizeEntry(
                baseline = entry,
                personalizations = effectivePersonalizations,
            )
        } else {
            PersonalizedResult(entry = entry, personalization = null)
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
