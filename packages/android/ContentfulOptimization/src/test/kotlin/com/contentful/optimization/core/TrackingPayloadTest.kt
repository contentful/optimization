package com.contentful.optimization.core

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class TrackingPayloadTest {

    @Test
    fun `track view payload serializes optimization context id only when present`() {
        val withContext = JSONObject(
            TrackViewPayload(
                componentId = "component-1",
                viewId = "view-1",
                experienceId = "experience-1",
                variantIndex = 1,
                viewDurationMs = 250,
                optimizationContextId = "ctx-1",
            ).toJSON(),
        )

        assertEquals("ctx-1", withContext.getString("optimizationContextId"))

        val withoutContext = JSONObject(
            TrackViewPayload(
                componentId = "component-1",
                viewId = "view-1",
                variantIndex = 0,
                viewDurationMs = 250,
            ).toJSON(),
        )

        assertFalse(withoutContext.has("optimizationContextId"))
    }

    @Test
    fun `track click payload serializes optimization context id only when present`() {
        val withContext = JSONObject(
            TrackClickPayload(
                componentId = "component-1",
                experienceId = "experience-1",
                variantIndex = 1,
                optimizationContextId = "ctx-1",
            ).toJSON(),
        )

        assertEquals("ctx-1", withContext.getString("optimizationContextId"))

        val withoutContext = JSONObject(
            TrackClickPayload(
                componentId = "component-1",
                variantIndex = 0,
            ).toJSON(),
        )

        assertFalse(withoutContext.has("optimizationContextId"))
    }
}
