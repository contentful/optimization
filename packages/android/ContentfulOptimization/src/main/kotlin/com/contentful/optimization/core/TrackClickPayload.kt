package com.contentful.optimization.core

import org.json.JSONObject

data class TrackClickPayload(
    val componentId: String,
    val experienceId: String? = null,
    val variantIndex: Int,
) {
    fun toJSON(): String {
        val obj = JSONObject()
        obj.put("componentId", componentId)
        obj.put("variantIndex", variantIndex)
        experienceId?.let { obj.put("experienceId", it) }
        return obj.toString()
    }
}
