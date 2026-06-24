package com.contentful.optimization.core

import org.json.JSONObject

public data class TrackClickPayload(
    val componentId: String,
    val experienceId: String? = null,
    val variantIndex: Int,
    val optimizationContextId: String? = null,
) {
    fun toJSON(): String {
        val obj = JSONObject()
        obj.put("componentId", componentId)
        obj.put("variantIndex", variantIndex)
        experienceId?.let { obj.put("experienceId", it) }
        optimizationContextId?.let { obj.put("optimizationContextId", it) }
        return obj.toString()
    }
}
