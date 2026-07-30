package com.contentful.optimization.core

/**
 * The resolver's output. `entry` is the untyped Map that the JS bridge and the internal
 * resolver contract speak; the typed accessors on this class ([id], [contentTypeId],
 * [getField], [getEntry], [getEntries], [getAsset]) are the recommended way to read that Map
 * from Compose / View content callbacks — they mirror `CDAEntry.id()` / `CDAEntry.getField`
 * so resolved content reads through the same surface as a fetched entry.
 *
 * `entry` stays public as an escape hatch for consumers that need the raw shape (e.g.
 * handing it to another SDK entry point that takes a Map).
 */
public data class ResolvedOptimizedEntry(
    val entry: Map<String, Any>,
    val selectedOptimization: Map<String, Any>?,
    val optimizationContextId: String? = null,
) {

    /** The entry `sys.id`. Stable across a variant swap — safe as a navigation key. */
    public val id: String?
        get() = (entry["sys"] as? Map<*, *>)?.get("id") as? String

    /** The entry's `sys.contentType.sys.id`. */
    public val contentTypeId: String?
        get() {
            val sys = entry["sys"] as? Map<*, *> ?: return null
            val contentType = sys["contentType"] as? Map<*, *> ?: return null
            val contentTypeSys = contentType["sys"] as? Map<*, *> ?: return null
            return contentTypeSys["id"] as? String
        }

    /**
     * A resolved field's value, or `null` if the field is absent or the cast fails. Mirrors
     * `CDAEntry.getField<T>(name)`.
     */
    @Suppress("UNCHECKED_CAST")
    public fun <T> getField(name: String): T? =
        (entry["fields"] as? Map<*, *>)?.get(name) as? T

    /**
     * Resolved entry link at the given field. Returns `null` when the field is absent, the
     * value is an unresolved link stub (no `fields` block), or the value is not an Entry.
     */
    @Suppress("UNCHECKED_CAST")
    public fun getEntry(name: String): ResolvedOptimizedEntry? {
        val value = (entry["fields"] as? Map<*, *>)?.get(name) as? Map<String, Any> ?: return null
        val sys = value["sys"] as? Map<*, *> ?: return null
        if (sys["type"] != "Entry" || value["fields"] == null) return null
        return ResolvedOptimizedEntry(entry = value, selectedOptimization = null)
    }

    /**
     * Resolved entry links at the given field. Skips unresolved link stubs and non-Entry
     * items; returns an empty list when the field is absent or empty.
     */
    @Suppress("UNCHECKED_CAST")
    public fun getEntries(name: String): List<ResolvedOptimizedEntry> {
        val list = (entry["fields"] as? Map<*, *>)?.get(name) as? List<*> ?: return emptyList()
        return list.mapNotNull { item ->
            val entryMap = item as? Map<String, Any> ?: return@mapNotNull null
            val sys = entryMap["sys"] as? Map<*, *> ?: return@mapNotNull null
            if (sys["type"] != "Entry" || entryMap["fields"] == null) return@mapNotNull null
            ResolvedOptimizedEntry(entry = entryMap, selectedOptimization = null)
        }
    }

    /**
     * Resolved [ResolvedAsset] link at the given field, or `null` when the field is absent
     * or is not an Asset.
     */
    @Suppress("UNCHECKED_CAST")
    public fun getAsset(name: String): ResolvedAsset? {
        val value = (entry["fields"] as? Map<*, *>)?.get(name) as? Map<String, Any> ?: return null
        val sys = value["sys"] as? Map<*, *> ?: return null
        if (sys["type"] != "Asset") return null
        return ResolvedAsset(value)
    }
}

/**
 * Typed view over a resolved asset link — the counterpart of `CDAAsset` on the resolver's
 * output side.
 */
public class ResolvedAsset internal constructor(public val raw: Map<String, Any>) {

    /** The asset `sys.id`. */
    public val id: String?
        get() = (raw["sys"] as? Map<*, *>)?.get("id") as? String

    /** The asset's `fields.title`. */
    public val title: String?
        get() = (raw["fields"] as? Map<*, *>)?.get("title") as? String

    /**
     * The asset file URL, with a `https:` prefix added when the raw value is a
     * protocol-relative `//images.ctfassets.net/...` URL. Matches how `CDAAsset.url()` is
     * typically consumed in Android UI code.
     */
    public val url: String?
        get() {
            val fields = raw["fields"] as? Map<*, *> ?: return null
            val file = fields["file"] as? Map<*, *> ?: return null
            val u = file["url"] as? String ?: return null
            return if (u.startsWith("//")) "https:$u" else u
        }
}
