package com.contentful.optimization.core

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class OptimizationConfigTest {

    @Test
    fun `serializes normalized explicit locale`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            locale = " de_DE ",
        )

        val json = JSONObject(config.toJSON())

        assertEquals("de-DE", json.getString("locale"))
        assertEquals("de-DE", config.normalizedLocale())
    }

    @Test
    fun `omits locale when unset`() {
        val config = OptimizationConfig(
            clientId = "test-client",
        )

        val json = JSONObject(config.toJSON())

        assertEquals(false, json.has("locale"))
        assertEquals(null, config.normalizedLocale())
    }

    @Test
    fun `serializes persistence consent default`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            defaults = StorageDefaults(consent = true, persistenceConsent = false),
        )

        val defaults = JSONObject(config.toJSON()).getJSONObject("defaults")

        assertEquals(true, defaults.getBoolean("consent"))
        assertEquals(false, defaults.getBoolean("persistenceConsent"))
    }

    @Test
    fun `serializes bridge-only anonymous id default`() {
        val config = OptimizationConfig(clientId = "test-client")

        val defaults = JSONObject(config.toJSON(anonymousId = "anonymous-id")).getJSONObject("defaults")

        assertEquals("anonymous-id", defaults.getString("anonymousId"))
    }

}
