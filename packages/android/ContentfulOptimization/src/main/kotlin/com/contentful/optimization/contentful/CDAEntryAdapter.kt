package com.contentful.optimization.contentful

import com.contentful.java.cda.CDAAsset
import com.contentful.java.cda.CDAEntry
import com.contentful.java.cda.CDAMetadata
import com.contentful.java.cda.CDATag
import com.contentful.java.cda.CDATaxonomyConcept
import com.contentful.java.cda.rich.CDARichBlock
import com.contentful.java.cda.rich.CDARichEmbeddedBlock
import com.contentful.java.cda.rich.CDARichEmbeddedInline
import com.contentful.java.cda.rich.CDARichHyperLink
import com.contentful.java.cda.rich.CDARichNode
import com.contentful.java.cda.rich.CDARichText
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Adapts a [CDAEntry] into the `{sys, fields, metadata}` Map the resolver expects. `metadata`
 * is always emitted — the resolver's entry guard requires it and `CDAEntry.rawFields()` does
 * not expose it.
 */
internal fun toOptimizedEntryMap(entry: CDAEntry): Map<String, Any> = entryToMap(entry, emptySet())

// `ancestors` tracks entry ids on the current path. Recursing into one would loop forever on a
// real cycle in the resolved link graph; back-edges emit an unresolved Link stub instead.
private fun entryToMap(entry: CDAEntry, ancestors: Set<String>): Map<String, Any> {
    val sys = buildMap {
        put("id", entry.id() ?: "")
        put("type", "Entry")
        put(
            "contentType",
            mapOf(
                "sys" to mapOf(
                    "id" to (entry.contentType()?.id() ?: ""),
                    "type" to "Link",
                    "linkType" to "ContentType",
                ),
            ),
        )
        entry.getAttribute<String?>("createdAt")?.let { put("createdAt", it) }
        entry.getAttribute<String?>("updatedAt")?.let { put("updatedAt", it) }
        entry.getAttribute<Number?>("revision")?.let { put("revision", it) }
        entry.getAttribute<String?>("locale")?.let { put("locale", it) }
        linkRefOrNull(entry.getAttribute("space"), "Space")?.let { put("space", it) }
        linkRefOrNull(entry.getAttribute("environment"), "Environment")?.let { put("environment", it) }
    }
    val childAncestors = ancestors + entry.id()
    val fields = entry.rawFields().keys.associateWith { key ->
        convertValue(entry.getField<Any?>(key), childAncestors)
    }
    return mapOf(
        "sys" to sys,
        "fields" to fields,
        "metadata" to metadataOf(entry.metadata()),
    )
}

private fun linkRefOrNull(value: Any?, linkType: String): Map<String, Any>? {
    val sys = (value as? Map<*, *>)?.get("sys") as? Map<*, *> ?: return null
    val id = sys["id"] as? String ?: return null
    return mapOf("sys" to mapOf("id" to id, "type" to "Link", "linkType" to linkType))
}

private fun metadataOf(metadata: CDAMetadata?): Map<String, Any> = mapOf(
    "tags" to (metadata?.tags?.map { tagToMap(it) } ?: emptyList<Any>()),
    "concepts" to (metadata?.concepts?.map { conceptToMap(it) } ?: emptyList<Any>()),
)

private fun tagToMap(tag: CDATag): Map<String, Any> = mapOf(
    "sys" to mapOf(
        "id" to (tag.id() ?: ""),
        "type" to "Link",
        "linkType" to "Tag",
    ),
)

private fun conceptToMap(concept: CDATaxonomyConcept): Map<String, Any> = mapOf(
    "sys" to mapOf(
        "id" to (concept.id() ?: ""),
        "type" to "Link",
        "linkType" to "TaxonomyConcept",
    ),
)

private fun convertValue(value: Any?, ancestors: Set<String>): Any? = when (value) {
    is CDAEntry -> if (value.id() in ancestors) linkStub(value) else entryToMap(value, ancestors)
    is CDAAsset -> assetToMap(value)
    is CDARichNode -> richNodeToMap(value, ancestors)
    is Date -> iso8601Formatter.format(value)
    is List<*> -> value.map { convertValue(it, ancestors) }
    is Map<*, *> -> value.entries.associate { (k, v) -> k.toString() to convertValue(v, ancestors) }
    else -> value
}

private val iso8601Formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private fun linkStub(entry: CDAEntry): Map<String, Any> = mapOf(
    "sys" to mapOf(
        "id" to (entry.id() ?: ""),
        "type" to "Link",
        "linkType" to "Entry",
    ),
)

private fun assetToMap(asset: CDAAsset): Map<String, Any> {
    val fileMap = asset.getField<Map<String, Any?>?>("file") ?: emptyMap()
    val detailsRaw = fileMap["details"] as? Map<*, *>
    val details = buildMap<String, Any> {
        put("size", (detailsRaw?.get("size") as? Number) ?: 0)
        val imageInfo = detailsRaw?.get("image") as? Map<*, *>
        if (imageInfo != null) {
            put(
                "image",
                mapOf(
                    "width" to ((imageInfo["width"] as? Number) ?: 0),
                    "height" to ((imageInfo["height"] as? Number) ?: 0),
                ),
            )
        }
    }
    val file = mapOf(
        "fileName" to ((fileMap["fileName"] as? String) ?: ""),
        "contentType" to (asset.mimeType() ?: ""),
        "details" to details,
        "url" to (asset.url() ?: ""),
    )
    return mapOf(
        "sys" to mapOf(
            "id" to (asset.id() ?: ""),
            "type" to "Asset",
        ),
        "fields" to buildMap {
            put("title", asset.title() ?: "")
            asset.getField<String?>("description")?.let { put("description", it) }
            put("file", file)
        },
    )
}

// Embedded resource nodes extend CDARichHyperLink; their branches must match before the
// generic hyperlink case, or an embedded entry would emit `data.uri` and lose its target.
private fun richNodeToMap(node: CDARichNode, ancestors: Set<String>): Map<String, Any> = when (node) {
    is CDARichText -> mapOf(
        "nodeType" to (node.nodeType ?: "text"),
        "value" to node.text.toString(),
        "marks" to node.marks.map { mapOf("type" to (it.type ?: "")) },
        "data" to emptyMap<String, Any>(),
    )
    is CDARichEmbeddedBlock -> mapOf(
        "nodeType" to (node.nodeType ?: ""),
        "data" to mapOf("target" to (convertValue(node.data, ancestors) ?: emptyMap<String, Any>())),
        "content" to node.content.map { richNodeToMap(it, ancestors) },
    )
    is CDARichEmbeddedInline -> mapOf(
        "nodeType" to (node.nodeType ?: ""),
        "data" to mapOf("target" to (convertValue(node.data, ancestors) ?: emptyMap<String, Any>())),
        "content" to node.content.map { richNodeToMap(it, ancestors) },
    )
    is CDARichHyperLink -> mapOf(
        "nodeType" to (node.nodeType ?: ""),
        "data" to mapOf("uri" to (node.data as? String ?: "")),
        "content" to node.content.map { richNodeToMap(it, ancestors) },
    )
    is CDARichBlock -> mapOf(
        "nodeType" to (node.nodeType ?: ""),
        "data" to emptyMap<String, Any>(),
        "content" to node.content.map { richNodeToMap(it, ancestors) },
    )
    else -> mapOf(
        "nodeType" to (node.nodeType ?: ""),
        "data" to emptyMap<String, Any>(),
    )
}
