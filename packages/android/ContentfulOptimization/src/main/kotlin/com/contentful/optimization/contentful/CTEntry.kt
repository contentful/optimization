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
import com.contentful.optimization.core.DiagnosticLogger
import com.contentful.optimization.core.JSONValue
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonObject
import com.google.gson.JsonPrimitive
import com.google.gson.TypeAdapter
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import com.google.gson.stream.JsonWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

public class CTEntry internal constructor(@PublishedApi internal val entry: Entry) {

    public fun toMap(): Map<String, Any> = gson.fromJson(gson.toJson(entry), Map::class.java) as Map<String, Any>

    public fun toJSON(): String = gson.toJson(entry)

    public val id: String? get() = entry.sys?.id

    public val contentTypeId: String? get() = entry.sys?.contentType?.sys?.id

    public val localeCode: String? get() = entry.sys?.locale

    public val createdAt: Date? get() = entry.sys?.createdAt?.let(::parseIso8601)

    public val updatedAt: Date? get() = entry.sys?.updatedAt?.let(::parseIso8601)

    public inline fun <reified T> getField(name: String): T? = entry.fields[name]?.toTypedValue<T>()

    public fun hasField(name: String): Boolean = entry.fields.containsKey(name)

    public operator fun get(name: String): String? = getField(name)

