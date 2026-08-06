package com.contentful.optimization.core

import com.contentful.optimization.contentful.CTEntry

public data class ResolvedOptimizedEntry(
    val entry: CTEntry,
    val selectedOptimization: Map<String, Any>?,
    val optimizationContextId: String? = null,
    val isEmptyVariant: Boolean = false,
) {
    internal companion object {
        @Suppress("UNCHECKED_CAST")
        fun fromBridgeResult(
            result: Map<String, Any>,
            baselineEntry: CTEntry,
        ): ResolvedOptimizedEntry {
            val entry = (result["entry"] as? Map<String, Any>)
                ?.let { CTEntry.from(it, fallback = baselineEntry) }
                ?: baselineEntry
            return ResolvedOptimizedEntry(
                entry = entry,
                selectedOptimization = result["selectedOptimization"] as? Map<String, Any>,
                optimizationContextId = result["optimizationContextId"] as? String,
                isEmptyVariant = result["isEmptyVariant"] == true,
            )
        }
    }
}
