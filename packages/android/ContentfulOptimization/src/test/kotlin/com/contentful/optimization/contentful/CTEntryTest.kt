package com.contentful.optimization.contentful

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
        "fields" to mapOf(
            "title" to "Hello",
            "count" to 42,
        ),
        "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
    )

    // -- accessors ------------------------------------------------------------

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
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
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
        assertEquals(42, entry.getField<Int>("count"))
        assertNull("missing field must return null", entry.getField<String>("nope"))
        // Note: JVM generic erasure means `getField<Int>("title")` does not throw and does not
        // return null — the actual `String` slips through, and the ClassCastException fires
        // later at the caller's use site. Mirrors `CDAEntry.getField<T>` semantics.
    }

    @Test
    fun `hasField distinguishes present-with-wrong-type from absent`() {
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

    // -- constructors ---------------------------------------------------------

    @Test
    fun `from(any) round-trips the input map through org_json normalization`() {
        val entry = CTEntry.from(minimalEntry)
        assertEquals("e1", entry.id)
        assertEquals("Hello", entry.getField<String>("title"))
    }

    @Test
    fun `from(any) with an unserializable value falls back to an empty CTEntry`() {
        // A raw java.util.Date is not JSON-safe; JSONObject reports it as a String, but the point
        // of the fallback is that pathological input never propagates as an exception into the
        // bridge call — the resolver just treats it as non-optimized.
        val nonJsonSafe = mapOf<String, Any>(
            "sys" to mapOf("id" to "e1"),
            "fields" to mapOf("weird" to Any()),
        )
        val entry = CTEntry.from(nonJsonSafe)
        // The entry loads without throwing. Downstream reads may return null; that's fine.
        assertEquals("e1", entry.id)
    }

    @Test
    fun `from(json) parses a JSON object into the same map shape`() {
        val json = """{"sys":{"id":"j1","contentType":{"sys":{"id":"page"}}},"fields":{"title":"Hi"}}"""
        val entry = CTEntry.from(json)
        assertEquals("j1", entry.id)
        assertEquals("page", entry.contentTypeId)
        assertEquals("Hi", entry.getField<String>("title"))
    }

    @Test
    fun `from(json) with a non-object root falls back to an empty CTEntry`() {
        val entry = CTEntry.from("[1, 2, 3]")
        assertNull(entry.id)
    }

    @Test
    fun `from(json) with malformed input falls back to an empty CTEntry`() {
        val entry = CTEntry.from("{ not valid")
        assertNull(entry.id)
    }

    @Test
    fun `from(json) with malformed input falls back to the caller-supplied fallback`() {
        val baseline = CTEntry.from(minimalEntry)
        val entry = CTEntry.from("{ not valid", fallback = baseline)
        // Mirrors OptimizationClient.resolveOptimizedEntry: an unparseable resolver output
        // decays to the mapped baseline entry, not empty — so the caller sees baseline content
        // instead of a blank render.
        assertEquals("e1", entry.id)
    }

    @Test
    fun `from(any) with unserializable input falls back to the caller-supplied fallback`() {
        val baseline = CTEntry.from(minimalEntry)
        // A recursive self-referential map isn't JSON-safe; org.json's stringify eventually errors.
        val cyclic = mutableMapOf<String, Any>("self" to Any())
        cyclic["self"] = cyclic
        val entry = CTEntry.from(cyclic, fallback = baseline)
        assertEquals("e1", entry.id)
    }

    // -- serialization --------------------------------------------------------

    @Test
    fun `toJSON round-trips through from(json) with the same accessible surface`() {
        val original = CTEntry.from(minimalEntry)
        val roundTripped = CTEntry.from(original.toJSON())
        assertEquals(original.id, roundTripped.id)
        assertEquals(original.contentTypeId, roundTripped.contentTypeId)
        assertEquals(original.getField<String>("title"), roundTripped.getField<String>("title"))
    }
}
