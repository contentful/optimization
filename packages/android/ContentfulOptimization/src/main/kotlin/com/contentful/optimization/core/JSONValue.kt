package com.contentful.optimization.core

import org.json.JSONArray
import org.json.JSONObject

public sealed class JSONValue {
    data object Null : JSONValue()
    data class Bool(val value: Boolean) : JSONValue()
    data class Number(val value: Double) : JSONValue()
    data class Str(val value: String) : JSONValue()
    data class Array(val value: List<JSONValue>) : JSONValue()
    data class Obj(val value: Map<String, JSONValue>) : JSONValue()

    val stringValue: String? get() = (this as? Str)?.value
    val boolValue: Boolean? get() = (this as? Bool)?.value
    val intValue: Int? get() = (this as? Number)?.value?.toInt()
    val doubleValue: Double? get() = (this as? Number)?.value
    val arrayValue: List<JSONValue>? get() = (this as? Array)?.value
    val objectValue: Map<String, JSONValue>? get() = (this as? Obj)?.value

    operator fun get(key: String): JSONValue? = (this as? Obj)?.value?.get(key)

    fun toFoundation(): Any? = when (this) {
        is Null -> null
        is Bool -> value
        is Number -> value
        is Str -> value
        is Array -> value.map { it.toFoundation() }
        is Obj -> value.mapValues { it.value.toFoundation() }
    }

    fun toStringArray(): List<String>? =
        (this as? Array)?.value?.mapNotNull { it.stringValue }

    companion object {
        fun fromAny(value: Any?): JSONValue = when (value) {
            null, JSONObject.NULL -> Null
            Unit -> Null
            is Boolean -> Bool(value)
            is Int -> Number(value.toDouble())
            is Long -> Number(value.toDouble())
            is Float -> Number(value.toDouble())
            is Double -> Number(value)
            is String -> Str(value)
            is JSONArray -> Array((0 until value.length()).map { fromAny(value.get(it)) })
            is JSONObject -> Obj(value.keys().asSequence().associateWith { fromAny(value.get(it)) })
            is List<*> -> Array(value.map { fromAny(it) })
            is Map<*, *> -> {
                @Suppress("UNCHECKED_CAST")
                Obj((value as Map<String, Any?>).mapValues { fromAny(it.value) })
            }
            else -> Str(value.toString())
        }
    }
}
