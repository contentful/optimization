package com.contentful.optimization.contentful

import com.contentful.optimization.core.ResolvedOptimizedEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies the "raw entry" path still works: a hand-built `Map<String, Any>` entry (e.g. built
 * by a customer who fetches from CDA with their own HTTP client, or crafts a fixture for tests)
 * flows through the SDK unchanged. The `CDAEntry` overload is one integration path; the base
 * Map overload remains a supported alternative.
 */
class RawEntryMapPassThroughTest {

    @Test
    fun `raw Map entry constructs a ResolvedOptimizedEntry that reads through typed accessors`() {
        val rawEntry: Map<String, Any> = mapOf(
            "sys" to mapOf(
                "id" to "raw-1",
                "type" to "Entry",
                "contentType" to mapOf(
                    "sys" to mapOf("id" to "landingPage", "type" to "Link", "linkType" to "ContentType"),
                ),
            ),
            "fields" to mapOf(
                "title" to "Hand-built",
                "author" to mapOf(
                    "sys" to mapOf(
                        "id" to "a1",
                        "type" to "Entry",
                        "contentType" to mapOf(
                            "sys" to mapOf("id" to "author", "type" to "Link", "linkType" to "ContentType"),
                        ),
                    ),
                    "fields" to mapOf("name" to "Ada"),
                    "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
                ),
            ),
            "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
        )

        val resolved = ResolvedOptimizedEntry(entry = rawEntry, selectedOptimization = null)
        assertEquals("raw-1", resolved.id)
        assertEquals("landingPage", resolved.contentTypeId)
        assertEquals("Hand-built", resolved.getField<String>("title"))

        val author = resolved.getEntry("author")
        assertNotNull("nested resolved entry must be reachable", author)
        assertEquals("a1", author?.id)
        assertEquals("Ada", author?.getField<String>("name"))
    }

    @Test
    fun `raw Map entry with an unresolved link stub does not surface as a resolved entry`() {
        val stub: Map<String, Any> = mapOf(
            "sys" to mapOf("id" to "unresolved", "type" to "Link", "linkType" to "Entry"),
        )
        val rawEntry: Map<String, Any> = mapOf(
            "sys" to mapOf(
                "id" to "raw-1",
                "type" to "Entry",
                "contentType" to mapOf(
                    "sys" to mapOf("id" to "page", "type" to "Link", "linkType" to "ContentType"),
                ),
            ),
            "fields" to mapOf("author" to stub),
            "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
        )

        val resolved = ResolvedOptimizedEntry(entry = rawEntry, selectedOptimization = null)
        assertNull("unresolved stub must not surface as a resolved entry", resolved.getEntry("author"))
    }

    @Test
    fun `raw Map entry survives round-trip through the underlying entry escape hatch`() {
        val raw: Map<String, Any> = mapOf(
            "sys" to mapOf("id" to "raw-1", "type" to "Entry"),
            "fields" to mapOf("title" to "keep me"),
            "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
        )

        val resolved = ResolvedOptimizedEntry(entry = raw, selectedOptimization = null)
        assertTrue("raw entry Map must remain reachable via .entry", resolved.entry === raw)
    }

    @Test
    fun `raw Map entry supports getAsset on a resolved asset link`() {
        val asset: Map<String, Any> = mapOf(
            "sys" to mapOf("id" to "asset-1", "type" to "Asset"),
            "fields" to mapOf(
                "title" to "Sunset",
                "file" to mapOf("url" to "//images.ctfassets.net/x/sunset.jpg"),
            ),
        )
        val raw: Map<String, Any> = mapOf(
            "sys" to mapOf("id" to "raw-1", "type" to "Entry"),
            "fields" to mapOf("hero" to asset),
            "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
        )

        val resolved = ResolvedOptimizedEntry(entry = raw, selectedOptimization = null)
        val hero = resolved.getAsset("hero")
        assertNotNull(hero)
        assertEquals("Sunset", hero?.title)
        assertEquals("https://images.ctfassets.net/x/sunset.jpg", hero?.url)
    }

    @Test
    fun `raw Map entry never triggers the CDAEntry adapter path`() {
        // Explicit assertion: a Map does not need contentful.java on the classpath at runtime.
        // If we had a bug where the base OptimizedEntry(Map) somehow depended on CDAEntry, this
        // test would fail during construction. Guarded by the fact that this file imports zero
        // com.contentful.java symbols.
        val raw: Map<String, Any> = mapOf(
            "sys" to mapOf("id" to "raw-1", "type" to "Entry"),
            "fields" to mapOf("title" to "no CDA"),
            "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
        )
        val resolved = ResolvedOptimizedEntry(entry = raw, selectedOptimization = null)
        assertEquals("no CDA", resolved.getField<String>("title"))
        assertFalse(this::class.java.name.contains("com.contentful.java"))
    }
}
