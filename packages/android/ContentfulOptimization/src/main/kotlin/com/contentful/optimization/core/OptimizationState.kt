package com.contentful.optimization.core

public data class OptimizationState(
    val profile: Map<String, Any>? = null,
    val consent: Boolean? = null,
    val persistenceConsent: Boolean? = null,
    val canOptimize: Boolean = false,
    val optimizationPossible: Boolean = false,
    val experienceRequestState: Map<String, Any> = mapOf("status" to "idle"),
    val changes: List<Map<String, Any>>? = null,
    val selectedOptimizations: List<Map<String, Any>>? = null,
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
            canOptimize == other.canOptimize &&
            optimizationPossible == other.optimizationPossible &&
            sortedJson(experienceRequestState) == sortedJson(other.experienceRequestState) &&
            sortedJson(changes) == sortedJson(other.changes) &&
            sortedJson(selectedOptimizations) == sortedJson(other.selectedOptimizations) &&
            locale == other.locale
    }

    override fun hashCode(): Int {
        var result = sortedJson(profile).hashCode()
        result = 31 * result + (consent?.hashCode() ?: 0)
        result = 31 * result + (persistenceConsent?.hashCode() ?: 0)
        result = 31 * result + canOptimize.hashCode()
        result = 31 * result + optimizationPossible.hashCode()
        result = 31 * result + sortedJson(experienceRequestState).hashCode()
        result = 31 * result + sortedJson(changes).hashCode()
        result = 31 * result + sortedJson(selectedOptimizations).hashCode()
        result = 31 * result + (locale?.hashCode() ?: 0)
        return result
    }

    private fun sortedJson(value: Any?): String {
        return when (value) {
            null, Unit -> "null"
            is Map<*, *> -> value.entries
                .sortedBy { it.key.toString() }
                .joinToString(prefix = "{", postfix = "}") { "${it.key}:${sortedJson(it.value)}" }
            is List<*> -> value.joinToString(prefix = "[", postfix = "]") { sortedJson(it) }
            else -> value.toString()
        }
    }
}
