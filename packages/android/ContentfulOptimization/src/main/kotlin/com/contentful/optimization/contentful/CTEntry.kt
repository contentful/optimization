package com.contentful.optimization.contentful

import com.contentful.java.cda.CDAEntry
import com.contentful.optimization.core.DiagnosticLogger
import com.google.gson.Gson
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Bridges `contentful.java`'s [CDAEntry] and the resolver's raw JSON (`{sys, fields, metadata}`).
 * Backed by an SDK-owned entry model Gson serializes natively — no reflection into `contentful.java`
 * internals. Accessors mirror `CDAEntry` so a resolved variant reads through the same surface as
 * a fetched entry.
 */
public class CTEntry internal constructor(private val entry: Entry) {

    public fun toMap(): Map<String, Any> = gson.fromJson(gson.toJson(entry), Map::class.java) as Map<String, Any>

    public fun toJSON(): String = gson.toJson(entry)

    public val id: String? get() = entry.sys?.id

    public val contentTypeId: String? get() = entry.sys?.contentType?.sys?.id

    public val localeCode: String? get() = entry.sys?.locale

    public val createdAt: Date? get() = entry.sys?.createdAt?.let(::parseIso8601)

    public val updatedAt: Date? get() = entry.sys?.updatedAt?.let(::parseIso8601)

    @Suppress("UNCHECKED_CAST")
    public fun <T> getField(name: String): T? = entry.fields[name] as? T

    public fun hasField(name: String): Boolean = entry.fields.containsKey(name)

    public operator fun get(name: String): String? = getField(name)

    public companion object {
        internal val EMPTY: CTEntry = CTEntry(Entry(sys = null, fields = emptyMap(), metadata = null))

        public fun from(entry: CDAEntry): CTEntry = CTEntry(Entry.fromResolverMap(toOptimizedEntryMap(entry)))

        public fun from(any: Map<String, Any>, fallback: CTEntry = EMPTY): CTEntry = try {
            check(!hasCycle(any)) { "cyclic map" }
            CTEntry(Entry.fromResolverMap(any))
        } catch (e: Exception) {
            DiagnosticLogger.warning { "[CTEntry] Failed to parse entry map: ${e.message}" }
            fallback
        }

        public fun from(json: String, fallback: CTEntry = EMPTY): CTEntry = try {
            CTEntry(gson.fromJson(json, Entry::class.java) ?: error("root is not a JSON object"))
        } catch (e: Exception) {
            DiagnosticLogger.warning { "[CTEntry] Failed to parse entry JSON: ${e.message}" }
            fallback
        }
    }

    /** SDK-owned entry model. Gson serializes it natively without reflection. */
    internal data class Entry(
        val sys: Sys?,
        val fields: Map<String, Any>,
        val metadata: Metadata?,
    ) {
        data class Sys(
            val id: String?,
            val type: String?,
            val locale: String?,
            val createdAt: String?,
            val updatedAt: String?,
            val revision: Number?,
            val contentType: ContentTypeLink?,
            val space: LinkRef?,
            val environment: LinkRef?,
        )
        data class ContentTypeLink(val sys: LinkStub)
        data class LinkRef(val sys: LinkStub)
        data class LinkStub(val id: String?, val type: String?, val linkType: String?)
        data class Metadata(val tags: List<Any>?, val concepts: List<Any>?)

        companion object {
            fun fromResolverMap(map: Map<String, Any>): Entry =
                gson.fromJson(gson.toJson(map), Entry::class.java)
        }
    }
}

// Shared Gson instance — no custom configuration; the SDK-owned Entry has stable field names
// that match the raw CDA response shape.
private val gson: Gson = Gson()

// Reject self-referential input Maps up-front so Gson's serializer doesn't blow its stack on
// them. Tracks the *ancestors on the current path* (identity-based) — not a global visited set,
// because shared singletons like `emptyList()` legitimately appear in multiple sibling positions.
private fun hasCycle(root: Map<*, *>): Boolean {
    fun visit(value: Any?, path: java.util.IdentityHashMap<Any, Unit>): Boolean =
        when (value) {
            is Map<*, *> -> {
                if (path.containsKey(value)) true
                else {
                    path[value] = Unit
                    val cycle = value.values.any { visit(it, path) }
                    path.remove(value)
                    cycle
                }
            }
            is List<*> -> {
                if (path.containsKey(value)) true
                else {
                    path[value] = Unit
                    val cycle = value.any { visit(it, path) }
                    path.remove(value)
                    cycle
                }
            }
            else -> false
        }
    return visit(root, java.util.IdentityHashMap())
}

// Locale.ROOT for the parser: CDA timestamps are ASCII digits + UTC, locale-invariant.
private val iso8601Formatter: ThreadLocal<SimpleDateFormat> = object : ThreadLocal<SimpleDateFormat>() {
    override fun initialValue(): SimpleDateFormat =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ROOT).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
}

private fun parseIso8601(value: String): Date? = try {
    iso8601Formatter.get()!!.parse(value)
} catch (_: Exception) {
    null
}
