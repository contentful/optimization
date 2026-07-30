package com.contentful.optimization.core

/**
 * The resolver's output. `entry` is the raw Map the JS bridge speaks; typed accessors
 * ([id], [contentTypeId], [getField], [getEntry], [getEntries], [getAsset]) mirror
 * `CDAEntry` so resolved content reads through the same surface as a fetched entry.
 */
public data class ResolvedOptimizedEntry(
    val entry: Map<String, Any>,
    val selectedOptimization: Map<String, Any>?,
    val optimizationContextId: String? = null,
) {

    public val id: String?
        get() = (entry["sys"] as? Map<*, *>)?.get("id") as? String

    public val contentTypeId: String?
        get() {
            val sys = entry["sys"] as? Map<*, *> ?: return null
            val contentType = sys["contentType"] as? Map<*, *> ?: return null
            val contentTypeSys = contentType["sys"] as? Map<*, *> ?: return null
            return contentTypeSys["id"] as? String
        }

    @Suppress("UNCHECKED_CAST")
    public fun <T> getField(name: String): T? =
        (entry["fields"] as? Map<*, *>)?.get(name) as? T

    /** Returns `null` for unresolved link stubs (no `fields` block) and non-Entry values. */
    @Suppress("UNCHECKED_CAST")
    public fun getEntry(name: String): ResolvedOptimizedEntry? {
        val value = (entry["fields"] as? Map<*, *>)?.get(name) as? Map<String, Any> ?: return null
        val sys = value["sys"] as? Map<*, *> ?: return null
        if (sys["type"] != "Entry" || value["fields"] == null) return null
        return ResolvedOptimizedEntry(entry = value, selectedOptimization = null)
    }

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

    @Suppress("UNCHECKED_CAST")
    public fun getAsset(name: String): ResolvedAsset? {
        val value = (entry["fields"] as? Map<*, *>)?.get(name) as? Map<String, Any> ?: return null
        val sys = value["sys"] as? Map<*, *> ?: return null
        if (sys["type"] != "Asset") return null
        return ResolvedAsset(value)
    }
}

public class ResolvedAsset internal constructor(public val raw: Map<String, Any>) {

    public val id: String?
        get() = (raw["sys"] as? Map<*, *>)?.get("id") as? String

    public val title: String?
        get() = (raw["fields"] as? Map<*, *>)?.get("title") as? String

    /** Protocol-relative CDA URLs (`//images.ctfassets.net/...`) get a `https:` prefix. */
    public val url: String?
        get() {
            val fields = raw["fields"] as? Map<*, *> ?: return null
            val file = fields["file"] as? Map<*, *> ?: return null
            val u = file["url"] as? String ?: return null
            return if (u.startsWith("//")) "https:$u" else u
        }
}
