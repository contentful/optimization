package com.contentful.optimization.core

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class OptimizationConfigTest {

    @Test
    fun `serializes resolved contentful locale`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            contentfulLocales = ContentfulLocales(
                default = "en-US",
                supported = listOf("en-US", "de-DE", "fr-FR"),
            ),
        )

        val json = JSONObject(config.toJSON())

        assertEquals("en-US", json.getString("locale"))
        assertEquals("de-DE", config.resolvedLocale(listOf("de-AT", "es-ES")))
    }

    @Test
    fun `serializes resolved default-only contentful locale`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            contentfulLocales = ContentfulLocales(default = "en-US"),
        )

        val json = JSONObject(config.toJSON())
        val contentfulLocales = json.getJSONObject("contentfulLocales")

        assertEquals("en-US", json.getString("locale"))
        assertEquals("en-US", contentfulLocales.getString("default"))
        assertEquals(0, contentfulLocales.getJSONArray("supported").length())
        assertEquals("en-US", config.resolvedLocale(listOf("de-AT", "es-ES")))
    }

    @Test
    fun `resolves explicit locale against contentful locales`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            contentfulLocales = ContentfulLocales(
                default = "en-US",
                supported = listOf("en-US", "de-DE"),
            ),
            locale = "de-AT",
        )

        assertEquals("de-DE", config.resolvedLocale(listOf("fr-FR")))
    }

    @Test
    fun `serializes nested api locale separately from content locale`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            contentfulLocales = ContentfulLocales(
                default = "en-US",
                supported = listOf("en-US", "de-DE"),
            ),
            locale = "de-AT",
            api = OptimizationApiConfig(locale = "fr-FR"),
        )

        val json = JSONObject(config.toJSON())

        assertEquals("de-DE", json.getString("locale"))
        assertEquals("fr-FR", json.getJSONObject("api").getString("locale"))
    }

    @Test
    fun `checks exact matches before fallback matches`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            contentfulLocales = ContentfulLocales(
                default = "en-US",
                supported = listOf("en-US", "de-DE", "fr-FR"),
            ),
        )

        assertEquals("fr-FR", config.resolvedLocale(listOf("de-AT", "fr-FR")))
    }
}
