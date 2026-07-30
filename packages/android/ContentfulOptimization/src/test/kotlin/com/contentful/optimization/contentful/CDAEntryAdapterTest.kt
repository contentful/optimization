package com.contentful.optimization.contentful

import com.contentful.java.cda.CDAAsset
import com.contentful.java.cda.CDAContentType
import com.contentful.java.cda.CDAEntry
import com.contentful.java.cda.CDAMetadata
import com.contentful.java.cda.CDAResource
import com.contentful.java.cda.CDATag
import com.contentful.java.cda.CDATaxonomyConcept
import com.contentful.java.cda.LocalizedResource
import com.contentful.java.cda.rich.CDARichBlock
import com.contentful.java.cda.rich.CDARichDocument
import com.contentful.java.cda.rich.CDARichMark
import com.contentful.java.cda.rich.CDARichParagraph
import com.contentful.java.cda.rich.CDARichText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CDAEntryAdapterTest {

    @Test
    fun `maps sys, contentType, and empty metadata for a bare entry`() {
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("title" to "Hello"),
        )

        val map = entry.toOptimizedEntryMap()

        val sys = map["sys"] as Map<*, *>
        assertEquals("entry-1", sys["id"])
        assertEquals("Entry", sys["type"])
        val contentTypeSys = (sys["contentType"] as Map<*, *>)["sys"] as Map<*, *>
        assertEquals("page", contentTypeSys["id"])
        assertEquals("Link", contentTypeSys["type"])
        assertEquals("ContentType", contentTypeSys["linkType"])

        val fields = map["fields"] as Map<*, *>
        assertEquals("Hello", fields["title"])
    }

    @Test
    fun `always populates a metadata record even when CDAMetadata is null`() {
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("title" to "Hello"),
            metadata = null,
        )

        val map = entry.toOptimizedEntryMap()

        val metadata = map["metadata"]
        assertTrue("metadata must always be present", metadata is Map<*, *>)
        val md = metadata as Map<*, *>
        assertEquals(emptyList<Any>(), md["tags"])
        assertEquals(emptyList<Any>(), md["concepts"])
    }

    @Test
    fun `serializes metadata tags and taxonomy concepts as link references`() {
        val tag = makeTag(id = "spring-sale")
        val concept = makeConcept(id = "travel")
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("title" to "Hello"),
            metadata = makeMetadata(tags = listOf(tag), concepts = listOf(concept)),
        )

        val map = entry.toOptimizedEntryMap()
        val md = map["metadata"] as Map<*, *>

        val tags = md["tags"] as List<*>
        val tagSys = (tags[0] as Map<*, *>)["sys"] as Map<*, *>
        assertEquals("spring-sale", tagSys["id"])
        assertEquals("Tag", tagSys["linkType"])

        val concepts = md["concepts"] as List<*>
        val conceptSys = (concepts[0] as Map<*, *>)["sys"] as Map<*, *>
        assertEquals("travel", conceptSys["id"])
        assertEquals("TaxonomyConcept", conceptSys["linkType"])
    }

    @Test
    fun `expands nested resolved CDAEntry links recursively`() {
        val child = makeEntry(
            id = "child",
            contentTypeId = "author",
            rawFields = mapOf("name" to "Ada"),
        )
        val parent = makeEntry(
            id = "parent",
            contentTypeId = "post",
            rawFields = mapOf("author" to child),
        )

        val map = parent.toOptimizedEntryMap()
        val fields = map["fields"] as Map<*, *>
        val authorMap = fields["author"] as Map<*, *>
        val authorSys = authorMap["sys"] as Map<*, *>
        assertEquals("child", authorSys["id"])
        assertEquals("Entry", authorSys["type"])
        assertTrue("nested entry must carry a metadata record", authorMap.containsKey("metadata"))
    }

    @Test
    fun `emits an unresolved Link stub on a back-edge instead of recursing forever`() {
        val parent = makeEntry(id = "parent", contentTypeId = "post", rawFields = emptyMap())
        val child = makeEntry(
            id = "child",
            contentTypeId = "author",
            rawFields = mapOf("posts" to parent),
        )
        setField(parent, "rawFields", localizeFields(mapOf("author" to child)))
        setField(parent, "fields", localizeFields(mapOf("author" to child)))

        val map = parent.toOptimizedEntryMap()
        val author = ((map["fields"] as Map<*, *>)["author"] as Map<*, *>)
        val posts = author["fields"] as Map<*, *>
        val backRef = posts["posts"] as Map<*, *>
        val backSys = backRef["sys"] as Map<*, *>
        assertEquals("parent", backSys["id"])
        assertEquals("Link", backSys["type"])
        assertEquals("Entry", backSys["linkType"])
        assertNull("cycle stub must not expand fields", backRef["fields"])
    }

    @Test
    fun `maps CDAAsset to a link-shaped asset record`() {
        val asset = makeAsset(
            id = "asset-1",
            title = "Sunset",
            url = "//images.ctfassets.net/x/sunset.jpg",
        )
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("hero" to asset),
        )

        val map = entry.toOptimizedEntryMap()
        val hero = (map["fields"] as Map<*, *>)["hero"] as Map<*, *>
        val heroSys = hero["sys"] as Map<*, *>
        assertEquals("asset-1", heroSys["id"])
        assertEquals("Asset", heroSys["type"])
        val file = (hero["fields"] as Map<*, *>)["file"] as Map<*, *>
        assertEquals("//images.ctfassets.net/x/sunset.jpg", file["url"])
    }

    @Test
    fun `surfaces asset description, fileName, contentType, and image details`() {
        val asset = makeAsset(
            id = "asset-1",
            title = "Sunset",
            url = "//images.ctfassets.net/x/sunset.jpg",
            description = "A sunset over the mountains",
            fileName = "sunset.jpg",
            mimeType = "image/jpeg",
            size = 12345,
            imageWidth = 1920,
            imageHeight = 1080,
        )
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("hero" to asset),
        )

        val map = entry.toOptimizedEntryMap()
        val hero = (map["fields"] as Map<*, *>)["hero"] as Map<*, *>
        val heroFields = hero["fields"] as Map<*, *>
        assertEquals("A sunset over the mountains", heroFields["description"])
        val file = heroFields["file"] as Map<*, *>
        assertEquals("sunset.jpg", file["fileName"])
        assertEquals("image/jpeg", file["contentType"])
        val details = file["details"] as Map<*, *>
        assertEquals(12345, details["size"])
        val image = details["image"] as Map<*, *>
        assertEquals(1920, image["width"])
        assertEquals(1080, image["height"])
    }

    @Test
    fun `iso8601 formats Date field values instead of falling through to toString`() {
        val instant = java.util.Date(1_700_000_000_000L)
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("publishedAt" to instant),
        )

        val map = entry.toOptimizedEntryMap()
        val published = (map["fields"] as Map<*, *>)["publishedAt"] as String
        assertEquals("2023-11-14T22:13:20Z", published)
    }

    @Test
    fun `serializes rich text node tree into JSON node shape`() {
        val paragraph = CDARichParagraph().apply {
            setNodeType("paragraph")
            content.add(
                CDARichText(
                    "hi",
                    mutableListOf<CDARichMark>(CDARichMark.CDARichMarkBold()),
                ).apply { setNodeType("text") },
            )
        }
        val document = CDARichDocument().apply {
            setNodeType("document")
            content.add(paragraph)
        }
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("body" to document),
        )

        val map = entry.toOptimizedEntryMap()
        val body = (map["fields"] as Map<*, *>)["body"] as Map<*, *>
        assertEquals("document", body["nodeType"])
        val paragraphs = body["content"] as List<*>
        val p = paragraphs[0] as Map<*, *>
        assertEquals("paragraph", p["nodeType"])
        val text = (p["content"] as List<*>)[0] as Map<*, *>
        assertEquals("text", text["nodeType"])
        assertEquals("hi", text["value"])
        val marks = text["marks"] as List<*>
        assertEquals("bold", (marks[0] as Map<*, *>)["type"])
    }
}

