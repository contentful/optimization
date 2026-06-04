package com.contentful.optimization.core

import org.json.JSONArray
import org.json.JSONObject

data class OptimizationState(
    val profile: Map<String, Any>? = null,
    val consent: Boolean? = null,
    val persistenceConsent: Boolean? = null,
    val canPersonalize: Boolean = false,
    val changes: List<Map<String, Any>>? = null,
    val locale: String? = null,
) {
    companion object {
        val EMPTY = OptimizationState()
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is OptimizationState) return false
        return sortedJson(profile) == sortedJson(other.profile) &&
            consent == other.consent &&
            persistenceConsent == other.persistenceConsent &&
            canPersonalize == other.canPersonalize &&
            sortedJson(changes) == sortedJson(other.changes) &&
            locale == other.locale
    }

    override fun hashCode(): Int {
        var result = sortedJson(profile).hashCode()
        result = 31 * result + (consent?.hashCode() ?: 0)
        result = 31 * result + (persistenceConsent?.hashCode() ?: 0)
        result = 31 * result + canPersonalize.hashCode()
        result = 31 * result + sortedJson(changes).hashCode()
        result = 31 * result + (locale?.hashCode() ?: 0)
        return result
    }

    private fun sortedJson(value: Any?): String {
        if (value == null) return "null"
        return when (value) {
            is Map<*, *> -> JSONObject(value as Map<String, Any>).toString()
            is List<*> -> JSONArray(value).toString()
            else -> value.toString()
        }
    }
}
