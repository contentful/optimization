package com.contentful.optimization.core

import org.json.JSONObject

private fun normalizeLocale(locale: String?): String? =
    locale
        ?.trim()
        ?.replace('_', '-')
        ?.takeUnless { it.isBlank() || it == "*" || it.lowercase() == "und" }
        ?.takeIf { LOCALE_REGEX.matches(it) }

private val LOCALE_REGEX = Regex("^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$")

private fun normalizeExplicitLocale(locale: String?, name: String): String =
    normalizeLocale(locale) ?: throw OptimizationError.ConfigError("$name must be a valid locale string")

data class StorageDefaults(
    var consent: Boolean? = null,
    var persistenceConsent: Boolean? = null,
    var profile: Map<String, Any>? = null,
    var changes: List<Map<String, Any>>? = null,
    var personalizations: List<Map<String, Any>>? = null,
)

data class OptimizationConfig(
    val clientId: String,
    val environment: String = "master",
    val experienceBaseUrl: String? = null,
    val insightsBaseUrl: String? = null,
    /** Default SDK locale used for Experience API requests and event context. */
    val locale: String? = null,
    var defaults: StorageDefaults? = null,
    val debug: Boolean = false,
) {
    fun normalizedLocale(): String? =
        locale?.let { normalizeExplicitLocale(it, "locale") }

    internal fun toJSON(anonymousId: String? = null): String {
        val obj = JSONObject()
        obj.put("clientId", clientId)
        obj.put("environment", environment)
        experienceBaseUrl?.let { obj.put("experienceBaseUrl", it) }
        insightsBaseUrl?.let { obj.put("insightsBaseUrl", it) }
        normalizedLocale()?.let { obj.put("locale", it) }

        if (defaults != null || anonymousId != null) {
            val defaultsObj = JSONObject()
            val d = defaults
            d?.consent?.let { defaultsObj.put("consent", it) }
            d?.persistenceConsent?.let { defaultsObj.put("persistenceConsent", it) }
            d?.profile?.let { defaultsObj.put("profile", JSONObject(it)) }
            d?.changes?.let { defaultsObj.put("changes", toJSONArray(it)) }
            d?.personalizations?.let { defaultsObj.put("optimizations", toJSONArray(it)) }
            anonymousId?.let { defaultsObj.put("anonymousId", it) }
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
