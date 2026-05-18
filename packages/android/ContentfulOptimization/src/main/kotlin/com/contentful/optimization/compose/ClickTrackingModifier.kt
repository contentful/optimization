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
fun Modifier.trackClicks(
    entry: Map<String, Any>,
    personalization: Map<String, Any>?,
    enabled: Boolean,
    client: OptimizationClient,
    onTap: ((Map<String, Any>) -> Unit)? = null,
): Modifier {
    if (!enabled) return this

    val scope = rememberCoroutineScope()
    return this.clickable {
        val metadata = TrackingMetadata(entry, personalization)
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
        onTap?.invoke(entry)
    }
}
