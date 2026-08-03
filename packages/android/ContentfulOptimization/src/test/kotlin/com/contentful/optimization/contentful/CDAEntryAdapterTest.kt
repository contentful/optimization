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
import org.junit.Test

/**
 * Whole-tree assertions: each test names the entire expected `{sys, fields, metadata}` map the
 * adapter must produce for its input. `Map.equals` is entry-set equal (key-order-insensitive),
 * `List.equals` is positional. Field-by-field digs let an unexpected extra/missing key slip
 * through silently; asserting the whole tree does not.
 */
class CDAEntryAdapterTest {

    @Test
    fun `bare entry maps to sys + fields + empty metadata`() {
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("title" to "Hello"),
        )

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf("title" to "Hello"),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

    @Test
    fun `always populates a metadata record even when CDAMetadata is null`() {
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("title" to "Hello"),
            metadata = null,
        )

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf("title" to "Hello"),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

    @Test
    fun `serializes metadata tags and taxonomy concepts as link references`() {
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("title" to "Hello"),
            metadata = makeMetadata(
                tags = listOf(makeTag("spring-sale")),
                concepts = listOf(makeConcept("travel")),
            ),
        )

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf("title" to "Hello"),
            "metadata" to mapOf(
                "tags" to listOf(linkStub("spring-sale", "Tag")),
                "concepts" to listOf(linkStub("travel", "TaxonomyConcept")),
            ),
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

