package com.contentful.optimization.core

import org.json.JSONArray
import org.json.JSONObject

public data class IdentifyPayload(
    val userId: String,
    val traits: Map<String, JSONValue>? = null,
) {
    fun toJSON(): String {
        val obj = JSONObject()
        obj.put("userId", userId)
        traits?.let { obj.put("traits", it.toJSONObject()) }
        return obj.toString()
    }
}

public data class PageEventPayload(
    val properties: Map<String, JSONValue> = emptyMap(),
) {
    fun toJSON(): String = properties.toJSONObject().toString()
}

public data class ScreenEventPayload(
    val name: String,
    val properties: Map<String, JSONValue> = emptyMap(),
    val routeKey: String? = null,
) {
    fun toJSON(): String {
        val obj = JSONObject()
        obj.put("name", name)
        if (properties.isNotEmpty()) {
            obj.put("properties", properties.toJSONObject())
        }
        routeKey?.let { obj.put("routeKey", it) }
        return obj.toString()
    }
}

public data class TrackEventPayload(
    val event: String,
    val properties: Map<String, JSONValue> = emptyMap(),
) {
    fun toJSON(): String {
        val obj = JSONObject()
        obj.put("event", event)
        if (properties.isNotEmpty()) {
            obj.put("properties", properties.toJSONObject())
        }
        return obj.toString()
    }
}

private fun Map<String, JSONValue>.toJSONObject(): JSONObject {
    val obj = JSONObject()
    for ((key, value) in this) {
        obj.put(key, value.toJSONCompatible())
    }
    return obj
}

private fun List<JSONValue>.toJSONArray(): JSONArray {
    val array = JSONArray()
    for (value in this) {
        array.put(value.toJSONCompatible())
    }
    return array
}

private fun JSONValue.toJSONCompatible(): Any = when (this) {
    JSONValue.Null -> JSONObject.NULL
    is JSONValue.Bool -> value
    is JSONValue.Number -> value
    is JSONValue.Str -> value
    is JSONValue.Array -> value.toJSONArray()
    is JSONValue.Obj -> value.toJSONObject()
}
