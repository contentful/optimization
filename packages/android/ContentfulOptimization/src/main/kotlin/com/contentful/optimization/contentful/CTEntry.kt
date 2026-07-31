package com.contentful.optimization.contentful

import com.contentful.java.cda.CDAEntry
import com.contentful.optimization.core.DiagnosticLogger
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Bridges `contentful.java`'s [CDAEntry] and the resolver's raw JSON (`{sys, fields, metadata}`).
 *
 * Three constructors normalize the input to the same internal Map shape:
 *   - [CTEntry.from]`(entry: CDAEntry)` maps a resolved CDA entry via the adapter.
 *   - [CTEntry.from]`(any: Map<String, Any>)` accepts a pre-shaped map (raw CDA response, or the
 *     resolver's output map — the same shape both cases produce).
 *   - [CTEntry.from]`(json: String)` parses a JSON string.
 *
 * Serializers ([toFoundation], [toJSON]) round-trip the map back out; accessors ([id], [localeCode],
 * [createdAt], [updatedAt], [contentTypeId], [getField], [hasField]) mirror `CDAEntry.id()` /
 * `CDAEntry.getField` so a resolved variant reads through the same surface as a fetched entry.
 *
 * `getField<Int>` will not match an integer field that round-tripped through JSON as a `Double`
 * (org.json converts numeric literals per JSON's number rules); read `Number` or `Double` when the
 * value crosses a JSON boundary.
 */
public class CTEntry internal constructor(private val envelope: Map<String, Any>) {

    // MARK: - Serializing

    public fun toFoundation(): Map<String, Any> = envelope

    public fun toJSON(): String = JSONObject(envelope).toString()

    // MARK: - Accessors mirroring CDAEntry

    /** The entry `sys.id`. Stable across a variant swap — safe as a navigation key. */
    public val id: String?
        get() = sysMap()?.get("id") as? String

    /** Mirrors `CDAEntry` locale attribute. Absent on `/sync` or wildcard `locale=*` responses. */
    public val localeCode: String?
        get() = sysMap()?.get("locale") as? String

    public val createdAt: Date?
        get() = (sysMap()?.get("createdAt") as? String)?.let(::parseIso8601)

    public val updatedAt: Date?
        get() = (sysMap()?.get("updatedAt") as? String)?.let(::parseIso8601)

    /** The entry's `sys.contentType.sys.id`. */
    public val contentTypeId: String?
        get() {
            val contentType = sysMap()?.get("contentType") as? Map<*, *> ?: return null
            val contentTypeSys = contentType["sys"] as? Map<*, *> ?: return null
            return contentTypeSys["id"] as? String
        }

    /**
     * A field's resolved value cast to [T], or `null` when the field is absent or its value's
     * runtime type does not match [T]. Mirrors `CDAEntry.getField<T>(name)`.
     */
    @Suppress("UNCHECKED_CAST")
    public fun <T> getField(name: String): T? =
        (envelope["fields"] as? Map<*, *>)?.get(name) as? T

    /** Whether a field is present, regardless of its value's type. */
    public fun hasField(name: String): Boolean =
        (envelope["fields"] as? Map<*, *>)?.containsKey(name) == true

    /** Kotlin idiom for iOS's `entry[field: "name"]` subscript. */
    public operator fun get(name: String): String? = getField(name)

    private fun sysMap(): Map<*, *>? = envelope["sys"] as? Map<*, *>

    public companion object {
        internal val EMPTY: CTEntry = CTEntry(emptyMap())

        public fun from(entry: CDAEntry): CTEntry = CTEntry(toOptimizedEntryMap(entry))

        /**
         * Wraps [any] as a CTEntry, logging and falling back to [fallback] (empty by default) on
         * a parse failure rather than throwing. The bridge is called with the resulting map; a
         * failure to shape [any] as JSON at all would otherwise surface as an exception deep
         * inside `resolveOptimizedEntry`.
         *
         * Matches the iOS `CTEntry.parseWithFallback` pattern.
         */
        public fun from(any: Map<String, Any>, fallback: CTEntry = EMPTY): CTEntry = try {
            CTEntry(jsonObjectToMap(JSONObject(any)))
        } catch (e: Exception) {
            DiagnosticLogger.warning { "[CTEntry] Failed to parse entry map: ${e.message}" }
            fallback
        }

        /**
         * Parses [json] and wraps the resulting map. Logs and returns [fallback] (empty by
         * default) when the root is not a JSON object (an array, primitive, or malformed input).
         */
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
            return CTEntry(jsonObjectToMap(obj))
        }
    }
}

// -- JSON -> Map/List/primitives ----------------------------------------------

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

// -- ISO-8601 parsing ---------------------------------------------------------

private fun parseIso8601(value: String): Date? = try {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    formatter.parse(value)
} catch (_: Exception) {
    null
}
