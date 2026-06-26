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

public data class StorageDefaults(
    var consent: Boolean? = null,
    var persistenceConsent: Boolean? = null,
    var profile: Map<String, Any>? = null,
    var changes: List<Map<String, Any>>? = null,
    var selectedOptimizations: List<Map<String, Any>>? = null,
)

public data class OptimizationApiConfig(
    val experienceBaseUrl: String? = null,
    val insightsBaseUrl: String? = null,
    val enabledFeatures: List<String>? = null,
    val preflight: Boolean? = null,
) {
    internal fun isEmpty(): Boolean =
        experienceBaseUrl == null &&
            insightsBaseUrl == null &&
            enabledFeatures == null &&
            preflight == null

    internal fun toJSONObject(): JSONObject {
        val obj = JSONObject()
        experienceBaseUrl?.let { obj.put("experienceBaseUrl", it) }
        insightsBaseUrl?.let { obj.put("insightsBaseUrl", it) }
        enabledFeatures?.let { obj.put("enabledFeatures", org.json.JSONArray(it)) }
        preflight?.let { obj.put("preflight", it) }
        return obj
    }
}

public enum class OptimizationLogLevel(public val wireValue: String) {
    fatal("fatal"),
    error("error"),
    warn("warn"),
    info("info"),
    debug("debug"),
    log("log"),
}

public data class QueueFlushPolicy(
    val flushIntervalMs: Int? = null,
    val baseBackoffMs: Int? = null,
    val maxBackoffMs: Int? = null,
    val jitterRatio: Double? = null,
    val maxConsecutiveFailures: Int? = null,
    val circuitOpenMs: Int? = null,
) {
    internal fun isEmpty(): Boolean =
        flushIntervalMs == null &&
            baseBackoffMs == null &&
            maxBackoffMs == null &&
            jitterRatio == null &&
            maxConsecutiveFailures == null &&
            circuitOpenMs == null

    internal fun toJSONObject(): JSONObject {
        val obj = JSONObject()
        flushIntervalMs?.let { obj.put("flushIntervalMs", it) }
        baseBackoffMs?.let { obj.put("baseBackoffMs", it) }
        maxBackoffMs?.let { obj.put("maxBackoffMs", it) }
        jitterRatio?.let { obj.put("jitterRatio", it) }
        maxConsecutiveFailures?.let { obj.put("maxConsecutiveFailures", it) }
        circuitOpenMs?.let { obj.put("circuitOpenMs", it) }
        return obj
    }
}

public data class QueuePolicy(
    val flush: QueueFlushPolicy? = null,
    val offlineMaxEvents: Int? = null,
    val onOfflineDrop: ((QueueEvent) -> Unit)? = null,
    val onFlushFailure: ((QueueEvent) -> Unit)? = null,
    val onCircuitOpen: ((QueueEvent) -> Unit)? = null,
    val onFlushRecovered: ((QueueEvent) -> Unit)? = null,
) {
    internal fun isEmpty(): Boolean =
        (flush == null || flush.isEmpty()) && offlineMaxEvents == null

    internal fun toJSONObject(): JSONObject {
        val obj = JSONObject()
        if (flush != null && !flush.isEmpty()) {
            obj.put("flush", flush.toJSONObject())
        }
        offlineMaxEvents?.let { obj.put("offlineMaxEvents", it) }
        return obj
    }
}

public data class BlockedEvent(
    val reason: String,
    val method: String,
    val args: List<Any>,
)

public enum class QueueEventType(public val wireValue: String) {
    offlineDrop("offlineDrop"),
    flushFailure("flushFailure"),
    circuitOpen("circuitOpen"),
    flushRecovered("flushRecovered");

    public companion object {
        public fun fromWireValue(value: String): QueueEventType? =
            values().firstOrNull { it.wireValue == value }
    }
}

public data class QueueEvent(
    val type: QueueEventType,
    val context: Map<String, Any>,
)

public data class OptimizationConfig(
    val clientId: String,
    val environment: String = "main",
    val api: OptimizationApiConfig? = null,
    /** Default SDK locale used for Experience API requests and event context. */
    val locale: String? = null,
    var defaults: StorageDefaults? = null,
    val allowedEventTypes: List<String>? = null,
    val logLevel: OptimizationLogLevel = OptimizationLogLevel.error,
    val queuePolicy: QueuePolicy? = null,
    val onEventBlocked: ((BlockedEvent) -> Unit)? = null,
) {
    fun normalizedLocale(): String? =
        locale?.let { normalizeExplicitLocale(it, "locale") }

    internal fun toJSON(anonymousId: String? = null): String {
        val obj = JSONObject()
        obj.put("clientId", clientId)
        obj.put("environment", environment)
        obj.put("logLevel", logLevel.wireValue)
        if (api != null && !api.isEmpty()) {
            obj.put("api", api.toJSONObject())
        }
        normalizedLocale()?.let { obj.put("locale", it) }
        allowedEventTypes?.let { obj.put("allowedEventTypes", org.json.JSONArray(it)) }
        if (queuePolicy != null && !queuePolicy.isEmpty()) {
            obj.put("queuePolicy", queuePolicy.toJSONObject())
        }

        if (defaults != null || anonymousId != null) {
            val defaultsObj = JSONObject()
            val d = defaults
            d?.consent?.let { defaultsObj.put("consent", it) }
            d?.persistenceConsent?.let { defaultsObj.put("persistenceConsent", it) }
            d?.profile?.let { defaultsObj.put("profile", JSONObject(it)) }
            d?.changes?.let { defaultsObj.put("changes", toJSONArray(it)) }
            d?.selectedOptimizations?.let { defaultsObj.put("selectedOptimizations", toJSONArray(it)) }
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
