package com.contentful.optimization.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ResolvedOptimizedEntryAccessorsTest {

    private fun resolved(entry: Map<String, Any>): ResolvedOptimizedEntry =
        ResolvedOptimizedEntry(entry = entry, selectedOptimization = null)

    private fun entry(
        id: String,
        contentTypeId: String,
        fields: Map<String, Any> = emptyMap(),
    ): Map<String, Any> = mapOf(
        "sys" to mapOf(
            "id" to id,
            "type" to "Entry",
            "contentType" to mapOf(
                "sys" to mapOf("id" to contentTypeId, "type" to "Link", "linkType" to "ContentType"),
            ),
        ),
        "fields" to fields,
        "metadata" to mapOf("tags" to emptyList<Any>(), "concepts" to emptyList<Any>()),
    )

    @Test
    fun `id returns sys id`() {
        assertEquals("e1", resolved(entry("e1", "page")).id)
    }

    @Test
    fun `contentTypeId returns nested content type id`() {
        assertEquals("page", resolved(entry("e1", "page")).contentTypeId)
    }

    @Test
    fun `getField returns typed value or null on miss`() {
        val r = resolved(entry("e1", "page", fields = mapOf("title" to "Hi")))
        assertEquals("Hi", r.getField<String>("title"))
        assertNull(r.getField<String>("missing"))
    }

    @Test
    fun `getEntry returns resolved link and skips unresolved stub`() {
        val child = entry("child", "author", fields = mapOf("name" to "Ada"))
        val stub = mapOf(
            "sys" to mapOf("id" to "x", "type" to "Link", "linkType" to "Entry"),
        )
        val parent = entry("p", "post", fields = mapOf("author" to child, "editor" to stub))
        val r = resolved(parent)

        assertEquals("child", r.getEntry("author")?.id)
        assertEquals("Ada", r.getEntry("author")?.getField<String>("name"))
        assertNull("unresolved stub must not surface as a resolved entry", r.getEntry("editor"))
        assertNull(r.getEntry("missing"))
    }

    @Test
    fun `getEntries filters unresolved stubs and non-entries`() {
        val a = entry("a", "post", fields = mapOf("title" to "A"))
        val b = entry("b", "post", fields = mapOf("title" to "B"))
        val stub = mapOf(
            "sys" to mapOf("id" to "x", "type" to "Link", "linkType" to "Entry"),
        )
        val parent = entry("p", "listing", fields = mapOf("items" to listOf(a, stub, b)))

        val list = resolved(parent).getEntries("items")
        assertEquals(listOf("a", "b"), list.map { it.id })
    }

    @Test
    fun `getAsset exposes typed url with https prefix normalization`() {
        val asset = mapOf(
            "sys" to mapOf("id" to "asset-1", "type" to "Asset"),
            "fields" to mapOf(
                "title" to "Sunset",
                "file" to mapOf("url" to "//images.ctfassets.net/x.jpg"),
            ),
        )
        val parent = entry("p", "page", fields = mapOf("hero" to asset))
        val hero = resolved(parent).getAsset("hero")
        assertNotNull(hero)
        assertEquals("asset-1", hero!!.id)
        assertEquals("Sunset", hero.title)
        assertEquals("https://images.ctfassets.net/x.jpg", hero.url)
    }

    @Test
    fun `getAsset returns null when field is not an Asset`() {
        val child = entry("child", "author")
        val parent = entry("p", "page", fields = mapOf("hero" to child))
        assertNull(resolved(parent).getAsset("hero"))
    }

    @Test
    fun `entry field survives as the underlying map escape hatch`() {
        val map = entry("e1", "page", fields = mapOf("title" to "Hi"))
        assertTrue(resolved(map).entry === map)
    }
}
