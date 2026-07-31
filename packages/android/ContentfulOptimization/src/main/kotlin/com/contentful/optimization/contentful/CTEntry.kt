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
 * Accessors mirror `CDAEntry` so a resolved variant reads the same way as a fetched entry.
 */
public class CTEntry internal constructor(private val envelope: Map<String, Any>) {

    public fun toFoundation(): Map<String, Any> = envelope

    public fun toJSON(): String = JSONObject(envelope).toString()

    public val id: String?
        get() = sysMap()?.get("id") as? String

    public val localeCode: String?
        get() = sysMap()?.get("locale") as? String

    public val createdAt: Date?
        get() = (sysMap()?.get("createdAt") as? String)?.let(::parseIso8601)

    public val updatedAt: Date?
        get() = (sysMap()?.get("updatedAt") as? String)?.let(::parseIso8601)

    public val contentTypeId: String?
        get() {
            val contentType = sysMap()?.get("contentType") as? Map<*, *> ?: return null
            val contentTypeSys = contentType["sys"] as? Map<*, *> ?: return null
            return contentTypeSys["id"] as? String
        }

    @Suppress("UNCHECKED_CAST")
    public fun <T> getField(name: String): T? =
        (envelope["fields"] as? Map<*, *>)?.get(name) as? T

    public fun hasField(name: String): Boolean =
        (envelope["fields"] as? Map<*, *>)?.containsKey(name) == true

    public operator fun get(name: String): String? = getField(name)

    private fun sysMap(): Map<*, *>? = envelope["sys"] as? Map<*, *>

    public companion object {
        internal val EMPTY: CTEntry = CTEntry(emptyMap())

        public fun from(entry: CDAEntry): CTEntry = CTEntry(toOptimizedEntryMap(entry))

        /** Logs and returns [fallback] on parse failure — avoids throwing into the bridge. */
        public fun from(any: Map<String, Any>, fallback: CTEntry = EMPTY): CTEntry = try {
            CTEntry(jsonObjectToMap(JSONObject(any)))
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
            return CTEntry(jsonObjectToMap(obj))
        }
    }
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
