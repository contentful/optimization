package com.contentful.optimization.compose

import androidx.compose.foundation.clickable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.core.TrackClickPayload
import com.contentful.optimization.tracking.TrackingMetadata
import kotlinx.coroutines.launch

@Composable
public fun Modifier.trackClicks(
    entry: Map<String, Any>,
    selectedOptimization: Map<String, Any>?,
    enabled: Boolean,
    client: OptimizationClient,
    onTap: ((Map<String, Any>) -> Unit)? = null,
): Modifier {
    if (!enabled) return this

    val scope = rememberCoroutineScope()
    return this.clickable {
        if (client.hasConsent("trackClick")) {
            val metadata = TrackingMetadata(entry, selectedOptimization)
            val payload = TrackClickPayload(
                componentId = metadata.componentId,
                experienceId = metadata.experienceId,
                variantIndex = metadata.variantIndex,
            )
            scope.launch {
                try {
                    client.trackClick(payload)
                } catch (_: Exception) {
                }
            }
        }
        onTap?.invoke(entry)
    }
}
