package com.contentful.optimization.core

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OptimizationConfigTest {

    @Test
    fun `defaults environment to main`() {
        val config = OptimizationConfig(clientId = "test-client")
        val json = JSONObject(config.toJSON())

        assertEquals("main", config.environment)
        assertEquals("main", json.getString("environment"))
    }

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
    fun `serializes selected optimizations default under bridge key`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            defaults = StorageDefaults(
                selectedOptimizations = listOf(mapOf("experienceId" to "exp-1", "variantIndex" to 2)),
            ),
        )

        val defaults = JSONObject(config.toJSON()).getJSONObject("defaults")
        val selectedOptimizations = defaults.getJSONArray("selectedOptimizations")

        assertEquals(false, defaults.has("optimizations"))
        assertEquals(1, selectedOptimizations.length())
        assertEquals("exp-1", selectedOptimizations.getJSONObject(0).getString("experienceId"))
        assertEquals(2, selectedOptimizations.getJSONObject(0).getInt("variantIndex"))
    }

    @Test
    fun `serializes bridge-only anonymous id default`() {
        val config = OptimizationConfig(clientId = "test-client")

        val defaults = JSONObject(config.toJSON(anonymousId = "anonymous-id")).getJSONObject("defaults")

        assertEquals("anonymous-id", defaults.getString("anonymousId"))
    }

    @Test
    fun `serializes nested api and log level`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            api = OptimizationApiConfig(
                experienceBaseUrl = "http://localhost:8000/experience/",
                insightsBaseUrl = "http://localhost:8000/insights/",
                enabledFeatures = listOf("audiences", "experiences"),
                preflight = true,
            ),
            logLevel = OptimizationLogLevel.debug,
        )

        val json = JSONObject(config.toJSON())
        val api = json.getJSONObject("api")
        val enabledFeatures = api.getJSONArray("enabledFeatures")

        assertEquals(false, json.has("experienceBaseUrl"))
        assertEquals(false, json.has("insightsBaseUrl"))
        assertEquals("http://localhost:8000/experience/", api.getString("experienceBaseUrl"))
        assertEquals("http://localhost:8000/insights/", api.getString("insightsBaseUrl"))
        assertEquals("audiences", enabledFeatures.getString(0))
        assertEquals("experiences", enabledFeatures.getString(1))
        assertEquals(true, api.getBoolean("preflight"))
        assertEquals("debug", json.getString("logLevel"))
    }

    @Test
    fun `serializes queue policy knobs without callbacks`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            queuePolicy = QueuePolicy(
                flush = QueueFlushPolicy(
                    flushIntervalMs = 1000,
                    baseBackoffMs = 200,
                    maxBackoffMs = 4000,
                    jitterRatio = 0.25,
                    maxConsecutiveFailures = 3,
                    circuitOpenMs = 5000,
                ),
                offlineMaxEvents = 10,
                onOfflineDrop = {},
                onFlushFailure = {},
                onCircuitOpen = {},
                onFlushRecovered = {},
            ),
        )

        val queuePolicy = JSONObject(config.toJSON()).getJSONObject("queuePolicy")
        val flush = queuePolicy.getJSONObject("flush")

        assertEquals(10, queuePolicy.getInt("offlineMaxEvents"))
        assertEquals(1000, flush.getInt("flushIntervalMs"))
        assertEquals(200, flush.getInt("baseBackoffMs"))
        assertEquals(4000, flush.getInt("maxBackoffMs"))
        assertEquals(0.25, flush.getDouble("jitterRatio"), 0.0)
        assertEquals(3, flush.getInt("maxConsecutiveFailures"))
        assertEquals(5000, flush.getInt("circuitOpenMs"))
        assertEquals(false, queuePolicy.has("onOfflineDrop"))
        assertEquals(false, flush.has("onFlushFailure"))
        assertEquals(false, flush.has("onCircuitOpen"))
        assertEquals(false, flush.has("onFlushRecovered"))
    }

    @Test
    fun `serializes allowed event types`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            allowedEventTypes = listOf("identify", "screen", "flag"),
        )

        val allowedEventTypes = JSONObject(config.toJSON()).getJSONArray("allowedEventTypes")

        assertEquals(3, allowedEventTypes.length())
        assertEquals("identify", allowedEventTypes.getString(0))
        assertEquals("screen", allowedEventTypes.getString(1))
        assertEquals("flag", allowedEventTypes.getString(2))
    }

    @Test
    fun `serializes empty allowed event types`() {
        val config = OptimizationConfig(
            clientId = "test-client",
            allowedEventTypes = emptyList(),
        )

        val allowedEventTypes = JSONObject(config.toJSON()).getJSONArray("allowedEventTypes")

        assertEquals(0, allowedEventTypes.length())
    }

    @Test
    fun `typed event payloads serialize JSON values`() {
        val identify = JSONObject(
            IdentifyPayload(
                userId = "user-1",
                traits = mapOf(
                    "plan" to JSONValue.Str("pro"),
                    "score" to JSONValue.Number(42.5),
                    "flags" to JSONValue.Array(listOf(JSONValue.Bool(true), JSONValue.Null)),
                    "nested" to JSONValue.Obj(mapOf("tier" to JSONValue.Str("enterprise"))),
                ),
            ).toJSON(),
        )
        val traits = identify.getJSONObject("traits")
        val flags = traits.getJSONArray("flags")

        assertEquals("user-1", identify.getString("userId"))
        assertEquals("pro", traits.getString("plan"))
        assertEquals(42.5, traits.getDouble("score"), 0.0)
        assertTrue(flags.getBoolean(0))
        assertTrue(flags.isNull(1))
        assertEquals("enterprise", traits.getJSONObject("nested").getString("tier"))

        val page = JSONObject(
            PageEventPayload(
                properties = mapOf("path" to JSONValue.Str("/home")),
            ).toJSON(),
        )
        assertEquals("/home", page.getString("path"))

        val screen = JSONObject(
            ScreenEventPayload(
                name = "Home",
                properties = mapOf("tab" to JSONValue.Str("featured")),
                routeKey = "home-route",
            ).toJSON(),
        )
        assertEquals("Home", screen.getString("name"))
        assertEquals("featured", screen.getJSONObject("properties").getString("tab"))
        assertEquals("home-route", screen.getString("routeKey"))

        val track = JSONObject(
            TrackEventPayload(
                event = "Purchase Completed",
                properties = mapOf("sku" to JSONValue.Str("sku-1")),
            ).toJSON(),
        )
        assertEquals("Purchase Completed", track.getString("event"))
        assertEquals("sku-1", track.getJSONObject("properties").getString("sku"))
    }

    @Test
    fun `optimization state equality includes selected optimizations`() {
        val first = OptimizationState(
            selectedOptimizations = listOf(mapOf("experienceId" to "exp-1", "variantIndex" to 1)),
            optimizationPossible = true,
            experienceRequestState = mapOf("status" to "success"),
        )
        val second = OptimizationState(
            selectedOptimizations = listOf(mapOf("variantIndex" to 1, "experienceId" to "exp-1")),
            optimizationPossible = true,
            experienceRequestState = mapOf("status" to "success"),
        )
        val third = OptimizationState(
            selectedOptimizations = listOf(mapOf("experienceId" to "exp-1", "variantIndex" to 2)),
            optimizationPossible = true,
            experienceRequestState = mapOf("status" to "success"),
        )
        val fourth = OptimizationState(
            selectedOptimizations = listOf(mapOf("variantIndex" to 1, "experienceId" to "exp-1")),
            optimizationPossible = true,
            experienceRequestState = mapOf("status" to "failed", "reason" to "api-error"),
        )

        assertEquals(first, second)
        assertFalse(first == third)
        assertFalse(first == fourth)
    }

    @Test
    fun `public client ABI includes track and hides test-only hook names`() {
        val methodNames = OptimizationClient::class.java.methods.map { it.name }.toSet()

        assertTrue(methodNames.contains("track"))
        assertTrue(
            OptimizationClient::class.java.methods.any {
                it.name == "identify" && it.parameterTypes.firstOrNull() == IdentifyPayload::class.java
            },
        )
        assertTrue(
            OptimizationClient::class.java.methods.any {
                it.name == "page" && it.parameterTypes.firstOrNull() == PageEventPayload::class.java
            },
        )
        assertTrue(
            OptimizationClient::class.java.methods.any {
                it.name == "screen" && it.parameterTypes.firstOrNull() == ScreenEventPayload::class.java
            },
        )
        assertTrue(
            OptimizationClient::class.java.methods.any {
                it.name == "track" && it.parameterTypes.firstOrNull() == TrackEventPayload::class.java
            },
        )
        assertTrue(methodNames.contains("getFlag"))
        assertTrue(methodNames.contains("observeFlag"))
        assertTrue(methodNames.contains("getEventStream"))
        assertTrue(methodNames.contains("getBlockedEventStream"))
        assertTrue(methodNames.contains("getOptimizationPossible"))
        assertTrue(methodNames.contains("getExperienceRequestState"))
        assertTrue(methodNames.contains("resolveOptimizedEntry"))
        assertFalse(methodNames.contains("subscribeToFlag"))
        assertFalse(methodNames.contains("personalizeEntry"))
        assertFalse(methodNames.contains("testOnlySetLogHandler"))
        assertFalse(methodNames.contains("testOnlyEvaluateScript"))
    }

}
