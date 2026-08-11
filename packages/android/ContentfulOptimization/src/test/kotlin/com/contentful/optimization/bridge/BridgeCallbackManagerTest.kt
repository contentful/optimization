package com.contentful.optimization.bridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeCallbackManagerTest {
    @Test
    fun `two overlapping callAsync callbacks with the same method both settle`() {
        val manager = BridgeCallbackManager()
        val completions = mutableListOf<Pair<String, String>>()
        val first = manager.registerCallback(
            prefix = "screen",
            onSuccess = { completions += "first" to it },
            onError = { completions += "first-error" to it },
        )
        val second = manager.registerCallback(
            prefix = "screen",
            onSuccess = { completions += "second" to it },
            onError = { completions += "second-error" to it },
        )

        assertTrue(manager.invokeLogCallback("__callback__${first.success}", "first-result"))
        assertTrue(manager.invokeLogCallback("__callback__${second.success}", "second-result"))

        assertEquals(
            listOf("first" to "first-result", "second" to "second-result"),
            completions,
        )
    }
}
