package com.contentful.optimization.core

import org.json.JSONObject

data class StorageDefaults(
    var consent: Boolean? = null,
    var profile: Map<String, Any>? = null,
    var changes: List<Map<String, Any>>? = null,
    var personalizations: List<Map<String, Any>>? = null,
)

data class OptimizationConfig(
    val clientId: String,
    val environment: String = "master",
    val experienceBaseUrl: String? = null,
    val insightsBaseUrl: String? = null,
    var defaults: StorageDefaults? = null,
    val debug: Boolean = false,
) {
    fun toJSON(): String {
        val obj = JSONObject()
        obj.put("clientId", clientId)
        obj.put("environment", environment)
        experienceBaseUrl?.let { obj.put("experienceBaseUrl", it) }
        insightsBaseUrl?.let { obj.put("insightsBaseUrl", it) }

        defaults?.let { d ->
            val defaultsObj = JSONObject()
            d.consent?.let { defaultsObj.put("consent", it) }
            d.profile?.let { defaultsObj.put("profile", JSONObject(it)) }
            d.changes?.let { defaultsObj.put("changes", toJSONArray(it)) }
            d.personalizations?.let { defaultsObj.put("optimizations", toJSONArray(it)) }
            if (defaultsObj.length() > 0) {
                obj.put("defaults", defaultsObj)
            }
        }

        return obj.toString()
    }

    private fun toJSONArray(list: List<Map<String, Any>>): org.json.JSONArray {
        val arr = org.json.JSONArray()
        for (item in list) {
            arr.put(JSONObject(item))
        }
        return arr
    }
}