    @Test
    fun `expands nested resolved CDAEntry links recursively`() {
        val child = makeEntry(id = "child", contentTypeId = "author", rawFields = mapOf("name" to "Ada"))
        val parent = makeEntry(id = "parent", contentTypeId = "post", rawFields = mapOf("author" to child))

        val expected = mapOf(
            "sys" to sys("parent", "post"),
            "fields" to mapOf(
                "author" to mapOf(
                    "sys" to sys("child", "author"),
                    "fields" to mapOf("name" to "Ada"),
                    "metadata" to emptyMetadata,
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(parent))
    }

    @Test
    fun `emits an unresolved Link stub on a back-edge instead of recursing forever`() {
        val parent = makeEntry(id = "parent", contentTypeId = "post", rawFields = emptyMap())
        val child = makeEntry(id = "child", contentTypeId = "author", rawFields = mapOf("posts" to parent))
        setField(parent, "rawFields", localizeFields(mapOf("author" to child)))
        setField(parent, "fields", localizeFields(mapOf("author" to child)))

        val expected = mapOf(
            "sys" to sys("parent", "post"),
            "fields" to mapOf(
                "author" to mapOf(
                    "sys" to sys("child", "author"),
                    "fields" to mapOf(
                        // Back-edge: unresolved Link stub, no `fields` block.
                        "posts" to linkStub("parent", "Entry"),
                    ),
                    "metadata" to emptyMetadata,
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(parent))
    }

    @Test
    fun `expands a diamond so both branches carry the full nested entry`() {
        val shared = makeEntry(id = "shared", contentTypeId = "author", rawFields = mapOf("name" to "Ada"))
        val parent = makeEntry(
            id = "parent",
            contentTypeId = "post",
            rawFields = mapOf("author" to shared, "editor" to shared),
        )
        val sharedTree = mapOf(
            "sys" to sys("shared", "author"),
            "fields" to mapOf("name" to "Ada"),
            "metadata" to emptyMetadata,
        )

        val expected = mapOf(
            "sys" to sys("parent", "post"),
            "fields" to mapOf("author" to sharedTree, "editor" to sharedTree),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(parent))
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

        val expected = mapOf(
            "sys" to sys("a", "n"),
            "fields" to mapOf(
                "next" to mapOf(
                    "sys" to sys("b", "n"),
                    "fields" to mapOf(
                        "next" to mapOf(
                            "sys" to sys("c", "n"),
                            "fields" to mapOf(
                                "next" to linkStub("a", "Entry"),
                            ),
                            "metadata" to emptyMetadata,
                        ),
                    ),
                    "metadata" to emptyMetadata,
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(a))
    }

    @Test
    fun `self-referencing entry emits a link stub at the self edge`() {
        val self = makeEntry(id = "self", contentTypeId = "n", rawFields = emptyMap())
        setField(self, "rawFields", localizeFields(mapOf("self" to self)))
        setField(self, "fields", localizeFields(mapOf("self" to self)))

        val expected = mapOf(
            "sys" to sys("self", "n"),
            "fields" to mapOf("self" to linkStub("self", "Entry")),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(self))
    }

    @Test
    fun `five-level linear chain expands at every level`() {
        val leaf = makeEntry(id = "e5", contentTypeId = "n", rawFields = mapOf("name" to "leaf"))
        val a4 = makeEntry(id = "e4", contentTypeId = "n", rawFields = mapOf("next" to leaf))
        val a3 = makeEntry(id = "e3", contentTypeId = "n", rawFields = mapOf("next" to a4))
        val a2 = makeEntry(id = "e2", contentTypeId = "n", rawFields = mapOf("next" to a3))
        val a1 = makeEntry(id = "e1", contentTypeId = "n", rawFields = mapOf("next" to a2))

        fun link(id: String, fields: Map<String, Any>): Map<String, Any> = mapOf(
            "sys" to sys(id, "n"),
            "fields" to fields,
            "metadata" to emptyMetadata,
        )
        val expected = link(
            "e1",
            mapOf("next" to link(
                "e2",
                mapOf("next" to link(
                    "e3",
                    mapOf("next" to link(
                        "e4",
                        mapOf("next" to link("e5", mapOf("name" to "leaf"))),
                    )),
                )),
            )),
        )
        assertEquals(expected, toOptimizedEntryMap(a1))
    }

    @Test
    fun `raw unresolved link Map inside a field passes through unchanged`() {
        val stub = linkStub("e2", "Entry")
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("editor" to stub),
        )

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf("editor" to stub),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

    @Test
    fun `maps CDAAsset to a link-shaped asset record`() {
        val asset = makeAsset(id = "asset-1", title = "Sunset", url = "//images.ctfassets.net/x/sunset.jpg")
        val entry = makeEntry(id = "entry-1", contentTypeId = "page", rawFields = mapOf("hero" to asset))

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf(
                "hero" to mapOf(
                    "sys" to mapOf("id" to "asset-1", "type" to "Asset"),
                    "fields" to mapOf(
                        "title" to "Sunset",
                        "file" to mapOf(
                            "fileName" to "",
                            "contentType" to "",
                            "details" to mapOf("size" to 0),
                            "url" to "//images.ctfassets.net/x/sunset.jpg",
                        ),
                    ),
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
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
        val entry = makeEntry(id = "entry-1", contentTypeId = "page", rawFields = mapOf("hero" to asset))

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf(
                "hero" to mapOf(
                    "sys" to mapOf("id" to "asset-1", "type" to "Asset"),
                    "fields" to mapOf(
                        "title" to "Sunset",
                        "description" to "A sunset over the mountains",
                        "file" to mapOf(
                            "fileName" to "sunset.jpg",
                            "contentType" to "image/jpeg",
                            "details" to mapOf(
                                "size" to 12345,
                                "image" to mapOf("width" to 1920, "height" to 1080),
                            ),
                            "url" to "//images.ctfassets.net/x/sunset.jpg",
                        ),
                    ),
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

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
        val entry = makeEntry(id = "entry-1", contentTypeId = "page", rawFields = mapOf("hero" to asset))

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf(
                "hero" to mapOf(
                    "sys" to mapOf("id" to "asset-1", "type" to "Asset"),
                    "fields" to mapOf(
                        "title" to "PDF",
                        "file" to mapOf(
                            "fileName" to "spec.pdf",
                            "contentType" to "application/pdf",
                            "details" to mapOf("size" to 4096),
                            "url" to "//assets.ctfassets.net/x/spec.pdf",
                        ),
                    ),
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

    @Test
    fun `asset with no file still maps sys and title with an empty file record`() {
        val asset = CDAAsset()
        setField(asset, "attrs", mutableMapOf<String, Any>("id" to "asset-1", "type" to "Asset"))
        setField(asset, "defaultLocale", TEST_LOCALE)
        setField(asset, "fields", localizeFields(mapOf("title" to "Missing")))
        setField(asset, "rawFields", localizeFields(mapOf("title" to "Missing")))

        val entry = makeEntry(id = "entry-1", contentTypeId = "page", rawFields = mapOf("hero" to asset))

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf(
                "hero" to mapOf(
                    "sys" to mapOf("id" to "asset-1", "type" to "Asset"),
                    "fields" to mapOf(
                        "title" to "Missing",
                        "file" to mapOf(
                            "fileName" to "",
                            "contentType" to "",
                            "details" to mapOf("size" to 0),
                            "url" to "",
                        ),
                    ),
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

    @Test
    fun `iso8601 formats Date field values instead of falling through to toString`() {
        val entry = makeEntry(
            id = "entry-1",
            contentTypeId = "page",
            rawFields = mapOf("publishedAt" to java.util.Date(1_700_000_000_000L)),
        )

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf("publishedAt" to "2023-11-14T22:13:20Z"),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

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

        val expected = mapOf(
            "sys" to sys("entry-1", "page") + mapOf(
                "createdAt" to "2024-01-01T00:00:00Z",
                "updatedAt" to "2024-06-15T12:30:00Z",
                "revision" to 3,
                "locale" to "en-US",
                "space" to linkStub("space-1", "Space"),
                "environment" to linkStub("master", "Environment"),
            ),
            "fields" to emptyMap<String, Any>(),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

    @Test
    fun `omits sys optional attrs when the source entry has none`() {
        val entry = makeEntry(id = "entry-1", contentTypeId = "page", rawFields = emptyMap())

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to emptyMap<String, Any>(),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }

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
        val entry = makeEntry(id = "entry-1", contentTypeId = "page", rawFields = mapOf("body" to document))

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf(
                "body" to mapOf(
                    "nodeType" to "document",
                    "data" to emptyMap<String, Any>(),
                    "content" to listOf(
                        mapOf(
                            "nodeType" to "paragraph",
                            "data" to emptyMap<String, Any>(),
                            "content" to listOf(
                                mapOf(
                                    "nodeType" to "hyperlink",
                                    "data" to mapOf("uri" to "https://example.com"),
                                    "content" to listOf(
                                        mapOf(
                                            "nodeType" to "text",
                                            "value" to "click",
                                            "marks" to emptyList<Any>(),
                                            "data" to emptyMap<String, Any>(),
                                        ),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
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
        val entry = makeEntry(id = "entry-1", contentTypeId = "page", rawFields = mapOf("body" to document))

        val expected = mapOf(
            "sys" to sys("entry-1", "page"),
            "fields" to mapOf(
                "body" to mapOf(
                    "nodeType" to "document",
                    "data" to emptyMap<String, Any>(),
                    "content" to listOf(
                        mapOf(
                            "nodeType" to "paragraph",
                            "data" to emptyMap<String, Any>(),
                            "content" to listOf(
                                mapOf(
                                    "nodeType" to "text",
                                    "value" to "hi",
                                    "marks" to listOf(mapOf("type" to "bold")),
                                    "data" to emptyMap<String, Any>(),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
            "metadata" to emptyMetadata,
        )
        assertEquals(expected, toOptimizedEntryMap(entry))
    }
}

// -- expected-shape helpers ---------------------------------------------------

private val emptyMetadata: Map<String, Any> = mapOf(
    "tags" to emptyList<Any>(),
    "concepts" to emptyList<Any>(),
)

private fun sys(id: String, contentTypeId: String): Map<String, Any> = mapOf(
    "id" to id,
    "type" to "Entry",
    "contentType" to mapOf(
        "sys" to mapOf(
            "id" to contentTypeId,
            "type" to "Link",
            "linkType" to "ContentType",
        ),
    ),
)

private fun linkStub(id: String, linkType: String): Map<String, Any> = mapOf(
    "sys" to mapOf("id" to id, "type" to "Link", "linkType" to linkType),
)

// -- fixture builders ---------------------------------------------------------

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

// contentful.java keeps fixture-relevant fields (attrs, rawFields, fields, metadata) package-
// private; reflection is lighter than round-tripping a full CDA response for every test.
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
