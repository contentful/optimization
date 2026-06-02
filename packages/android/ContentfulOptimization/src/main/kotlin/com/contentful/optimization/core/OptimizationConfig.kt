package com.contentful.optimization.core

import java.util.Locale
import org.json.JSONObject

data class ContentfulLocales(
    val default: String,
    val supported: List<String> = emptyList(),
) {
    fun resolve(candidates: List<String>): String {
        val supportedLocales = (supported + default).mapIndexed { index, value ->
            val normalized = normalizeExplicitLocale(
                value,
                if (index < supported.size) "contentfulLocales.supported[$index]" else "contentfulLocales.default",
            )
            // Contentful locale codes are API identifiers, so matching uses a private key while
            // resolved values preserve the configured code.
            SupportedLocale(value = value, matchKey = getLocaleMatchKey(normalized))
        }
        val candidateMatchKeys = candidates.mapNotNull(::normalizeLocale).map(::getLocaleMatchKey)

        for (candidateMatchKey in candidateMatchKeys) {
            val exactMatch = supportedLocales.firstOrNull { it.matchKey == candidateMatchKey }
            if (exactMatch != null) {
                return exactMatch.value
            }
        }

        for (candidateMatchKey in candidateMatchKeys) {
            for (fallbackMatchKey in getFallbackMatchKeys(candidateMatchKey)) {
                val fallbackMatch = supportedLocales.firstOrNull {
                    it.matchKey == fallbackMatchKey || it.matchKey.startsWith("$fallbackMatchKey-")
                }
                if (fallbackMatch != null) {
                    return fallbackMatch.value
                }
            }
        }

        return default
    }
}

private data class SupportedLocale(
    val value: String,
    val matchKey: String,
)

private fun normalizeLocale(locale: String?): String? =
    locale
        ?.trim()
        ?.replace('_', '-')
        ?.takeUnless { it.isBlank() || it == "*" || getLocaleMatchKey(it) == "und" }
        ?.takeIf { LOCALE_REGEX.matches(it) }

private val LOCALE_REGEX = Regex("^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$")

private fun normalizeExplicitLocale(locale: String?, name: String): String =
    normalizeLocale(locale) ?: throw OptimizationError.ConfigError("$name must be a valid locale string")

private fun getLocaleMatchKey(locale: String): String =
    locale.lowercase(Locale.ROOT)

private fun getFallbackMatchKeys(matchKey: String): List<String> {
    val subtags = matchKey.split("-")
    return (subtags.size - 1 downTo 1).map { size ->
        subtags.take(size).joinToString("-")
    }
}

data class StorageDefaults(
    var consent: Boolean? = null,
    var profile: Map<String, Any>? = null,
    var changes: List<Map<String, Any>>? = null,
    var personalizations: List<Map<String, Any>>? = null,
)

data class OptimizationApiConfig(
    /** Experience API locale used for localized profile fields. */
    val locale: String? = null,
)

data class OptimizationConfig(
    val clientId: String,
    val environment: String = "master",
    val experienceBaseUrl: String? = null,
    val insightsBaseUrl: String? = null,
    /** Contentful locale configuration used to resolve the CDA locale. */
    val contentfulLocales: ContentfulLocales? = null,
    /** Initial app/content locale candidate used to resolve the Contentful locale. */
    val locale: String? = null,
    /** Nested Experience API configuration. */
    val api: OptimizationApiConfig? = null,
    var defaults: StorageDefaults? = null,
    val debug: Boolean = false,
) {
    fun resolvedLocale(candidates: List<String> = emptyList()): String? =
        locale?.let {
            contentfulLocales?.resolve(listOf(it)) ?: normalizeExplicitLocale(it, "locale")
        } ?: contentfulLocales?.resolve(candidates)

    fun toJSON(): String {
        val obj = JSONObject()
        obj.put("clientId", clientId)
        obj.put("environment", environment)
        experienceBaseUrl?.let { obj.put("experienceBaseUrl", it) }
        insightsBaseUrl?.let { obj.put("insightsBaseUrl", it) }
        contentfulLocales?.let {
            obj.put(
                "contentfulLocales",
                JSONObject()
                    .put("default", it.default)
                    .put("supported", org.json.JSONArray(it.supported)),
            )
        }
        resolvedLocale()?.let { obj.put("locale", it) }
        api?.locale?.let {
            obj.put("api", JSONObject().put("locale", normalizeExplicitLocale(it, "api.locale")))
        }

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
