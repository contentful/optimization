package com.contentful.optimization.core

import com.contentful.optimization.contentful.CTEntry
import org.junit.Assert.assertEquals
import org.junit.Test

class ResolvedOptimizedEntryTest {

    @Test
    fun `only JSON boolean true marks an empty variant`() {
        val baseline = CTEntry.from(mapOf("sys" to mapOf("id" to "baseline"), "fields" to emptyMap<String, Any>()))
        val cases = mapOf(
            "" to false,
            ", \"isEmptyVariant\": false" to false,
            ", \"isEmptyVariant\": true" to true,
            ", \"isEmptyVariant\": null" to false,
            ", \"isEmptyVariant\": 1" to false,
            ", \"isEmptyVariant\": \"true\"" to false,
            ", \"isEmptyVariant\": []" to false,
        )

        cases.forEach { (field, expected) ->
            val payload = OptimizationClient.parseJSONDict(
                """{"entry":{"sys":{"id":"resolved"},"fields":{}}$field}""",
            )!!

            assertEquals(expected, ResolvedOptimizedEntry.fromBridgeResult(payload, baseline).isEmptyVariant)
        }
    }
}
