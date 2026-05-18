package com.contentful.optimization.core

import org.json.JSONObject

data class TrackViewPayload(
    val componentId: String,
    val viewId: String,
    val experienceId: String? = null,
    val variantIndex: Int,
    val viewDurationMs: Int,
    val sticky: Boolean? = null,
) {
    fun toJSON(): String {
        val obj = JSONObject()
        obj.put("componentId", componentId)
        obj.put("viewId", viewId)
        obj.put("variantIndex", variantIndex)
        obj.put("viewDurationMs", viewDurationMs)
        experienceId?.let { obj.put("experienceId", it) }
        sticky?.let { obj.put("sticky", it) }
        return obj.toString()
    }
}
