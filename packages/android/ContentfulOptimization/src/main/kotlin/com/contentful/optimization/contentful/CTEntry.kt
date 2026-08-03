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
 * Backed by a typed internal envelope; the raw Map shape is reachable via [toFoundation].
 */
public class CTEntry internal constructor(private val envelope: Envelope) {

    public fun toFoundation(): Map<String, Any> = envelope.toFoundation()

    public fun toJSON(): String = JSONObject(toFoundation()).toString()

    public val id: String?
        get() = envelope.sys?.id

    public val localeCode: String?
        get() = envelope.sys?.locale

    public val createdAt: Date?
        get() = envelope.sys?.createdAt?.let(::parseIso8601)

    public val updatedAt: Date?
        get() = envelope.sys?.updatedAt?.let(::parseIso8601)

    public val contentTypeId: String?
        get() = envelope.sys?.contentTypeId

    @Suppress("UNCHECKED_CAST")
    public fun <T> getField(name: String): T? = envelope.fields[name] as? T

    public fun hasField(name: String): Boolean = envelope.fields.containsKey(name)

    public operator fun get(name: String): String? = getField(name)

    public companion object {
        internal val EMPTY: CTEntry = CTEntry(Envelope.empty())

        public fun from(entry: CDAEntry): CTEntry = CTEntry(Envelope.fromMap(toOptimizedEntryMap(entry)))

        /** Logs and returns [fallback] on parse failure — avoids throwing into the bridge. */
        public fun from(any: Map<String, Any>, fallback: CTEntry = EMPTY): CTEntry = try {
            CTEntry(Envelope.fromMap(jsonObjectToMap(JSONObject(any))))
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
            return CTEntry(Envelope.fromMap(jsonObjectToMap(obj)))
        }
    }

    /**
     * Typed internal shape mirroring iOS's `CDA.Entry` Codable struct. The resolver's Map shape
     * is preserved end-to-end: [fromMap] parses a resolver Map into this envelope, and
     * [toFoundation] reconstructs the same Map for consumers/bridge calls.
     */
    internal data class Envelope(
        val sys: Sys?,
        val fields: Map<String, Any>,
        val metadata: Metadata?,
    ) {

        fun toFoundation(): Map<String, Any> = buildMap {
            sys?.let { put("sys", it.toFoundation()) }
            put("fields", fields)
            metadata?.let { put("metadata", it.toFoundation()) }
        }

        internal data class Sys(
            val id: String?,
            val type: String?,
            val contentTypeId: String?,
            val createdAt: String?,
            val updatedAt: String?,
            val revision: Number?,
            val locale: String?,
            val extras: Map<String, Any>,
        ) {

            fun toFoundation(): Map<String, Any> = buildMap {
                id?.let { put("id", it) }
                type?.let { put("type", it) }
                contentTypeId?.let {
                    put(
                        "contentType",
                        mapOf(
                            "sys" to mapOf("id" to it, "type" to "Link", "linkType" to "ContentType"),
                        ),
                    )
                }
                createdAt?.let { put("createdAt", it) }
                updatedAt?.let { put("updatedAt", it) }
                revision?.let { put("revision", it) }
                locale?.let { put("locale", it) }
                putAll(extras)
            }

            companion object {
                fun fromMap(map: Map<*, *>): Sys {
                    // Pull out the keys we type explicitly; carry unknowns through in `extras`
                    // so a resolver Map with e.g. `space`/`environment` links round-trips.
                    val known = setOf("id", "type", "contentType", "createdAt", "updatedAt", "revision", "locale")
                    val contentTypeId = (map["contentType"] as? Map<*, *>)
                        ?.let { it["sys"] as? Map<*, *> }
                        ?.let { it["id"] as? String }
                    return Sys(
                        id = map["id"] as? String,
                        type = map["type"] as? String,
                        contentTypeId = contentTypeId,
                        createdAt = map["createdAt"] as? String,
                        updatedAt = map["updatedAt"] as? String,
                        revision = map["revision"] as? Number,
                        locale = map["locale"] as? String,
                        extras = map.entries
                            .filter { it.key is String && it.key !in known }
                            .associate { (k, v) -> (k as String) to (v as Any) },
                    )
                }
            }
        }

        internal data class Metadata(val tags: List<Any>, val concepts: List<Any>) {
            fun toFoundation(): Map<String, Any> = mapOf("tags" to tags, "concepts" to concepts)

            companion object {
                @Suppress("UNCHECKED_CAST")
                fun fromMap(map: Map<*, *>): Metadata = Metadata(
                    tags = (map["tags"] as? List<Any>) ?: emptyList(),
                    concepts = (map["concepts"] as? List<Any>) ?: emptyList(),
                )
            }
        }

        companion object {
            fun empty(): Envelope = Envelope(sys = null, fields = emptyMap(), metadata = null)

            @Suppress("UNCHECKED_CAST")
            fun fromMap(map: Map<String, Any>): Envelope = Envelope(
                sys = (map["sys"] as? Map<*, *>)?.let(Sys.Companion::fromMap),
                fields = (map["fields"] as? Map<String, Any>) ?: emptyMap(),
                metadata = (map["metadata"] as? Map<*, *>)?.let(Metadata.Companion::fromMap),
            )
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