// -- test fixtures --------------------------------------------------------

private const val TEST_LOCALE = "en-US"

private fun makeEntry(
    id: String,
    contentTypeId: String,
    rawFields: Map<String, Any?>,
    metadata: CDAMetadata? = makeMetadata(),
): CDAEntry {
    val entry = CDAEntry()
    setField(entry, "attrs", mutableMapOf<String, Any>("id" to id, "type" to "Entry"))
    setField(entry, "defaultLocale", TEST_LOCALE)
    setField(entry, "rawFields", localizeFields(rawFields))
    setField(entry, "fields", localizeFields(rawFields))
    setField(entry, "contentType", makeContentType(contentTypeId))
    setField(entry, "metadata", metadata)
    return entry
}

private fun localizeFields(fields: Map<String, Any?>): MutableMap<String, Any?> =
    fields.mapValuesTo(mutableMapOf()) { (_, value) ->
        mutableMapOf<String, Any?>(TEST_LOCALE to value)
    }

private fun makeContentType(id: String): CDAContentType {
    val ct = CDAContentType()
    setField(ct, "attrs", mutableMapOf<String, Any>("id" to id, "type" to "ContentType"))
    return ct
}

private fun makeAsset(
    id: String,
    title: String,
    url: String,
    description: String? = null,
    fileName: String? = null,
    mimeType: String? = null,
    size: Int? = null,
    imageWidth: Int? = null,
    imageHeight: Int? = null,
): CDAAsset {
    val asset = CDAAsset()
    setField(asset, "attrs", mutableMapOf<String, Any>("id" to id, "type" to "Asset"))
    setField(asset, "defaultLocale", TEST_LOCALE)
    val fileMap = mutableMapOf<String, Any?>("url" to url)
    fileName?.let { fileMap["fileName"] = it }
    mimeType?.let { fileMap["contentType"] = it }
    if (size != null || imageWidth != null) {
        val details = mutableMapOf<String, Any?>()
        if (size != null) details["size"] = size
        if (imageWidth != null && imageHeight != null) {
            details["image"] = mapOf("width" to imageWidth, "height" to imageHeight)
        }
        fileMap["details"] = details
    }
    val fields = mutableMapOf<String, Any?>(
        "title" to title,
        "file" to fileMap,
    )
    description?.let { fields["description"] = it }
    setField(asset, "fields", localizeFields(fields))
    setField(asset, "rawFields", localizeFields(fields))
    return asset
}

