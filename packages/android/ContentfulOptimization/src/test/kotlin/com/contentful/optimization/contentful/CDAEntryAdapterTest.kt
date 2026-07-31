package com.contentful.optimization.contentful

import com.contentful.java.cda.CDAAsset
import com.contentful.java.cda.CDAContentType
import com.contentful.java.cda.CDAEntry
import com.contentful.java.cda.CDAMetadata
import com.contentful.java.cda.CDATag
import com.contentful.java.cda.CDATaxonomyConcept
import com.contentful.java.cda.rich.CDARichDocument
import com.contentful.java.cda.rich.CDARichHyperLink
import com.contentful.java.cda.rich.CDARichMark
import com.contentful.java.cda.rich.CDARichParagraph
import com.contentful.java.cda.rich.CDARichText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
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

        val map = toOptimizedEntryMap(entry)

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

        val map = toOptimizedEntryMap(entry)

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

        val map = toOptimizedEntryMap(entry)
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

        val map = toOptimizedEntryMap(parent)
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

        val map = toOptimizedEntryMap(parent)
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

        val map = toOptimizedEntryMap(entry)
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

        val map = toOptimizedEntryMap(entry)
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

        val map = toOptimizedEntryMap(entry)
        val published = (map["fields"] as Map<*, *>)["publishedAt"] as String
        assertEquals("2023-11-14T22:13:20Z", published)
    }

    // -- sys optional attrs -------------------------------------------------

    @Test
    fun `maps sys timestamps, revision, locale, space, and environment when present`() {
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = emptyMap(),
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-06-15T12:30:00Z",
            revision = 3,
            locale = "en-US",
            spaceId = "space-1",
            environmentId = "master",
        )

        val map = toOptimizedEntryMap(entry)
        val sys = map["sys"] as Map<*, *>
        assertEquals("2024-01-01T00:00:00Z", sys["createdAt"])
        assertEquals("2024-06-15T12:30:00Z", sys["updatedAt"])
        assertEquals(3, sys["revision"])
        assertEquals("en-US", sys["locale"])

        val space = (sys["space"] as Map<*, *>)["sys"] as Map<*, *>
        assertEquals("space-1", space["id"])
        assertEquals("Space", space["linkType"])

        val environment = (sys["environment"] as Map<*, *>)["sys"] as Map<*, *>
        assertEquals("master", environment["id"])
        assertEquals("Environment", environment["linkType"])
    }

    @Test
    fun `omits sys optional attrs when the source entry has none`() {
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = emptyMap(),
        )

        val sys = toOptimizedEntryMap(entry)["sys"] as Map<*, *>
        assertFalse("sys.locale must be omitted, not emitted as null", sys.containsKey("locale"))
        assertFalse(sys.containsKey("createdAt"))
        assertFalse(sys.containsKey("updatedAt"))
        assertFalse(sys.containsKey("revision"))
        assertFalse(sys.containsKey("space"))
        assertFalse(sys.containsKey("environment"))
    }

    // -- link resolution ----------------------------------------------------

    @Test
    fun `expands a diamond so both branches carry the full nested entry`() {
        val shared = makeEntry(
            id = "shared",
            contentTypeId = "author",
            rawFields = mapOf("name" to "Ada"),
        )
        val parent = makeEntry(
            id = "parent",
            contentTypeId = "post",
            rawFields = mapOf("author" to shared, "editor" to shared),
        )

        val map = toOptimizedEntryMap(parent)
        val fields = map["fields"] as Map<*, *>
        val authorFields = (fields["author"] as Map<*, *>)["fields"] as Map<*, *>
        val editorFields = (fields["editor"] as Map<*, *>)["fields"] as Map<*, *>
        assertEquals("Ada", authorFields["name"])
        assertEquals("Ada", editorFields["name"])
    }

    @Test
    fun `three-node cycle emits a link stub instead of recursing forever`() {
        val a = makeEntry(id = "a", contentTypeId = "n", rawFields = emptyMap())
        val b = makeEntry(id = "b", contentTypeId = "n", rawFields = emptyMap())
        val c = makeEntry(id = "c", contentTypeId = "n", rawFields = mapOf("next" to a))
        setField(a, "rawFields", localizeFields(mapOf("next" to b)))
        setField(a, "fields", localizeFields(mapOf("next" to b)))
        setField(b, "rawFields", localizeFields(mapOf("next" to c)))
        setField(b, "fields", localizeFields(mapOf("next" to c)))

        val map = toOptimizedEntryMap(a)
        val bMap = (map["fields"] as Map<*, *>)["next"] as Map<*, *>
        val cMap = (bMap["fields"] as Map<*, *>)["next"] as Map<*, *>
        val backEdge = (cMap["fields"] as Map<*, *>)["next"] as Map<*, *>
        val backSys = backEdge["sys"] as Map<*, *>
        assertEquals("a", backSys["id"])
        assertEquals("Link", backSys["type"])
        assertNull(backEdge["fields"])
    }

    @Test
    fun `self-referencing entry emits a link stub at the self edge`() {
        val self = makeEntry(id = "self", contentTypeId = "n", rawFields = emptyMap())
        setField(self, "rawFields", localizeFields(mapOf("self" to self)))
        setField(self, "fields", localizeFields(mapOf("self" to self)))

        val map = toOptimizedEntryMap(self)
        val backRef = (map["fields"] as Map<*, *>)["self"] as Map<*, *>
        val backSys = backRef["sys"] as Map<*, *>
        assertEquals("self", backSys["id"])
        assertEquals("Link", backSys["type"])
    }

    @Test
    fun `five-level linear chain expands at every level`() {
        val a5 = makeEntry(id = "e5", contentTypeId = "n", rawFields = mapOf("name" to "leaf"))
        val a4 = makeEntry(id = "e4", contentTypeId = "n", rawFields = mapOf("next" to a5))
        val a3 = makeEntry(id = "e3", contentTypeId = "n", rawFields = mapOf("next" to a4))
        val a2 = makeEntry(id = "e2", contentTypeId = "n", rawFields = mapOf("next" to a3))
        val a1 = makeEntry(id = "e1", contentTypeId = "n", rawFields = mapOf("next" to a2))

        val map = toOptimizedEntryMap(a1)
        val level2 = ((map["fields"] as Map<*, *>)["next"]) as Map<*, *>
        val level3 = (level2["fields"] as Map<*, *>)["next"] as Map<*, *>
        val level4 = (level3["fields"] as Map<*, *>)["next"] as Map<*, *>
        val level5 = (level4["fields"] as Map<*, *>)["next"] as Map<*, *>
        assertEquals("leaf", (level5["fields"] as Map<*, *>)["name"])
    }

    @Test
    fun `raw unresolved link Map inside a field passes through unchanged`() {
        val stub = mapOf(
            "sys" to mapOf("id" to "e2", "type" to "Link", "linkType" to "Entry"),
        )
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("editor" to stub),
        )

        val editor = (toOptimizedEntryMap(entry)["fields"] as Map<*, *>)["editor"] as Map<*, *>
        val editorSys = editor["sys"] as Map<*, *>
        assertEquals("e2", editorSys["id"])
        assertEquals("Link", editorSys["type"])
        assertEquals("Entry", editorSys["linkType"])
        assertFalse("unresolved link must not gain a fields block", editor.containsKey("fields"))
    }

    // -- asset edge cases ---------------------------------------------------

    @Test
    fun `asset without description or image omits description and details_image keys`() {
        val asset = makeAsset(
            id = "asset-1",
            title = "PDF",
            url = "//assets.ctfassets.net/x/spec.pdf",
            fileName = "spec.pdf",
            mimeType = "application/pdf",
            size = 4096,
        )
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("hero" to asset),
        )

        val hero = (toOptimizedEntryMap(entry)["fields"] as Map<*, *>)["hero"] as Map<*, *>
        val heroFields = hero["fields"] as Map<*, *>
        assertFalse("no description → key must be omitted", heroFields.containsKey("description"))
        val details = ((heroFields["file"] as Map<*, *>)["details"]) as Map<*, *>
        assertEquals(4096, details["size"])
        assertFalse("non-image → details.image must be omitted", details.containsKey("image"))
    }

    @Test
    fun `asset with no file still maps sys and title with an empty file record`() {
        val asset = CDAAsset()
        setField(asset, "attrs", mutableMapOf<String, Any>("id" to "asset-1", "type" to "Asset"))
        setField(asset, "defaultLocale", TEST_LOCALE)
        setField(asset, "fields", localizeFields(mapOf("title" to "Missing")))
        setField(asset, "rawFields", localizeFields(mapOf("title" to "Missing")))

        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("hero" to asset),
        )
        val hero = (toOptimizedEntryMap(entry)["fields"] as Map<*, *>)["hero"] as Map<*, *>
        val heroFields = hero["fields"] as Map<*, *>
        assertEquals("Missing", heroFields["title"])
        val file = heroFields["file"] as Map<*, *>
        assertEquals("", file["url"])
        assertEquals("", file["fileName"])
    }

    // -- rich text hyperlink vs embedded resource ---------------------------

    @Test
    fun `plain URI hyperlink emits data uri and content, not a target`() {
        val hyperlink = CDARichHyperLink("https://example.com").apply {
            setNodeType("hyperlink")
            content.add(
                CDARichText("click", mutableListOf<CDARichMark>()).apply { setNodeType("text") },
            )
        }
        val paragraph = CDARichParagraph().apply {
            setNodeType("paragraph")
            content.add(hyperlink)
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

        val body = (toOptimizedEntryMap(entry)["fields"] as Map<*, *>)["body"] as Map<*, *>
        val p = (body["content"] as List<*>)[0] as Map<*, *>
        val h = (p["content"] as List<*>)[0] as Map<*, *>
        assertEquals("hyperlink", h["nodeType"])
        val data = h["data"] as Map<*, *>
        assertEquals("https://example.com", data["uri"])
        assertFalse("URI hyperlink must not carry data.target", data.containsKey("target"))
        assertNotNull("hyperlink must preserve inner text", h["content"])
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

        val map = toOptimizedEntryMap(entry)
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

    // -- variant lookup ------------------------------------------------------

    @Test
    fun `findVariantEntry returns the baseline itself when its own id is queried`() {
        val baseline = makeEntry(id = "baseline", contentTypeId = "page", rawFields = emptyMap())
        assertEquals(baseline, findVariantEntry(baseline, "baseline"))
    }

    @Test
    fun `findVariantEntry walks nt_experiences and nt_variants to locate a winning variant`() {
        val variantA = makeEntry(id = "va", contentTypeId = "page", rawFields = mapOf("t" to "A"))
        val variantB = makeEntry(id = "vb", contentTypeId = "page", rawFields = mapOf("t" to "B"))
        val experience = makeEntry(
            id = "exp-1",
            contentTypeId = "nt_experience",
            rawFields = mapOf("nt_variants" to listOf(variantA, variantB)),
        )
        val baseline = makeEntry(
            id = "baseline",
            contentTypeId = "page",
            rawFields = mapOf("t" to "baseline", "nt_experiences" to listOf(experience)),
        )

        val winner = findVariantEntry(baseline, "vb")
        assertNotNull(winner)
        assertEquals("vb", winner?.id())
        assertEquals("B", winner?.getField("t"))
    }

    @Test
    fun `findVariantEntry returns null when no variant with that id is reachable`() {
        val variant = makeEntry(id = "va", contentTypeId = "page", rawFields = emptyMap())
        val experience = makeEntry(
            id = "exp-1",
            contentTypeId = "nt_experience",
            rawFields = mapOf("nt_variants" to listOf(variant)),
        )
        val baseline = makeEntry(
            id = "baseline",
            contentTypeId = "page",
            rawFields = mapOf("nt_experiences" to listOf(experience)),
        )

        assertNull(findVariantEntry(baseline, "not-in-graph"))
    }

    @Test
    fun `findVariantEntry returns null when the baseline has no nt_experiences field`() {
        val baseline = makeEntry(id = "baseline", contentTypeId = "page", rawFields = emptyMap())
        assertNull(findVariantEntry(baseline, "anything"))
    }
}

// -- test fixtures --------------------------------------------------------

private const val TEST_LOCALE = "en-US"

private fun makeEntry(
    id: String,
    contentTypeId: String,
    rawFields: Map<String, Any?>,
    metadata: CDAMetadata? = makeMetadata(),
    createdAt: String? = null,
    updatedAt: String? = null,
    revision: Number? = null,
    locale: String? = null,
    spaceId: String? = null,
    environmentId: String? = null,
): CDAEntry {
    val entry = CDAEntry()
    val attrs = mutableMapOf<String, Any>("id" to id, "type" to "Entry")
    createdAt?.let { attrs["createdAt"] = it }
    updatedAt?.let { attrs["updatedAt"] = it }
    revision?.let { attrs["revision"] = it }
    locale?.let { attrs["locale"] = it }
    spaceId?.let {
        attrs["space"] = mapOf("sys" to mapOf("id" to it, "type" to "Link", "linkType" to "Space"))
    }
    environmentId?.let {
        attrs["environment"] = mapOf(
            "sys" to mapOf("id" to it, "type" to "Link", "linkType" to "Environment"),
        )
    }
    setField(entry, "attrs", attrs)
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

// contentful.java value types keep the fields we need to set (attrs, rawFields, fields,
// metadata, tags, concepts) package-private, and building fixtures via full CDA response
// deserialization would be far heavier than reflection.
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
