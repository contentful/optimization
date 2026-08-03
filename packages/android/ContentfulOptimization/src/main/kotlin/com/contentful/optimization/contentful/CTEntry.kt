package com.contentful.optimization.contentful

import com.contentful.java.cda.CDAContentType
import com.contentful.java.cda.CDAEntry
import com.contentful.java.cda.CDAMetadata
import com.contentful.optimization.core.DiagnosticLogger
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Wraps a `contentful.java` [CDAEntry] so a resolved variant reads through the same accessors
 * as a fetched entry. [from]`(any: Map)` and [from]`(json: String)` fabricate a [CDAEntry]
 * from the resolver's Map so downstream code always reads through the same surface.
 */
public class CTEntry internal constructor(private val entry: CDAEntry) {

    public fun toFoundation(): Map<String, Any> = toOptimizedEntryMap(entry)

    public fun toJSON(): String = JSONObject(toFoundation()).toString()

    public val id: String? get() = entry.id()

    public val contentTypeId: String? get() = entry.contentType()?.id()

    public val localeCode: String? get() = entry.getAttribute<String?>("locale")

    public val createdAt: Date?
        get() = entry.getAttribute<String?>("createdAt")?.let(::parseIso8601)

    public val updatedAt: Date?
        get() = entry.getAttribute<String?>("updatedAt")?.let(::parseIso8601)

    public fun <T> getField(name: String): T? = entry.getField(name)

    public fun hasField(name: String): Boolean = entry.rawFields().containsKey(name)

    public operator fun get(name: String): String? = getField(name)

    public companion object {
        internal val EMPTY: CTEntry = CTEntry(fabricateEntry(emptyMap()))

        public fun from(entry: CDAEntry): CTEntry = CTEntry(entry)

        /** Logs and returns [fallback] on parse failure — avoids throwing into the bridge. */
        public fun from(any: Map<String, Any>, fallback: CTEntry = EMPTY): CTEntry = try {
            CTEntry(fabricateEntry(jsonObjectToMap(JSONObject(any))))
        } catch (e: Exception) {
            DiagnosticLogger.warning { "[CTEntry] Failed to parse entry map: ${e.message}" }
            fallback
        }

        public fun from(json: String, fallback: CTEntry = EMPTY): CTEntry {
            val obj = try {
                JSONTokener(json).nextValue() as? JSONObject
            } catch (e: Exception) {
                DiagnosticLogger.warning { "[CTEntry] Failed to parse entry JSON: ${e.message}" }
                return fallback
            }
            if (obj == null) {
                DiagnosticLogger.warning { "[CTEntry] Failed to parse entry JSON: root is not a JSON object" }
                return fallback
            }
            return try {
                CTEntry(fabricateEntry(jsonObjectToMap(obj)))
            } catch (e: Exception) {
                DiagnosticLogger.warning { "[CTEntry] Failed to build CDAEntry: ${e.message}" }
                fallback
            }
        }
    }
}

// `LocalizedResource.getField(name)` expects fields shaped as `Map<name, Map<locale, value>>`
// with a non-null `defaultLocale`. The resolver Map is single-locale, so we bucket every value
// under a synthetic locale marker.
private const val FABRICATED_LOCALE = "_"

@Suppress("UNCHECKED_CAST")
private fun fabricateEntry(map: Map<String, Any>): CDAEntry {
    val entry = CDAEntry()
    setPrivateField(entry, "attrs", (map["sys"] as? Map<String, Any>)?.toMutableMap() ?: mutableMapOf<String, Any>())
    setPrivateField(entry, "defaultLocale", FABRICATED_LOCALE)
    val rawFields = (map["fields"] as? Map<String, Any>) ?: emptyMap()
    setPrivateField(entry, "rawFields", rawFields.toMutableMap())
    setPrivateField(entry, "fields", localizeFields(rawFields))
    val contentTypeId = ((map["sys"] as? Map<*, *>)
        ?.get("contentType") as? Map<*, *>)
        ?.let { it["sys"] as? Map<*, *> }
        ?.let { it["id"] as? String }
    setPrivateField(entry, "contentType", contentTypeId?.let(::fabricateContentType))
    setPrivateField(entry, "metadata", (map["metadata"] as? Map<String, Any>)?.let(::fabricateMetadata))
    return entry
}

private fun fabricateContentType(id: String): CDAContentType {
    val ct = CDAContentType()
    setPrivateField(ct, "attrs", mutableMapOf<String, Any>("id" to id, "type" to "ContentType"))
    return ct
}

private fun fabricateMetadata(map: Map<String, Any>): CDAMetadata {
    val metadata = CDAMetadata()
    setPrivateField(metadata, "tags", (map["tags"] as? List<*>)?.toMutableList() ?: mutableListOf<Any>())
    setPrivateField(metadata, "concepts", (map["concepts"] as? List<*>)?.toMutableList() ?: mutableListOf<Any>())
    return metadata
}

private fun localizeFields(fields: Map<String, Any>): MutableMap<String, Any?> =
    fields.mapValuesTo(mutableMapOf()) { (_, value) ->
        mutableMapOf<String, Any?>(FABRICATED_LOCALE to value)
    }

// contentful.java's LocalizedResource/CDAResource/CDAMetadata declare the fields we need to
// set as package-private with no public setters; a future rename here fails at runtime with
// NoSuchFieldException. Pinned to 10.6.0 (see build.gradle.kts).
private fun setPrivateField(target: Any, name: String, value: Any?) {
    var clazz: Class<*>? = target::class.java
    while (clazz != null) {
        try {
            val field = clazz.getDeclaredField(name)
            field.isAccessible = true
            field.set(target, value)
            return
        } catch (_: NoSuchFieldException) {
            clazz = clazz.superclass
        }
    }
    throw NoSuchFieldException("$name on ${target::class.java}")
}

private fun jsonObjectToMap(obj: JSONObject): Map<String, Any> {
    val out = LinkedHashMap<String, Any>(obj.length())
    val keys = obj.keys()
    while (keys.hasNext()) {
        val key = keys.next()
        val value = jsonValueToAny(obj.get(key)) ?: continue
        out[key] = value
    }
    return out
}

private fun jsonArrayToList(arr: JSONArray): List<Any?> =
    List(arr.length()) { jsonValueToAny(arr.get(it)) }

private fun jsonValueToAny(value: Any?): Any? = when (value) {
    null, JSONObject.NULL -> null
    is JSONObject -> jsonObjectToMap(value)
    is JSONArray -> jsonArrayToList(value)
    else -> value
}

private fun parseIso8601(value: String): Date? = try {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    formatter.parse(value)
} catch (_: Exception) {
    null
}