    public companion object {
        internal val EMPTY: CTEntry = CTEntry(Entry(sys = null, fields = emptyMap(), metadata = null))

        public fun from(entry: CDAEntry): CTEntry = CTEntry(Entry.from(entry, emptySet()))

        public fun from(any: Map<String, Any>, fallback: CTEntry = EMPTY): CTEntry = try {
            check(!hasCycle(any)) { "cyclic map" }
            CTEntry(gson.fromJson(gson.toJson(any), Entry::class.java))
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

    @PublishedApi
    internal data class Entry(
        val sys: Sys?,
        val fields: Map<String, JSONValue>,
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
        ) {
            companion object {
                fun from(entry: CDAEntry): Sys = Sys(
                    id = entry.id() ?: "",
                    type = "Entry",
                    locale = entry.getAttribute<String?>("locale"),
                    createdAt = entry.getAttribute<String?>("createdAt"),
                    updatedAt = entry.getAttribute<String?>("updatedAt"),
                    revision = entry.getAttribute<Number?>("revision"),
                    contentType = entry.contentType()?.id()?.let {
                        ContentTypeLink(LinkStub(id = it, type = "Link", linkType = "ContentType"))
                    },
                    space = LinkRef.from(entry.getAttribute("space"), "Space"),
                    environment = LinkRef.from(entry.getAttribute("environment"), "Environment"),
                )
            }
        }

        data class ContentTypeLink(val sys: LinkStub)

        data class LinkRef(val sys: LinkStub) {
            companion object {
                fun from(value: Any?, linkType: String): LinkRef? {
                    val sysMap = (value as? Map<*, *>)?.get("sys") as? Map<*, *> ?: return null
                    val id = sysMap["id"] as? String ?: return null
                    return LinkRef(LinkStub(id = id, type = "Link", linkType = linkType))
                }
            }
        }

        data class LinkStub(val id: String?, val type: String?, val linkType: String?)

        data class Metadata(val tags: List<LinkRef>, val concepts: List<LinkRef>) {
            companion object {
                fun from(metadata: CDAMetadata?): Metadata = Metadata(
                    tags = metadata?.tags?.map { LinkRef(LinkStub(it.id(), "Link", "Tag")) } ?: emptyList(),
                    concepts = metadata?.concepts?.map { LinkRef(LinkStub(it.id(), "Link", "TaxonomyConcept")) } ?: emptyList(),
                )
            }
        }

        data class Asset(val sys: AssetSys, val fields: AssetFields) {
            data class AssetSys(val id: String, val type: String)

            data class AssetFields(val title: String, val description: String?, val file: FileMetadata)

            companion object {
                fun from(asset: CDAAsset): Asset = Asset(
                    sys = AssetSys(id = asset.id() ?: "", type = "Asset"),
                    fields = AssetFields(
                        title = asset.title() ?: "",
                        description = asset.getField<String?>("description"),
                        file = FileMetadata.from(asset),
                    ),
                )
            }
        }

        data class FileMetadata(
            val fileName: String,
            val contentType: String,
            val details: Details,
            val url: String,
        ) {
            data class Details(val size: Number, val image: ImageInfo?)

            data class ImageInfo(val width: Number, val height: Number)

            companion object {
                fun from(asset: CDAAsset): FileMetadata {
                    val fileMap = asset.getField<Map<String, Any?>?>("file") ?: emptyMap()
                    val detailsRaw = fileMap["details"] as? Map<*, *>
                    val imageInfo = (detailsRaw?.get("image") as? Map<*, *>)?.let {
                        ImageInfo(
                            width = (it["width"] as? Number) ?: 0,
                            height = (it["height"] as? Number) ?: 0,
                        )
                    }
                    return FileMetadata(
                        fileName = (fileMap["fileName"] as? String) ?: "",
                        contentType = asset.mimeType() ?: "",
                        details = Details(size = (detailsRaw?.get("size") as? Number) ?: 0, image = imageInfo),
                        url = asset.url() ?: "",
                    )
                }
            }
        }

        data class RichTextNode(
            val nodeType: String,
            val value: String? = null,
            val marks: List<Mark>? = null,
            val data: NodeData = NodeData(),
            val content: List<RichTextNode>? = null,
        ) {
            data class Mark(val type: String)

            data class NodeData(val uri: String? = null, val target: JSONValue? = null)

            companion object {
                // CDARichEmbeddedBlock/Inline extend CDARichHyperLink; branch on them first, or an
                // embedded entry would emit `data.uri` and lose its target.
                fun from(node: CDARichNode, ancestors: Set<String>): RichTextNode = when (node) {
                    is CDARichText -> RichTextNode(
                        nodeType = node.nodeType ?: "text",
                        value = node.text.toString(),
                        marks = node.marks.map { Mark(it.type ?: "") },
                    )
                    is CDARichEmbeddedBlock -> RichTextNode(
                        nodeType = node.nodeType ?: "",
                        data = NodeData(target = Field.from(node.data, ancestors).encoded()),
                        content = node.content.map { from(it, ancestors) },
                    )
                    is CDARichEmbeddedInline -> RichTextNode(
                        nodeType = node.nodeType ?: "",
                        data = NodeData(target = Field.from(node.data, ancestors).encoded()),
                        content = node.content.map { from(it, ancestors) },
                    )
                    is CDARichHyperLink -> RichTextNode(
                        nodeType = node.nodeType ?: "",
                        data = NodeData(uri = node.data as? String ?: ""),
                        content = node.content.map { from(it, ancestors) },
                    )
                    is CDARichBlock -> RichTextNode(
                        nodeType = node.nodeType ?: "",
                        content = node.content.map { from(it, ancestors) },
                    )
                    else -> RichTextNode(nodeType = node.nodeType ?: "")
                }
            }
        }

        companion object {
            // Back-edges emit an unresolved Link stub instead of recursing forever on a cycle in
            // the resolved link graph.
            fun from(entry: CDAEntry, ancestors: Set<String>): Entry {
                val childAncestors = ancestors + entry.id()
                val fields = entry.rawFields().keys.associateWith { key ->
                    Field.from(entry.getField<Any?>(key), childAncestors).encoded() ?: JSONValue.Null
                }
                return Entry(sys = Sys.from(entry), fields = fields, metadata = Metadata.from(entry.metadata()))
            }
        }
    }
}

private sealed class Field {
    abstract fun encoded(): JSONValue?

    data class Value(val value: JSONValue?) : Field() {
        override fun encoded(): JSONValue? = value
    }

    data class Link(val link: LinkKind) : Field() {
        override fun encoded(): JSONValue? = link.encoded()
    }

    data class RichText(val node: CTEntry.Entry.RichTextNode) : Field() {
        override fun encoded(): JSONValue? = encodeCodable(node)
    }

    data class Asset(val asset: CTEntry.Entry.Asset) : Field() {
        override fun encoded(): JSONValue? = encodeCodable(asset)
    }

    companion object {
        fun from(value: Any?, ancestors: Set<String>): Field = when (value) {
            is CDAEntry -> Link(LinkKind.from(value, ancestors))
            is CDAAsset -> Asset(CTEntry.Entry.Asset.from(value))
            is CDARichNode -> RichText(CTEntry.Entry.RichTextNode.from(value, ancestors))
            is Date -> Value(JSONValue.Str(iso8601Formatter.get()!!.format(value)))
            is List<*> -> Value(JSONValue.Array(value.map { from(it, ancestors).encoded() ?: JSONValue.Null }))
            is Map<*, *> -> Value(JSONValue.Obj(value.entries.associate { (k, v) ->
                k.toString() to (from(v, ancestors).encoded() ?: JSONValue.Null)
            }))
            null -> Value(JSONValue.Null)
            else -> Value(JSONValue.fromAny(value))
        }
    }
}

private sealed class LinkKind {
    abstract fun encoded(): JSONValue?