private fun makeTag(id: String): CDATag {
    val tag = CDATag()
    setField(tag, "attrs", mutableMapOf<String, Any>("id" to id, "type" to "Tag"))
    return tag
}

private fun makeConcept(id: String): CDATaxonomyConcept {
    val concept = CDATaxonomyConcept()
    setField(concept, "attrs", mutableMapOf<String, Any>("id" to id, "type" to "TaxonomyConcept"))
    return concept
}

private fun makeMetadata(
    tags: List<CDATag> = emptyList(),
    concepts: List<CDATaxonomyConcept> = emptyList(),
): CDAMetadata {
    val metadata = CDAMetadata()
    setField(metadata, "tags", tags.toMutableList())
    setField(metadata, "concepts", concepts.toMutableList())
    return metadata
}

/**
 * Reflectively write to a field declared on the given instance's class or any of its supers.
 * The `contentful.java` value types keep the fields the SDK needs (`attrs`, `rawFields`,
 * `fields`, `contentType`, `metadata`, `tags`, `concepts`) package-private or private with
 * only getter methods; deserializing full CDA responses to build fixtures would be much
 * heavier than reaching in directly here.
 */
private fun setField(target: Any, name: String, value: Any?) {
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

@Suppress("unused")
private val forceCDAResourceImport: Class<*> = CDAResource::class.java

@Suppress("unused")
private val forceLocalizedImport: Class<*> = LocalizedResource::class.java

@Suppress("unused")
private val forceRichBlockImport: Class<*> = CDARichBlock::class.java
