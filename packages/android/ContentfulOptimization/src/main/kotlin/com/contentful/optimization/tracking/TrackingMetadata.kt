package com.contentful.optimization.tracking

internal class TrackingMetadata(
    entry: Map<String, Any>,
    selectedOptimization: Map<String, Any>?,
) {
    @Suppress("UNCHECKED_CAST")
    val componentId: String = (entry["sys"] as? Map<String, Any>)?.get("id") as? String ?: ""
    val experienceId: String? = selectedOptimization?.get("experienceId") as? String
    val variantIndex: Int = selectedOptimization?.get("variantIndex") as? Int ?: 0
    val sticky: Boolean? = selectedOptimization?.get("sticky") as? Boolean
}