    data class EntryLink(val entry: CTEntry.Entry) : LinkKind() {
        override fun encoded(): JSONValue? = encodeCodable(entry)
    }

    data class Stub(val stub: CTEntry.Entry.LinkStub) : LinkKind() {
        override fun encoded(): JSONValue? = encodeCodable(stub.let {
            mapOf("sys" to mapOf("id" to (it.id ?: ""), "type" to "Link", "linkType" to (it.linkType ?: "Entry")))
        })
    }

    companion object {
        fun from(entry: CDAEntry, ancestors: Set<String>): LinkKind =
            if (entry.id() in ancestors) Stub(CTEntry.Entry.LinkStub(entry.id() ?: "", "Link", "Entry"))
            else EntryLink(CTEntry.Entry.from(entry, ancestors))
    }
}

private fun encodeCodable(value: Any): JSONValue =
    gson.toJsonTree(value).toJsonValue()

private class JSONValueTypeAdapter : TypeAdapter<JSONValue>() {
    override fun write(out: JsonWriter, value: JSONValue?) {
        when (value) {
            null, JSONValue.Null -> out.nullValue()
            is JSONValue.Bool -> out.value(value.value)
            is JSONValue.Number -> out.value(value.value)
            is JSONValue.Str -> out.value(value.value)
            is JSONValue.Array -> {
                out.beginArray()
                value.value.forEach { write(out, it) }
                out.endArray()
            }
            is JSONValue.Obj -> {
                out.beginObject()
                value.value.forEach { (k, v) -> out.name(k); write(out, v) }
                out.endObject()
            }
        }
    }

    override fun read(input: JsonReader): JSONValue = when (input.peek()) {
        JsonToken.NULL -> { input.nextNull(); JSONValue.Null }
        JsonToken.BOOLEAN -> JSONValue.Bool(input.nextBoolean())
        JsonToken.NUMBER -> JSONValue.Number(input.nextDouble())
        JsonToken.STRING -> JSONValue.Str(input.nextString())
        JsonToken.BEGIN_ARRAY -> {
            input.beginArray()
            val list = mutableListOf<JSONValue>()
            while (input.hasNext()) list += read(input)
            input.endArray()
            JSONValue.Array(list)
        }
        JsonToken.BEGIN_OBJECT -> {
            input.beginObject()
            val map = LinkedHashMap<String, JSONValue>()
            while (input.hasNext()) {
                val key = input.nextName()
                map[key] = read(input)
            }
            input.endObject()
            JSONValue.Obj(map)
        }
        else -> error("Unexpected token: ${input.peek()}")
    }
}

private val gson: Gson = GsonBuilder()
    .registerTypeAdapter(JSONValue::class.java, JSONValueTypeAdapter())
    .registerTypeAdapter(JSONValue.Null::class.java, JSONValueTypeAdapter())
    .registerTypeAdapter(JSONValue.Bool::class.java, JSONValueTypeAdapter())
    .registerTypeAdapter(JSONValue.Number::class.java, JSONValueTypeAdapter())
    .registerTypeAdapter(JSONValue.Str::class.java, JSONValueTypeAdapter())
    .registerTypeAdapter(JSONValue.Array::class.java, JSONValueTypeAdapter())
    .registerTypeAdapter(JSONValue.Obj::class.java, JSONValueTypeAdapter())
    .create()

private fun JsonElement.toJsonValue(): JSONValue = when {
    isJsonNull -> JSONValue.Null
    isJsonPrimitive -> {
        val prim = asJsonPrimitive
        when {
            prim.isBoolean -> JSONValue.Bool(prim.asBoolean)
            prim.isNumber -> JSONValue.Number(prim.asDouble)
            else -> JSONValue.Str(prim.asString)
        }
    }
    isJsonArray -> JSONValue.Array(asJsonArray.map { it.toJsonValue() })
    isJsonObject -> JSONValue.Obj(asJsonObject.entrySet().associate { it.key to it.value.toJsonValue() })
    else -> JSONValue.Null
}

// Tracks ancestors on the current path (identity-based) — a global visited set would false-positive
// on shared singletons like `emptyList()` that legitimately appear in multiple sibling positions.
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
