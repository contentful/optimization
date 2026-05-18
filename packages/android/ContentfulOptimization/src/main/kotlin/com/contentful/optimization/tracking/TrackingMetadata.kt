package com.contentful.optimization.tracking

class TrackingMetadata(
    entry: Map<String, Any>,
    personalization: Map<String, Any>?,
) {
    @Suppress("UNCHECKED_CAST")
    val componentId: String = (entry["sys"] as? Map<String, Any>)?.get("id") as? String ?: ""
    val experienceId: String? = personalization?.get("experienceId") as? String
    val variantIndex: Int = personalization?.get("variantIndex") as? Int ?: 0
    val sticky: Boolean? = personalization?.get("sticky") as? Boolean
}
