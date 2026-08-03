package com.contentful.optimization.contentful

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class CTEntryTest {

    private val minimalEntry: Map<String, Any> = mapOf(
        "sys" to mapOf(
            "id" to "e1",
            "type" to "Entry",
            "contentType" to mapOf(
                "sys" to mapOf("id" to "page", "type" to "Link", "linkType" to "ContentType"),
            ),
            "locale" to "en-US",
            "createdAt" to "2024-01-01T00:00:00Z",
            "updatedAt" to "2024-06-15T12:30:00Z",
        ),
        "fields" to mapOf("title" to "Hello", "count" to 42),
        "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
    )

    @Test
    fun `id returns sys id`() {
        assertEquals("e1", CTEntry.from(minimalEntry).id)
    }

    @Test
    fun `contentTypeId returns nested content type id`() {
        assertEquals("page", CTEntry.from(minimalEntry).contentTypeId)
    }

    @Test
    fun `localeCode returns sys locale, null when absent`() {
        assertEquals("en-US", CTEntry.from(minimalEntry).localeCode)
        val noLocale = CTEntry.from(mapOf("sys" to mapOf("id" to "e1"), "fields" to emptyMap<String, Any>()))
        assertNull(noLocale.localeCode)
    }

    @Test
    fun `createdAt and updatedAt parse ISO-8601 sys timestamps`() {
        val entry = CTEntry.from(minimalEntry)
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ROOT).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        assertEquals(formatter.parse("2024-01-01T00:00:00Z"), entry.createdAt)
        assertEquals(formatter.parse("2024-06-15T12:30:00Z"), entry.updatedAt)
    }

    @Test
    fun `createdAt returns null when absent or unparseable`() {
        val absent = CTEntry.from(mapOf("sys" to mapOf("id" to "e1"), "fields" to emptyMap<String, Any>()))
        assertNull(absent.createdAt)
        val garbage = CTEntry.from(mapOf("sys" to mapOf("id" to "e1", "createdAt" to "not-a-date"), "fields" to emptyMap<String, Any>()))
        assertNull(garbage.createdAt)
    }

    @Test
    fun `getField returns the value cast to T, null on absent`() {
        val entry = CTEntry.from(minimalEntry)
        assertEquals("Hello", entry.getField<String>("title"))
        assertEquals(42.0, entry.getField<Double>("count")!!, 0.0)
        assertNull(entry.getField<String>("nope"))
    }

    @Test
    fun `hasField distinguishes present from absent`() {
        val entry = CTEntry.from(minimalEntry)
        assertTrue(entry.hasField("title"))
        assertFalse(entry.hasField("nope"))
    }

    @Test
    fun `string subscript delegates to getField String`() {
        val entry = CTEntry.from(minimalEntry)
        assertEquals("Hello", entry["title"])
        assertNull(entry["nope"])
    }

    @Test
    fun `imageURL prepends https to protocol-relative asset URLs`() {
        val entry = CTEntry.from(mapOf(
            "sys" to mapOf("id" to "e1"),
            "fields" to mapOf(
                "image" to mapOf(
                    "sys" to mapOf("id" to "a1", "type" to "Asset"),
                    "fields" to mapOf(
                        "file" to mapOf("url" to "//images.ctfassets.net/x/photo.jpg"),
                    ),
                ),
            ),
        ))
        assertEquals("https://images.ctfassets.net/x/photo.jpg", entry.imageURL)
    }

    @Test
    fun `imageURL returns absolute URL as-is`() {
        val entry = CTEntry.from(mapOf(
            "sys" to mapOf("id" to "e1"),
            "fields" to mapOf(
                "image" to mapOf(
                    "sys" to mapOf("id" to "a1", "type" to "Asset"),
                    "fields" to mapOf(
                        "file" to mapOf("url" to "https://cdn.example/photo.jpg"),
                    ),
                ),
            ),
        ))
        assertEquals("https://cdn.example/photo.jpg", entry.imageURL)
    }

    @Test
    fun `imageURL returns null when the image field or nested shape is missing`() {
        val noImage = CTEntry.from(mapOf("sys" to mapOf("id" to "e1"), "fields" to mapOf("title" to "Hello")))
        assertNull(noImage.imageURL)

        val noFile = CTEntry.from(mapOf(
            "sys" to mapOf("id" to "e1"),
            "fields" to mapOf(
                "image" to mapOf(
                    "sys" to mapOf("id" to "a1", "type" to "Asset"),
                    "fields" to mapOf("title" to "Only a title"),
                ),
            ),
        ))
        assertNull(noFile.imageURL)
    }

    @Test
    fun `from(any) with an unserializable value falls back to an empty CTEntry`() {
        val nonJsonSafe = mapOf<String, Any>(
            "sys" to mapOf("id" to "e1"),
            "fields" to mapOf("weird" to Any()),
        )
        val entry = CTEntry.from(nonJsonSafe)
        assertEquals("e1", entry.id)
    }

    @Test
    fun `from(json) with a non-object root falls back to an empty CTEntry`() {
        assertNull(CTEntry.from("[1, 2, 3]").id)
    }

    @Test
    fun `from(json) with malformed input falls back to an empty CTEntry`() {
        assertNull(CTEntry.from("{ not valid").id)
    }

    @Test
    fun `from(json) with malformed input falls back to the caller-supplied fallback`() {
        val baseline = CTEntry.from(minimalEntry)
        assertEquals("e1", CTEntry.from("{ not valid", fallback = baseline).id)
    }

    @Test
    fun `from(any) with cyclic input falls back to the caller-supplied fallback`() {
        val baseline = CTEntry.from(minimalEntry)
        val cyclic = mutableMapOf<String, Any>("self" to Any())
        cyclic["self"] = cyclic
        assertEquals("e1", CTEntry.from(cyclic, fallback = baseline).id)
    }

    // The CDAEntry-walk path (`Entry.from(CDAEntry)`) is exercised end-to-end by the reference
    // implementations' Compose/Views E2E, not here — that path needs a live `CDAClient` to
    // hydrate a `CDAEntry` correctly.

    @Test
    fun `identity - baseline sys and contentType with empty metadata`() {
        assertJsonIdentity("""
            {
              "sys": {"id": "e1", "type": "Entry",
                       "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}}},
              "fields": {"title": "Hello"},
              "metadata": {"tags": [], "concepts": []}
            }
        """)
    }

    @Test
    fun `identity - sys timestamps, revision, locale, space, environment`() {
        assertJsonIdentity("""
            {
              "sys": {
                "id": "e1", "type": "Entry", "locale": "en-US", "revision": 3,
                "createdAt": "2024-01-01T00:00:00Z", "updatedAt": "2024-06-15T12:30:00Z",
                "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}},
                "space": {"sys": {"id": "space-1", "type": "Link", "linkType": "Space"}},
                "environment": {"sys": {"id": "master", "type": "Link", "linkType": "Environment"}}
              },
              "fields": {},
              "metadata": {"tags": [], "concepts": []}
            }
        """)
    }

    @Test
    fun `identity - metadata tags and concepts round-trip as link references`() {
        assertJsonIdentity("""
            {
              "sys": {"id": "e1", "type": "Entry",
                       "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}}},
              "fields": {},
              "metadata": {
                "tags": [{"sys": {"id": "spring-sale", "type": "Link", "linkType": "Tag"}}],
                "concepts": [{"sys": {"id": "travel", "type": "Link", "linkType": "TaxonomyConcept"}}]
              }
            }
        """)
    }

    @Test
    fun `identity - nested resolved entry link round-trips as a nested envelope`() {
        assertJsonIdentity("""
            {
              "sys": {"id": "parent", "type": "Entry",
                       "contentType": {"sys": {"id": "post", "type": "Link", "linkType": "ContentType"}}},
              "fields": {
                "author": {
                  "sys": {"id": "child", "type": "Entry",
                           "contentType": {"sys": {"id": "author", "type": "Link", "linkType": "ContentType"}}},
                  "fields": {"name": "Ada"},
                  "metadata": {"tags": [], "concepts": []}
                }
              },
              "metadata": {"tags": [], "concepts": []}
            }
        """)
    }

    @Test
    fun `identity - unresolved link stub in a field passes through unchanged`() {
        assertJsonIdentity("""
            {
              "sys": {"id": "e1", "type": "Entry",
                       "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}}},
              "fields": {"editor": {"sys": {"id": "e2", "type": "Link", "linkType": "Entry"}}},
              "metadata": {"tags": [], "concepts": []}
            }
        """)
    }

    @Test
    fun `identity - asset link with minimal file details`() {
        assertJsonIdentity("""
            {
              "sys": {"id": "entry-1", "type": "Entry",
                       "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}}},
              "fields": {
                "hero": {
                  "sys": {"id": "asset-1", "type": "Asset"},
                  "fields": {
                    "title": "Sunset",
                    "file": {"fileName": "", "contentType": "", "details": {"size": 0}, "url": "//images.ctfassets.net/x/sunset.jpg"}
                  }
                }
              },
              "metadata": {"tags": [], "concepts": []}
            }
        """)
    }

    @Test
    fun `identity - asset link with description and image details`() {
        assertJsonIdentity("""
            {
              "sys": {"id": "entry-1", "type": "Entry",
                       "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}}},
              "fields": {
                "hero": {
                  "sys": {"id": "asset-1", "type": "Asset"},
                  "fields": {
                    "title": "Sunset",
                    "description": "A sunset over the mountains",
                    "file": {
                      "fileName": "sunset.jpg", "contentType": "image/jpeg",
                      "details": {"size": 12345, "image": {"width": 1920, "height": 1080}},
                      "url": "//images.ctfassets.net/x/sunset.jpg"
                    }
                  }
                }
              },
              "metadata": {"tags": [], "concepts": []}
            }
        """)
    }

    @Test
    fun `identity - rich text document with paragraph and text with marks`() {
        assertJsonIdentity("""
            {
              "sys": {"id": "e1", "type": "Entry",
                       "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}}},
              "fields": {
                "body": {
                  "nodeType": "document",
                  "data": {},
                  "content": [{
                    "nodeType": "paragraph",
                    "data": {},
                    "content": [{
                      "nodeType": "text",
                      "value": "hi",
                      "marks": [{"type": "bold"}],
                      "data": {}
                    }]
                  }]
                }
              },
              "metadata": {"tags": [], "concepts": []}
            }
        """)
    }

    @Test
    fun `identity - rich text URI hyperlink emits data uri, not data target`() {
        assertJsonIdentity("""
            {
              "sys": {"id": "e1", "type": "Entry",
                       "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}}},
              "fields": {
                "body": {
                  "nodeType": "document",
                  "data": {},
                  "content": [{
                    "nodeType": "paragraph",
                    "data": {},
                    "content": [{
                      "nodeType": "hyperlink",
                      "data": {"uri": "https://example.com"},
                      "content": [{"nodeType": "text", "value": "click", "marks": [], "data": {}}]
                    }]
                  }]
                }
              },
              "metadata": {"tags": [], "concepts": []}
            }
        """)
    }
}

private fun assertJsonIdentity(inputJson: String) {
    assertJsonTreeEquals(inputJson, CTEntry.from(inputJson).toJSON())
}

private fun assertJsonTreeEquals(expectedJson: String, actualJson: String) {
    assertEquals(normalize(JSONTokener(expectedJson).nextValue()), normalize(JSONTokener(actualJson).nextValue()))
}

private fun normalize(value: Any?): Any = when (value) {
    null, JSONObject.NULL -> "__null__"
    is JSONObject -> {
        val keys = value.keys().asSequence().toList().sorted()
        LinkedHashMap<String, Any>().also { out -> keys.forEach { out[it] = normalize(value.get(it)) } }
    }
    is JSONArray -> List(value.length()) { normalize(value.get(it)) }
    is Number -> value.toDouble()
    else -> value
}
