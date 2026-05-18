package com.contentful.optimization.core

import org.json.JSONArray
import org.json.JSONObject

data class OptimizationState(
    val profile: Map<String, Any>? = null,
    val consent: Boolean? = null,
    val canPersonalize: Boolean = false,
    val changes: List<Map<String, Any>>? = null,
) {
    companion object {
        val EMPTY = OptimizationState()
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is OptimizationState) return false
        return sortedJson(profile) == sortedJson(other.profile) &&
            consent == other.consent &&
            canPersonalize == other.canPersonalize &&
            sortedJson(changes) == sortedJson(other.changes)
    }

    override fun hashCode(): Int {
        var result = sortedJson(profile).hashCode()
        result = 31 * result + (consent?.hashCode() ?: 0)
        result = 31 * result + canPersonalize.hashCode()
        result = 31 * result + sortedJson(changes).hashCode()
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
